export type LocalAiProviderConfig = {
  provider: "deepseek" | "siliconflow" | "openai" | "anthropic" | "zhipu" | "qwen" | "openai-compatible";
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type AiProviderModelOption = { id: string; zh: string; en: string };

export const AI_PROVIDER_MODELS: Record<LocalAiProviderConfig["provider"], readonly AiProviderModelOption[]> = {
  deepseek: [
    { id: "deepseek-v4-flash", zh: "DeepSeek V4 Flash", en: "DeepSeek V4 Flash" },
    { id: "deepseek-v4-pro", zh: "DeepSeek V4 Pro", en: "DeepSeek V4 Pro" },
  ],
  siliconflow: [
    { id: "deepseek-ai/DeepSeek-V4-Flash", zh: "DeepSeek V4 Flash", en: "DeepSeek V4 Flash" },
    { id: "Pro/deepseek-ai/DeepSeek-V3.2", zh: "DeepSeek V3.2 Pro", en: "DeepSeek V3.2 Pro" },
    { id: "moonshotai/Kimi-K2.7-Code", zh: "Kimi K2.7 Code", en: "Kimi K2.7 Code" },
  ],
  openai: [
    { id: "gpt-5.6-sol", zh: "GPT-5.6 Sol", en: "GPT-5.6 Sol" },
    { id: "gpt-5.6-terra", zh: "GPT-5.6 Terra", en: "GPT-5.6 Terra" },
    { id: "gpt-5.6-luna", zh: "GPT-5.6 Luna", en: "GPT-5.6 Luna" },
  ],
  anthropic: [
    { id: "claude-opus-4-8", zh: "Claude Opus 4.8", en: "Claude Opus 4.8" },
    { id: "claude-opus-4-7", zh: "Claude Opus 4.7", en: "Claude Opus 4.7" },
    { id: "claude-sonnet-5", zh: "Claude Sonnet 5", en: "Claude Sonnet 5" },
    { id: "claude-sonnet-4-6", zh: "Claude Sonnet 4.6", en: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", zh: "Claude Haiku 4.5", en: "Claude Haiku 4.5" },
  ],
  zhipu: [
    { id: "glm-5.2", zh: "GLM-5.2", en: "GLM-5.2" },
    { id: "glm-5.1", zh: "GLM-5.1", en: "GLM-5.1" },
    { id: "glm-5", zh: "GLM-5", en: "GLM-5" },
    { id: "glm-4.7", zh: "GLM-4.7", en: "GLM-4.7" },
  ],
  qwen: [
    { id: "qwen3.8-max", zh: "通义千问 3.8 Max", en: "Qwen3.8 Max" },
    { id: "qwen3.8-flash", zh: "通义千问 3.8 Flash", en: "Qwen3.8 Flash" },
    { id: "qwen3.7-max", zh: "通义千问 3.7 Max", en: "Qwen3.7 Max" },
    { id: "qwen3.7-plus", zh: "通义千问 3.7 Plus", en: "Qwen3.7 Plus" },
    { id: "qwen3.7-flash", zh: "通义千问 3.7 Flash", en: "Qwen3.7 Flash" },
  ],
  "openai-compatible": [],
};

const STORAGE_KEY = "navopath.ai-provider-config.v1";
const DEFAULT_CONFIG = {
  provider: "deepseek" as const,
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
};

export function aiProviderPreset(provider: LocalAiProviderConfig["provider"]): Partial<LocalAiProviderConfig> {
  if (provider === "deepseek") {
    return { provider, baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" };
  }
  if (provider === "siliconflow") {
    return { provider, baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V4-Flash" };
  }
  if (provider === "openai") return { provider, baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-sol" };
  if (provider === "anthropic") return { provider, baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-4-8" };
  if (provider === "zhipu") return { provider, baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.2" };
  if (provider === "qwen") return { provider, baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen3.8-max" };
  return { provider };
}

function isLocalAiProvider(value: unknown): value is LocalAiProviderConfig["provider"] {
  return value === "deepseek" || value === "siliconflow" || value === "openai" || value === "anthropic" || value === "zhipu" || value === "qwen" || value === "openai-compatible";
}

export function readLocalAiProviderConfig(): LocalAiProviderConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<LocalAiProviderConfig> | null;
    const storedBaseUrl = typeof parsed?.baseUrl === "string" ? parsed.baseUrl.trim() : "";
    const storedProvider = isLocalAiProvider(parsed?.provider) ? parsed.provider : DEFAULT_CONFIG.provider;
    const provider = storedProvider === "deepseek" && /api\.siliconflow\.cn/i.test(storedBaseUrl) ? "siliconflow" : storedProvider;
    const storedModel = typeof parsed?.model === "string" ? parsed.model.trim() : "";
    return {
      ...DEFAULT_CONFIG,
      provider,
      apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey.trim() : "",
      baseUrl: storedBaseUrl || DEFAULT_CONFIG.baseUrl,
      model: provider === "siliconflow" && storedModel === "deepseek-v4-flash" ? "deepseek-ai/DeepSeek-V4-Flash" : storedModel || DEFAULT_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_CONFIG, apiKey: "" };
  }
}

export function writeLocalAiProviderConfig(config: Partial<LocalAiProviderConfig>) {
  const current = readLocalAiProviderConfig();
  const next: LocalAiProviderConfig = {
    provider: isLocalAiProvider(config.provider) ? config.provider : current.provider,
    apiKey: typeof config.apiKey === "string" ? config.apiKey.trim() : current.apiKey,
    baseUrl: typeof config.baseUrl === "string" && config.baseUrl.trim() ? config.baseUrl.trim() : current.baseUrl,
    model: typeof config.model === "string" && config.model.trim() ? config.model.trim() : current.model,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalAiProviderConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
