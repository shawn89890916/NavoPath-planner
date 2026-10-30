import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("./WorkspacePresentation", () => ({ ProductIcon: () => null }));
import AuthGate from "./AuthGate";
import { t } from "./i18n";

const props = { busy: false, error: "", notice: { type: "confirm-email" as const, email: "test@example.invalid" }, onSubmit: vi.fn(async () => {}), onResend: vi.fn(async () => {}), onContinueAfterConfirm: vi.fn(async () => {}) };
describe("authentication copy", () => {
  beforeAll(() => vi.stubGlobal("location", { protocol: "https:" }));
  afterAll(() => vi.unstubAllGlobals());
  it("renders English labels and policy consent without Chinese fallbacks", () => {
    const html = renderToStaticMarkup(createElement(AuthGate, { ...props, lang: "en" }));
    expect(html).toContain(t("en", "auth.emailSent"));
    expect(html).toContain("Privacy Policy");
    expect(html).not.toMatch(/[\u3400-\u9fff]/);
    expect(html).toMatch(/class="df-auth-submit"[^>]*disabled/);
    expect(html).not.toMatch(/name="privacy-consent"[^>]*checked/);
  });
  it("uses the supplied Chinese confirmation copy", () => {
    const html = renderToStaticMarkup(createElement(AuthGate, { ...props, lang: "zh" }));
    expect(html).toContain("确认邮件已发送至");
    expect(html).toContain("完成验证后再登录");
    expect(html).toContain("《隐私政策》");
  });
  it("keeps the reset confirmation label separate from registration", () => {
    expect(t("zh", "auth.confirmPassword")).toBe("确认密码");
    expect(t("zh", "auth.confirmNewPassword")).toBe("确认新密码");
  });
});
