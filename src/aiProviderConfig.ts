export type LocalAiProviderConfig = {
  provider: "deepseek";
  apiKey: string;
  baseUrl: string;
  model: "deepseek-v4-flash" | "deepseek-v4-pro";
};

const STORAGE_KEY = "navopath.ai-provider-config.v1";
const DEFAULT_CONFIG = {
  provider: "deepseek" as const,
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash" as const,
};

export function readLocalAiProviderConfig(): LocalAiProviderConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<LocalAiProviderConfig> | null;
    return {
      ...DEFAULT_CONFIG,
      apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey.trim() : "",
      baseUrl: typeof parsed?.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : DEFAULT_CONFIG.baseUrl,
      model: parsed?.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : DEFAULT_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_CONFIG, apiKey: "" };
  }
}

export function writeLocalAiProviderConfig(config: Partial<LocalAiProviderConfig>) {
  const current = readLocalAiProviderConfig();
  const next: LocalAiProviderConfig = {
    provider: "deepseek",
    apiKey: typeof config.apiKey === "string" ? config.apiKey.trim() : current.apiKey,
    baseUrl: typeof config.baseUrl === "string" && config.baseUrl.trim() ? config.baseUrl.trim() : current.baseUrl,
    model: config.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : config.model === "deepseek-v4-flash" ? config.model : current.model,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalAiProviderConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
