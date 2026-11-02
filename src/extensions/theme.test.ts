import { afterEach, describe, expect, it, vi } from "vitest";
import { applyExtensionTheme } from "./theme";
import type { ExtensionPackage } from "./types";

afterEach(() => vi.unstubAllGlobals());

describe("community theme resources and options", () => {
  it("resolves package assets, clamps options, and removes all resources on unload", () => {
    const appended: any[] = [];
    vi.stubGlobal("document", {
      createElement: () => ({ dataset: {}, textContent: "", remove: vi.fn() }),
      head: { append: (...nodes: any[]) => appended.push(...nodes) },
    });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:theme-texture");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const pkg: ExtensionPackage = {
      manifest: { id: "paper", kind: "theme", name: "Paper", description: "Paper", author: "Test", version: "1.0.0", apiVersion: 1, minAppVersion: "1.0.0", platforms: ["web"], styles: "css/theme.css", options: [
        { key: "scale", label: "Scale", type: "number", variable: "--paper-scale", default: 1, min: 0.5, max: 2 },
        { key: "ink", label: "Ink", type: "color", variable: "--paper-ink", default: "#27231E" },
      ] },
      files: { "css/theme.css": { encoding: "utf8", data: '.df-app { background: url("../assets/paper.svg"); }' }, "assets/paper.svg": { encoding: "utf8", data: "<svg/>" } },
    };
    const dispose = applyExtensionTheme(pkg, { scale: 99, ink: "red;}body{display:none" });
    expect(create).toHaveBeenCalledOnce();
    expect(appended[0].textContent).toContain('url("blob:theme-texture")');
    expect(appended[1].textContent).toContain("--paper-scale:2");
    expect(appended[1].textContent).toContain("--paper-ink:#27231E");
    dispose();
    expect(appended.every((node) => node.remove.mock.calls.length === 1)).toBe(true);
    expect(revoke).toHaveBeenCalledWith("blob:theme-texture");
    create.mockRestore(); revoke.mockRestore();
  });

  it("does not inject anything for the default theme", () => {
    const append = vi.fn();
    vi.stubGlobal("document", { head: { append } });
    applyExtensionTheme(null, {})();
    expect(append).not.toHaveBeenCalled();
  });
});
