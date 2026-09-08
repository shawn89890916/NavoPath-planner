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

export function readLocalAiProviderConfig(): LocalAiProviderConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<LocalAiProviderConfig> | null;
    return {
      ...DEFAULT_CONFIG,
      provider: parsed?.provider === "siliconflow" || parsed?.provider === "openai-compatible" ? parsed.provider : DEFAULT_CONFIG.provider,
      apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey.trim() : "",
      baseUrl: typeof parsed?.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : DEFAULT_CONFIG.baseUrl,
      model: typeof parsed?.model === "string" && parsed.model.trim() ? parsed.model.trim() : DEFAULT_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_CONFIG, apiKey: "" };
  }
}

export function writeLocalAiProviderConfig(config: Partial<LocalAiProviderConfig>) {
  const current = readLocalAiProviderConfig();
  const next: LocalAiProviderConfig = {
    provider: config.provider === "siliconflow" || config.provider === "openai-compatible" ? config.provider : "deepseek",
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
