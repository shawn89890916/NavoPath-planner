import { expect, it } from "vitest";
import { formatVersionLabel } from "./versionLabel";

it("displays Beta versions with the product label while preserving stable versions", () => {
  expect(formatVersionLabel("1.5.2-beta.1")).toBe("1.5.2 Beta 1");
  expect(formatVersionLabel("1.5.2-beta.12")).toBe("1.5.2 Beta 12");
  expect(formatVersionLabel("1.5.2")).toBe("1.5.2");
  expect(formatVersionLabel("1.6.4-alpha.1")).toBe("1.6 Alpha 1");
  expect(formatVersionLabel("1.6.4-beta.1")).toBe("1.6.4 Beta 1");
});
