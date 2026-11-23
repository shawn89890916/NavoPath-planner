import { describe, expect, it } from "vitest";
import { localizeChangelog, resolveChangelogLanguage } from "./ChangelogPage";

describe("localizeChangelog", () => {
  const source = [
    "# NavoPath 更新日志",
    "## 2026-11-23",
    "### 1.7.0 Beta 66",
    "- 中文更新",
    "# NavoPath Changelog",
    "## 2026-11-23",
    "### 1.7.0 Beta 66",
    "- English update",
    "# NavoPath Changelog",
    "## 2026-08-30 · 中文归档",
    "- 中文历史",
    "## 2026-08-30 · English archive",
    "- English history",
    "## 本轮补充 / Current update",
    "### 新增",
    "- 中文补充",
    "### Added",
    "- English supplement",
  ].join("\n");

  it("renders date headings in their own language and retains mixed-language archives", () => {
    const zh = localizeChangelog(source, "zh");
    expect(zh).toContain("## 2026-11-23\n\n### 1.7.0 Beta 66\n- 中文更新");
    expect(zh).toContain("## 2026-08-30 · 中文归档");
    expect(zh).toContain("## 历史补充记录\n\n### 新增\n- 中文补充");
    expect(zh).not.toContain("English");

    const en = localizeChangelog(source, "en");
    expect(en).toContain("## 2026-11-23\n\n### 1.7.0 Beta 66\n- English update");
    expect(en).toContain("## 2026-08-30 · English archive");
    expect(en).toContain("## Earlier updates\n\n### Added\n- English supplement");
    expect(en).not.toContain("中文");
    expect(en.match(/^# NavoPath Changelog$/gm)).toHaveLength(1);
  });
});

function createStorage(entries: Record<string, string>) {
  const keys = Object.keys(entries);
  return {
    get length() {
      return keys.length;
    },
    key(index: number) {
      return keys[index] ?? null;
    },
    getItem(key: string) {
      return entries[key] ?? null;
    },
  };
}

describe("resolveChangelogLanguage", () => {
  it("uses an explicit supported query language without reading storage", () => {
    const storage = {
      get length(): number {
        throw new Error("storage unavailable");
      },
      key: () => null,
      getItem: () => null,
    };

    expect(resolveChangelogLanguage("?lang=en", storage, "zh-CN")).toBe("en");
  });

  it("ignores malformed entries and selects the newest valid account cache", () => {
    const storage = createStorage({
      "navopath-bootstrap:broken": "{",
      "navopath-bootstrap:older": JSON.stringify({
        savedAt: "2026-07-01T08:00:00.000Z",
        settings: { language: "en" },
      }),
      "navopath-bootstrap:newer": JSON.stringify({
        savedAt: "2026-07-02T08:00:00.000Z",
        settings: { language: "zh" },
      }),
    });

    expect(resolveChangelogLanguage("", storage, "en-US")).toBe("zh");
  });

  it("uses preview settings when account caches are malformed", () => {
    const storage = createStorage({
      "navopath-bootstrap:broken": "not-json",
      "planner-preview-settings": JSON.stringify({ language: "en" }),
    });

    expect(resolveChangelogLanguage("", storage, "zh-CN")).toBe("en");
  });

  it("falls back to the browser language when storage cannot be read", () => {
    const storage = {
      get length(): number {
        throw new Error("storage unavailable");
      },
      key: () => null,
      getItem: () => {
        throw new Error("storage unavailable");
      },
    };

    expect(resolveChangelogLanguage("", storage, "zh-Hans")).toBe("zh");
    expect(resolveChangelogLanguage("", storage, "fr-FR")).toBe("en");
  });
});
