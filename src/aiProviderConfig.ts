export type LocalAiProviderConfig = {
  provider: "deepseek" | "siliconflow" | "openai-compatible";
  apiKey: string;
  baseUrl: string;
  model: string;
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
  return { provider };
}

export function readLocalAiProviderConfig(): LocalAiProviderConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<LocalAiProviderConfig> | null;
    const storedBaseUrl = typeof parsed?.baseUrl === "string" ? parsed.baseUrl.trim() : "";
    const storedProvider = parsed?.provider === "siliconflow" || parsed?.provider === "openai-compatible" ? parsed.provider : DEFAULT_CONFIG.provider;
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
    provider: config.provider === "deepseek" || config.provider === "siliconflow" || config.provider === "openai-compatible" ? config.provider : current.provider,
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
