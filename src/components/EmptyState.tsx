import type { ReactNode } from "react";
import "./EmptyState.css";

export function EmptyState({ title, children, compact = false, announce = false }: {
  title: string;
  children?: ReactNode;
  compact?: boolean;
  announce?: boolean;
}) {
  return (
    <div className="df-empty-state" data-compact={compact || undefined}>
      <strong role={announce ? "status" : undefined}>{title}</strong>
      {children && <div className="df-empty-state-actions">{children}</div>}
    </div>
  );
}
