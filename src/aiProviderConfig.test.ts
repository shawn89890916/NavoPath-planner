import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiProviderPreset, readLocalAiProviderConfig, writeLocalAiProviderConfig } from "./aiProviderConfig";

describe("local AI provider configuration", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it.each(["siliconflow", "openai-compatible"] as const)(
    "keeps %s selected when individual fields are edited",
    (provider) => {
      writeLocalAiProviderConfig({
        provider,
        apiKey: "initial-key",
        baseUrl: "https://provider.test/v1",
        model: "initial-model",
      });

      writeLocalAiProviderConfig({ apiKey: "updated-key" });
      writeLocalAiProviderConfig({ model: "updated-model" });

      expect(readLocalAiProviderConfig()).toEqual({
        provider,
        apiKey: "updated-key",
        baseUrl: "https://provider.test/v1",
        model: "updated-model",
      });
    },
  );

  it("uses the SiliconFlow endpoint and model identifier together", () => {
    expect(aiProviderPreset("siliconflow")).toEqual({
      provider: "siliconflow",
      baseUrl: "https://api.siliconflow.cn/v1",
      model: "deepseek-ai/DeepSeek-V4-Flash",
    });
  });

  it("migrates the provider state saved by the earlier SiliconFlow settings bug", () => {
    localStorage.setItem("navopath.ai-provider-config.v1", JSON.stringify({
      provider: "deepseek",
      apiKey: "existing-key",
      baseUrl: "https://api.siliconflow.cn/v1",
      model: "deepseek-v4-flash",
    }));

    expect(readLocalAiProviderConfig()).toMatchObject({
      provider: "siliconflow",
      model: "deepseek-ai/DeepSeek-V4-Flash",
    });
  });
});
