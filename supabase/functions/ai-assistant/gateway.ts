export type GatewayMessage = { role: string; content: string };

export type AiProviderConfig = {
  name: "deepseek" | "siliconflow" | "openai" | "anthropic" | "zhipu" | "qwen" | "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsReasoning?: boolean;
};

export type GatewayErrorCode = "AI_AUTH" | "AI_RATE_LIMIT" | "AI_TIMEOUT" | "AI_PROVIDER" | "AI_NOT_CONFIGURED";

export class AiGatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly retryable: boolean;
  readonly attempts: Array<{ provider: string; code: GatewayErrorCode; status?: number; elapsedMs: number; detail?: string }>;

  constructor(
    code: GatewayErrorCode,
    message: string,
    retryable: boolean,
    attempts: Array<{ provider: string; code: GatewayErrorCode; status?: number; elapsedMs: number; detail?: string }>,
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

function safeProviderDetail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const detail = value
    .replace(/\s+/g, " ")
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/(?:sk|key|token)[-_]?[A-Za-z0-9_-]{12,}/gi, "[redacted]")
    .trim()
    .slice(0, 180);
  return detail || undefined;
}

async function responseDetail(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      const payload = JSON.parse(text) as Record<string, unknown>;
      const nested = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : undefined;
      return safeProviderDetail(nested?.message || payload.message || nested?.code || payload.code || text);
    } catch {
      return safeProviderDetail(text);
    }
  } catch {
    return undefined;
  }
}

function shouldRetryProvider(status?: number, code?: GatewayErrorCode) {
  return code === "AI_PROVIDER" && (status === undefined || [408, 425, 500, 502, 503, 504].includes(status));
}

function providerUrl(baseUrl: string, provider: AiProviderConfig["name"]): string {
  const normalized = baseUrl.replace(/\/$/, "");
  if (provider === "anthropic") return /\/messages$/i.test(normalized) ? normalized : `${normalized}/messages`;
  return /\/chat\/completions$/i.test(normalized) ? normalized : `${normalized}/chat/completions`;
}

export function gatewayErrorMessage(code: GatewayErrorCode, detail?: string): string {
  if (code === "AI_AUTH") return "API Key 无效，或无权访问所选模型。";
  if (code === "AI_RATE_LIMIT") return "AI 服务额度不足或请求过于频繁，请稍后重试。";
  if (code === "AI_TIMEOUT") return "AI 服务响应超时，请重试。";
  if (code === "AI_NOT_CONFIGURED") return "请先配置 AI 提供商和 API Key。";
  return detail ? `AI 服务拒绝了请求（${detail}），请检查 API 地址和模型名称。` : "AI 服务拒绝了请求，请检查 API 地址和模型名称。";
}

export function reasoningParameters(provider: AiProviderConfig, reasoningMode: "instant" | "high" | "xhigh" = "instant", maxTokens = 2_400) {
  if (!provider.supportsReasoning) return {};
  if (provider.name === "anthropic") {
    if (reasoningMode === "instant" || maxTokens < 1_025) return {};
    return { thinking: { type: "enabled", budget_tokens: Math.max(1_024, Math.min(maxTokens - 1, reasoningMode === "xhigh" ? 8_192 : 4_096)) } };
  }
  if (provider.name === "deepseek") {
    if (reasoningMode === "instant") return { thinking: { type: "disabled" } };
    return { thinking: { type: "enabled" }, reasoning_effort: reasoningMode === "xhigh" ? "max" : "high" };
  }
  if (provider.name === "siliconflow") {
    if (reasoningMode === "instant") return { enable_thinking: false };
    return { enable_thinking: true, ...(reasoningMode === "xhigh" ? { reasoning_effort: "max" } : {}) };
  }
  if (provider.name === "zhipu") {
    if (reasoningMode === "instant") return { thinking: { type: "disabled" } };
    return { thinking: { type: "enabled" }, reasoning_effort: reasoningMode === "xhigh" ? "max" : "high" };
  }
  if (provider.name === "qwen") {
    return reasoningMode === "instant" ? { enable_thinking: false } : { enable_thinking: true };
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
    const maxAttempts = 2;
    for (let providerAttempt = 0; providerAttempt < maxAttempts; providerAttempt += 1) {
      const remainingAttemptBudget = deadline - Date.now();
      if (remainingAttemptBudget <= 0) break;
      const startedAt = Date.now();
      const controller = new AbortController();
      const abort = () => controller.abort();
      params.signal?.addEventListener("abort", abort, { once: true });
      const timeoutId = setTimeout(() => controller.abort(), Math.min(perProviderTimeoutMs, remainingAttemptBudget));
      try {
      const isAnthropic = provider.name === "anthropic";
      const systemMessages = isAnthropic ? params.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n") : "";
      const messages = isAnthropic ? params.messages.filter((message) => message.role !== "system") : params.messages;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAnthropic) {
        headers["x-api-key"] = provider.apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers.Authorization = `Bearer ${provider.apiKey}`;
      }
      const body = isAnthropic
        ? { model: provider.model, ...(systemMessages ? { system: systemMessages } : {}), messages, max_tokens: params.maxTokens, ...reasoningParameters(provider, params.reasoningMode, params.maxTokens) }
        : { model: provider.model, messages, max_tokens: params.maxTokens, stream: false, ...reasoningParameters(provider, params.reasoningMode, params.maxTokens) };
      const response = await fetchImpl(providerUrl(provider.baseUrl, provider.name), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const elapsedMs = Date.now() - startedAt;
      if (!response.ok) {
        const code = codeForStatus(response.status);
        const detail = await responseDetail(response);
        attempts.push({ provider: provider.name, code, status: response.status, elapsedMs, detail });
        params.onAttempt?.({ provider: provider.name, ok: false, code, status: response.status, elapsedMs });
        if (providerAttempt + 1 < maxAttempts && shouldRetryProvider(response.status, code) && deadline - Date.now() > 0) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }
        break;
      }
      const payload = await response.json();
      const content = isAnthropic
        ? payload?.content?.filter((item: { type?: string; text?: string }) => item?.type === "text").map((item: { text?: string }) => item.text || "").join("")
        : payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        attempts.push({ provider: provider.name, code: "AI_PROVIDER", status: response.status, elapsedMs });
        params.onAttempt?.({ provider: provider.name, ok: false, code: "AI_PROVIDER", status: response.status, elapsedMs });
        break;
      }
      params.onAttempt?.({ provider: provider.name, ok: true, status: response.status, elapsedMs });
      return { content, provider: provider.name, model: provider.model, attempts: attempts.length + 1 };
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const code: GatewayErrorCode = error instanceof DOMException && error.name === "AbortError" ? "AI_TIMEOUT" : "AI_PROVIDER";
      attempts.push({ provider: provider.name, code, elapsedMs });
      params.onAttempt?.({ provider: provider.name, ok: false, code, elapsedMs });
      if (providerAttempt + 1 < maxAttempts && code === "AI_PROVIDER" && deadline - Date.now() > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
      break;
    } finally {
      clearTimeout(timeoutId);
      params.signal?.removeEventListener("abort", abort);
    }
    }
  }

  if (params.signal?.aborted) throw new AiGatewayError("AI_TIMEOUT", "AI run deadline exceeded", true, attempts);
  const last = attempts[attempts.length - 1];
  const retryable = attempts.some((attempt) => attempt.code === "AI_TIMEOUT" || attempt.code === "AI_PROVIDER" || (attempt.code === "AI_RATE_LIMIT" && attempt.status !== 402));
  throw new AiGatewayError(last?.code || "AI_PROVIDER", "All configured AI providers failed", retryable, attempts);
}
