import { describe, expect, it } from "vitest";
import {
  featureHref,
  isDemoVisibility,
  legacyFeatureRoute,
  productDemoRoute,
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
      expect(productDemoRoute(`/product-demo/${topic}`)).toBeNull();
    }
    expect(principleHref("index", "en")).toBe("/principles?lang=en");
    for (const path of ["/principles/unknown", "/principles/jev/extra", "/other/jev", "/app", "/principles//jev"]) expect(principleRoute(path)).toBeNull();
  });
  it("routes only the published feature and internal demo paths", () => {
    expect(productFeature("/features/workspace")).toBe("workspace");
    expect(productFeature("/features/plugins/")).toBe("plugins");
    expect(productDemoRoute("/product-demo/workspace")).toBe("workspace");
    expect(productDemoRoute("/product-demo/ai")).toBe("ai");
    expect(productDemoRoute("/product-demo/plugins")).toBeNull();
    expect(legacyFeatureRoute("/features/planning")).toBe(true);
    expect(legacyFeatureRoute("/features/execute/")).toBe(true);
    expect(legacyFeatureRoute("/features/workspace")).toBe(false);
    for (const path of [
      "/app",
      "/features",
      "/features/habits",
      "/features/ai/other",
      "/other/ai",
    ]) {
      expect(productFeature(path)).toBeNull();
    }
  });

  it("uses a valid language parameter before the browser language", () => {
    expect(siteLanguage("?lang=en", "zh-CN")).toBe("en");
    expect(siteLanguage("?lang=zh", "en-US")).toBe("zh");
    expect(siteLanguage("?lang=unknown", "zh-TW")).toBe("zh");
    expect(siteLanguage("", "fr-FR")).toBe("en");
    expect(featureHref("ai", "zh")).toBe("/features/ai?lang=zh");
  });

  it("only accepts boolean visibility messages from the demo channel", () => {
    const valid = { channel: "navopath-product-demo", type: "visibility", visible: false };
    expect(isDemoVisibility(valid)).toBe(true);
    expect(isDemoVisibility({ ...valid, visible: true })).toBe(true);
    for (const invalid of [null, {}, { ...valid, channel: "other" }, { ...valid, type: "reset" }, { ...valid, visible: "false" }]) {
      expect(isDemoVisibility(invalid)).toBe(false);
    }
  });
});
