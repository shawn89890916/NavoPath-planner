import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationBadge } from "./NotificationBadge";

describe("notification badge", () => {
  it("hides unread counts when the badge preference is disabled", () => {
    expect(renderToStaticMarkup(<NotificationBadge count={12} enabled={false} />)).toBe("");
    expect(renderToStaticMarkup(<NotificationBadge count={0} />)).toBe("");
  });

  it.each([[1, "1"], [9, "9"], [10, "9+"], [50, "9+"]])("formats %i unread notifications", (count, label) => {
    const markup = renderToStaticMarkup(<NotificationBadge count={count} />);
    expect(markup).toContain(`>${label}</span>`);
    expect(markup).toContain('aria-hidden="true"');
  });
});
