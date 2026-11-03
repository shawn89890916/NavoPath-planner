import { describe, expect, it } from "vitest";
import fs from "node:fs";

const main = fs.readFileSync(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("./components/AiProviderSettings.tsx", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("./components/SettingsControls.tsx", import.meta.url), "utf8");
const settingsCss = fs.readFileSync(new URL("./components/SettingsControls.css", import.meta.url), "utf8");

describe("AI provider settings layout", () => {
  it("uses the shared stacked row and a landscape field grid", () => {
    expect(main).toContain('<SettingRow layout="stacked" anchor="ai-provider"');
    expect(controls).toContain('layout?: "default" | "stacked";');
    expect(settingsCss).toContain(".df-settings-row.df-settings-row--stacked");
    expect(settingsCss).toMatch(/\.df-settings-row--stacked \.df-ai-provider-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  });

  it("shows GLM without the old Zhipu label", () => {
    expect(provider).toContain('zhipu: "GLM"');
    expect(provider).not.toContain('"Zhipu GLM"');
    expect(provider).not.toContain("智谱 GLM");
  });
});
