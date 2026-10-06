import { describe, expect, it } from "vitest";
import {
  featureHref,
  isDemoCommand,
  productFeature,
  principleRoute,
  principleHref,
  PRINCIPLES,
  siteLanguage,
} from "./productSite";

describe("product site routing and protocol", () => {
  it("keeps principle articles separate from feature and demo routes", () => {
    expect(principleRoute("/principles/")).toBe("index");
    for (const topic of PRINCIPLES) {
      expect(principleRoute(`/principles/${topic}/`)).toBe(topic);
      expect(principleHref(topic, "zh")).toBe(`/principles/${topic}?lang=zh`);
      expect(productFeature(`/product-demo/${topic}`, "product-demo")).toBeNull();
    }
    expect(principleHref("index", "en")).toBe("/principles?lang=en");
    for (const path of ["/principles/unknown", "/principles/jev/extra", "/other/jev", "/app", "/principles//jev"]) expect(principleRoute(path)).toBeNull();
  });
  it("routes only the published feature and internal demo paths", () => {
    expect(productFeature("/features/planning", "features")).toBe("planning");
    expect(productFeature("/features/execute/", "features")).toBe("execute");
    expect(productFeature("/product-demo/ai", "product-demo")).toBe("ai");
    for (const path of [
      "/app",
      "/features",
      "/features/habits",
      "/features/ai/other",
      "/other/ai",
    ]) {
      expect(productFeature(path, "features")).toBeNull();
    }
  });

  it("uses a valid language parameter before the browser language", () => {
    expect(siteLanguage("?lang=en", "zh-CN")).toBe("en");
    expect(siteLanguage("?lang=zh", "en-US")).toBe("zh");
    expect(siteLanguage("?lang=unknown", "zh-TW")).toBe("zh");
    expect(siteLanguage("", "fr-FR")).toBe("en");
    expect(featureHref("ai", "zh")).toBe("/features/ai?lang=zh");
  });

  it("rejects unexpected commands and malformed stages", () => {
    const valid = {
      channel: "navopath-product-demo",
      type: "stage",
      stage: 2,
      lang: "en",
    };
    expect(isDemoCommand(valid)).toBe(true);
    for (const invalid of [
      null,
      {},
      { ...valid, channel: "other" },
      { ...valid, type: "apply" },
      { ...valid, stage: -1 },
      { ...valid, stage: 4 },
      { ...valid, stage: 1.5 },
      { ...valid, lang: "fr" },
      { ...valid, type: "visibility" },
    ]) {
      expect(isDemoCommand(invalid)).toBe(false);
    }
    expect(
      isDemoCommand({ ...valid, type: "visibility", visible: false }),
    ).toBe(true);
  });
});
