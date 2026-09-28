import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const mobileStyles = readFileSync(new URL("./app.css", import.meta.url), "utf8");

describe("portrait mobile navigation", () => {
  it("keeps task quick-add in the candidate toolbar and reserves the schedule FAB for the timeline", () => {
    expect(mainSource).toContain('className="df-mobile-dock-action df-mobile-ai"');
    expect(mainSource).toContain('className="df-mobile-quick-add-fab"');
    expect(mainSource).toContain('className="df-candidate-quick-add-top"');
    expect(mainSource).toContain('(mode !== "execute" || compactExecuteView === "schedule")');
    expect(mobileStyles).toContain(".df-candidate-quick-add-top {");
    expect(mobileStyles).toContain("min-width: 46px;");
    expect(mobileStyles).toContain("min-height: 46px;");
    expect(mobileStyles).toContain("bottom: calc(80px + env(safe-area-inset-bottom));");
  });

  it("keeps AI and Settings in dismissible task-detail-sized sheets", () => {
    expect(mobileStyles).toContain("#root .df-app .df-ai-panel-reference {");
    expect(mobileStyles).toContain("#root .df-app .df-utility-panel {");
    expect(mobileStyles).toContain("inset: 4dvh 0 0;");
    expect(mobileStyles).toContain("border-radius: 18px 18px 0 0;");
  });

  it("uses an iOS-sized switch while keeping the active theme accent", () => {
    expect(mobileStyles).toContain("width: 51px;");
    expect(mobileStyles).toContain("height: 31px;");
    expect(mobileStyles).toContain("background: var(--accent-active);");
  });
});
