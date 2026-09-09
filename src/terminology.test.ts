import { describe, expect, it } from "vitest";
import type { Language } from "./types";
import { TERM_CATALOG, term, type TermKey } from "./terminology";

describe("product terminology", () => {
  it("keeps every term bilingual and complete", () => {
    for (const [key, value] of Object.entries(TERM_CATALOG) as [TermKey, (typeof TERM_CATALOG)[TermKey]][]) {
      expect(value.zh, key).toBeTruthy();
      expect(value.en, key).toBeTruthy();
      expect(value.definition, key).toBeTruthy();
      expect(value.example, key).toBeTruthy();
      expect(value.avoid.length, key).toBeGreaterThan(0);
    }
  });

  it("returns the canonical label for both supported languages", () => {
    expect(term("zh" as Language, "todayCandidates")).toBe("今日候选");
    expect(term("en" as Language, "todayCandidates")).toBe("Today's Candidates");
    expect(term("zh" as Language, "complete")).toBe("完成");
    expect(term("en" as Language, "done")).toBe("Done");
  });
});
