import { beforeEach, describe, expect, it, vi } from "vitest";
import { readLocalAiProviderConfig, writeLocalAiProviderConfig } from "./aiProviderConfig";

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
});
