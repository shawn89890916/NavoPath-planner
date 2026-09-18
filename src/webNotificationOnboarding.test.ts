import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasPendingNewUserNotificationRequest,
  rememberNewUserNotificationRequest,
  requestPendingNewUserNotification,
} from "./webNotificationOnboarding";

describe("new-user web notification onboarding", () => {
  const user = { id: "new-user", email: "new@example.com" };
  let values: Map<string, string>;
  let requestPermission: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    values = new Map<string, string>();
    requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
  });

  it("requests once for the account created with the pending email", async () => {
    rememberNewUserNotificationRequest(" NEW@example.com ");

    expect(hasPendingNewUserNotificationRequest(user)).toBe(true);
    await expect(requestPendingNewUserNotification(user)).resolves.toBe("granted");
    await expect(requestPendingNewUserNotification(user)).resolves.toBe("not-pending");
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("does not prompt an older or different account", async () => {
    rememberNewUserNotificationRequest("another@example.com");

    await expect(requestPendingNewUserNotification(user)).resolves.toBe("not-pending");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("waits for a fresh browser gesture when the login request has lost activation", async () => {
    rememberNewUserNotificationRequest(user.email);
    vi.stubGlobal("navigator", { userActivation: { isActive: false } });

    await expect(requestPendingNewUserNotification(user, { requireActiveGesture: true })).resolves.toBe("waiting-for-gesture");
    expect(hasPendingNewUserNotificationRequest(user)).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
