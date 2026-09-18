import { requestProactiveNotificationPermission } from "./proactiveAssistant";

const PENDING_EMAIL_KEY = "navopath.web-notification-onboarding.pending-email";
const REQUESTED_USER_KEY_PREFIX = "navopath.web-notification-onboarding.requested:";

type NotificationUser = { id: string; email?: string };

function normalizedEmail(email?: string) {
  return email?.trim().toLowerCase() || "";
}

function storage() {
  try { return typeof localStorage === "undefined" ? null : localStorage; }
  catch { return null; }
}

function requestedKey(userId: string) {
  return `${REQUESTED_USER_KEY_PREFIX}${userId}`;
}

export function rememberNewUserNotificationRequest(email: string) {
  const value = normalizedEmail(email);
  if (!value) return;
  try { storage()?.setItem(PENDING_EMAIL_KEY, value); } catch { /* Keep account creation available without storage. */ }
}

export function hasPendingNewUserNotificationRequest(user: NotificationUser) {
  const store = storage();
  if (!store || !user.id || store.getItem(requestedKey(user.id))) return false;
  const pendingEmail = normalizedEmail(store.getItem(PENDING_EMAIL_KEY) || undefined);
  return Boolean(pendingEmail && pendingEmail === normalizedEmail(user.email));
}

export type NewUserNotificationRequestResult = NotificationPermission | "unsupported" | "not-pending" | "waiting-for-gesture";

export async function requestPendingNewUserNotification(
  user: NotificationUser,
  options: { requireActiveGesture?: boolean } = {},
): Promise<NewUserNotificationRequestResult> {
  if (!hasPendingNewUserNotificationRequest(user)) return "not-pending";
  if (typeof window !== "undefined" && window.desktopApi) return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";

  const activation = typeof navigator === "undefined" ? undefined : navigator.userActivation;
  if (Notification.permission === "default" && options.requireActiveGesture && activation && !activation.isActive) {
    return "waiting-for-gesture";
  }

  const store = storage();
  try {
    store?.setItem(requestedKey(user.id), new Date().toISOString());
    store?.removeItem(PENDING_EMAIL_KEY);
    return await requestProactiveNotificationPermission();
  } catch (error) {
    try {
      store?.removeItem(requestedKey(user.id));
      store?.setItem(PENDING_EMAIL_KEY, normalizedEmail(user.email));
    } catch { /* A later manual settings action remains available. */ }
    throw error;
  }
}

export function watchForNewUserNotification(user: NotificationUser) {
  let active = true;
  let listening = false;
  let cleanup = () => undefined;
  const attempt = (requireActiveGesture: boolean) => {
    void requestPendingNewUserNotification(user, { requireActiveGesture }).then((result) => {
      if (active && result === "waiting-for-gesture" && !listening) {
        listening = true;
        const request = () => {
          cleanup();
          void requestPendingNewUserNotification(user).catch(() => undefined);
        };
        cleanup = () => {
          if (!listening) return;
          listening = false;
          window.removeEventListener("pointerdown", request, true);
          window.removeEventListener("keydown", request, true);
        };
        window.addEventListener("pointerdown", request, { capture: true, once: true });
        window.addEventListener("keydown", request, { capture: true, once: true });
      }
    }).catch(() => undefined);
  };
  attempt(true);
  return () => { active = false; cleanup(); };
}
