export type GatewayMessage = { role: string; content: string };

export type AiProviderConfig = {
  name: "deepseek" | "siliconflow" | "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsReasoning?: boolean;
};

export type GatewayErrorCode = "AI_AUTH" | "AI_RATE_LIMIT" | "AI_TIMEOUT" | "AI_PROVIDER" | "AI_NOT_CONFIGURED";

export class AiGatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly retryable: boolean;
  readonly attempts: Array<{ provider: string; code: GatewayErrorCode; status?: number; elapsedMs: number }>;

  constructor(
    code: GatewayErrorCode,
    message: string,
    retryable: boolean,
    attempts: Array<{ provider: string; code: GatewayErrorCode; status?: number; elapsedMs: number }>,
  ) {
    super(message);
    this.name = "AiGatewayError";
    this.code = code;
    this.retryable = retryable;
    this.attempts = attempts;
  }
}

function codeForStatus(status: number): GatewayErrorCode {
  if (status === 401 || status === 403) return "AI_AUTH";
  if (status === 402 || status === 429) return "AI_RATE_LIMIT";
  return "AI_PROVIDER";
}

function providerUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  return /\/chat\/completions$/i.test(normalized) ? normalized : `${normalized}/chat/completions`;
}

export function gatewayErrorMessage(code: GatewayErrorCode): string {
  if (code === "AI_AUTH") return "API Key 无效，或无权访问所选模型。";
  if (code === "AI_RATE_LIMIT") return "AI 服务额度不足或请求过于频繁，请稍后重试。";
  if (code === "AI_TIMEOUT") return "AI 服务响应超时，请重试。";
  if (code === "AI_NOT_CONFIGURED") return "请先配置 AI 提供商和 API Key。";
  return "AI 服务拒绝了请求，请检查 API 地址和模型名称。";
}

export function reasoningParameters(provider: AiProviderConfig, reasoningMode: "instant" | "high" | "xhigh" = "instant") {
  if (!provider.supportsReasoning) return {};
  if (provider.name === "deepseek") {
    if (reasoningMode === "instant") return { thinking: { type: "disabled" } };
    return { thinking: { type: "enabled" }, reasoning_effort: reasoningMode === "xhigh" ? "max" : "high" };
  }
  if (provider.name === "siliconflow") {
    if (reasoningMode === "instant") return { enable_thinking: false };
    return { enable_thinking: true, ...(reasoningMode === "xhigh" ? { reasoning_effort: "max" } : {}) };
  }
  return reasoningMode === "instant" ? {} : { reasoning_effort: reasoningMode === "xhigh" ? "max" : "high" };
}

export async function callAiGateway(params: {
  providers: AiProviderConfig[];
  messages: GatewayMessage[];
  maxTokens: number;
  reasoningMode?: "instant" | "high" | "xhigh";
  perProviderTimeoutMs?: number;
  totalTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onAttempt?: (entry: { provider: string; ok: boolean; code?: GatewayErrorCode; status?: number; elapsedMs: number }) => void;
}): Promise<{ content: string; provider: string; model: string; attempts: number }> {
  const providers = params.providers.filter((provider) => provider.apiKey).slice(0, 2);
  if (providers.length === 0) throw new AiGatewayError("AI_NOT_CONFIGURED", "No AI provider is configured", false, []);

  const fetchImpl = params.fetchImpl || fetch;
  const perProviderTimeoutMs = params.perProviderTimeoutMs || 10_000;
  const deadline = Date.now() + (params.totalTimeoutMs || 24_000);
  const attempts: AiGatewayError["attempts"] = [];

  for (const provider of providers) {
    if (params.signal?.aborted) break;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const startedAt = Date.now();
    const controller = new AbortController();
    const abort = () => controller.abort();
    params.signal?.addEventListener("abort", abort, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), Math.min(perProviderTimeoutMs, remaining));
    try {
      const response = await fetchImpl(providerUrl(provider.baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${provider.apiKey}` },
        body: JSON.stringify({
          model: provider.model,
          messages: params.messages,
          max_tokens: params.maxTokens,
          stream: false,
          ...reasoningParameters(provider, params.reasoningMode),
        }),
        signal: controller.signal,
      });
      const elapsedMs = Date.now() - startedAt;
      if (!response.ok) {
        const code = codeForStatus(response.status);
        attempts.push({ provider: provider.name, code, status: response.status, elapsedMs });
        params.onAttempt?.({ provider: provider.name, ok: false, code, status: response.status, elapsedMs });
        continue;
      }
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        attempts.push({ provider: provider.name, code: "AI_PROVIDER", status: response.status, elapsedMs });
        params.onAttempt?.({ provider: provider.name, ok: false, code: "AI_PROVIDER", status: response.status, elapsedMs });
        continue;
      }
      params.onAttempt?.({ provider: provider.name, ok: true, status: response.status, elapsedMs });
      return { content, provider: provider.name, model: provider.model, attempts: attempts.length + 1 };
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const code: GatewayErrorCode = error instanceof DOMException && error.name === "AbortError" ? "AI_TIMEOUT" : "AI_PROVIDER";
      attempts.push({ provider: provider.name, code, elapsedMs });
      params.onAttempt?.({ provider: provider.name, ok: false, code, elapsedMs });
    } finally {
      clearTimeout(timeoutId);
      params.signal?.removeEventListener("abort", abort);
    }
  }

  if (params.signal?.aborted) throw new AiGatewayError("AI_TIMEOUT", "AI run deadline exceeded", true, attempts);
  const last = attempts[attempts.length - 1];
  const retryable = attempts.some((attempt) => attempt.code === "AI_TIMEOUT" || attempt.code === "AI_PROVIDER" || (attempt.code === "AI_RATE_LIMIT" && attempt.status !== 402));
  throw new AiGatewayError(last?.code || "AI_PROVIDER", "All configured AI providers failed", retryable, attempts);
}
