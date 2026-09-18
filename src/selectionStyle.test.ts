import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(__dirname, "main.tsx"), "utf8");
const planning = readFileSync(resolve(__dirname, "PlanningView.tsx"), "utf8");
const primitives = readFileSync(resolve(__dirname, "ui-primitives.css"), "utf8");
const appCss = readFileSync(resolve(__dirname, "app.css"), "utf8");
const notificationCss = readFileSync(resolve(__dirname, "components/ProactiveNotificationCenter.css"), "utf8");

describe("shared option-list visual contract", () => {
  it("uses a complete neutral rounded selection instead of a partial underline", () => {
    expect(primitives).toContain(".ui-choice-list.ui-choice-list > .ui-choice-item:is(.active, [aria-current=\"page\"], [aria-selected=\"true\"], [aria-pressed=\"true\"])");
    expect(primitives).toContain("background: var(--ui-choice-selected);");
    expect(primitives).toContain("border-radius: 12px;");
  });

  it("applies the shared option treatment to Settings and Planning", () => {
    expect(main).toContain('className="df-settings-nav ui-choice-list"');
    expect(main).toContain("df-settings-subtabs ui-choice-list ui-choice-list--inline");
    expect(planning).toContain('className="df-planning-view-switch ui-choice-list ui-choice-list--bare"');
    expect(planning).toContain("df-view-btn ui-choice-item");
  });

  it("keeps light application surfaces on the timeline paper color", () => {
    expect(main).toContain('\"--surface-main\": \"#F8F7F3\"');
    expect(main).toContain('\"--timeline-paper\": \"#F8F7F3\"');
    expect(main).not.toContain('\"--surface-main\": \"#FBF9FF\"');
    expect(appCss).toMatch(/\.df-command-palette\s*\{[\s\S]*?background:\s*var\(--timeline-paper, var\(--surface-main\)\)/);
    expect(notificationCss).toContain("background: var(--timeline-paper, var(--surface-main));");
  });
});
