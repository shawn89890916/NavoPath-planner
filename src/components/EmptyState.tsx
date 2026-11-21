import type { ReactNode } from "react";
import "./EmptyState.css";

export function EmptyState({ title, description, children, compact = false, announce = false }: {
  title: string;
  description?: string;
  children?: ReactNode;
  compact?: boolean;
  announce?: boolean;
}) {
  return (
    <div className="df-empty-state" data-compact={compact || undefined}>
      <div className="df-empty-state-copy" role={announce ? "status" : undefined}>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="df-empty-state-actions">{children}</div>}
    </div>
  );
}
