export function NotificationBadge({ count, enabled = true }: { count: number; enabled?: boolean }) {
  if (!enabled || count <= 0) return null;
  return <span className="df-proactive-notification-count" aria-hidden="true">{count > 9 ? "9+" : count}</span>;
}
