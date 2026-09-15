import { Bell, Copy, Ellipsis, Pencil, Plus, Search, Sparkles, Trash2, X, type LucideIcon, type LucideProps } from "lucide-react";

function createNamedIcon(Icon: LucideIcon) {
  return function NamedUiIcon({ size = 16, strokeWidth = 1.8, ...props }: LucideProps) {
    return <Icon size={size} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true} {...props} />;
  };
}

export const UiBellIcon = createNamedIcon(Bell);
export const UiCloseIcon = createNamedIcon(X);
export const UiCopyIcon = createNamedIcon(Copy);
export const UiPencilIcon = createNamedIcon(Pencil);
export const UiPlusIcon = createNamedIcon(Plus);
export const UiSearchIcon = createNamedIcon(Search);
export const UiTrashIcon = createNamedIcon(Trash2);
export const UiMoreIcon = createNamedIcon(Ellipsis);
export const UiSparklesIcon = createNamedIcon(Sparkles);

export function UiDockSidebarIcon({ size = 16, strokeWidth = 1.8, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: LucideProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props["aria-label"] ? undefined : true} {...props}>
    <path d="M5 4h14M5 20h14M12 7v10" />
    <path d="m9 10 3-3 3 3M9 14l3 3 3-3" />
  </svg>;
}
