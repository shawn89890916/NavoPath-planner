import { describe, expect, it } from "vitest";
import fs from "node:fs";

const main = fs.readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("./components/SettingsControls.tsx", import.meta.url), "utf8");
const appCss = fs.readFileSync(new URL("./app.css", import.meta.url), "utf8");

describe("AI provider settings layout", () => {
  it("uses the shared stacked row and a landscape field grid", () => {
    expect(main).toContain('<SettingRow layout="stacked" anchor="ai-provider"');
    expect(controls).toContain('layout?: "default" | "stacked";');
    expect(appCss).toContain(".df-settings-row.df-settings-row--stacked");
    expect(appCss).toMatch(/\.df-settings-row--stacked \.df-ai-provider-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  });

  it("shows GLM without the old Zhipu label", () => {
    expect(main).toContain('zhipu: "GLM"');
    expect(main).not.toContain('"Zhipu GLM"');
    expect(main).not.toContain("智谱 GLM");
  });
});
