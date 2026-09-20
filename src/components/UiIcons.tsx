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
function createPathIcon(path: string) {
  return function PathIcon({ size = 16, strokeWidth = 1.8, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: LucideProps) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props["aria-label"] ? undefined : true} {...props}><path d={path} /></svg>;
  };
}

export const UiCalendarCheckIcon = createPathIcon("M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 10 2 2 5-5");
export const UiCalendarClockIcon = createPathIcon("M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v4M4 9v11h7m5-7v4l2 1m3-1a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z");
export const UiFlagIcon = createPathIcon("M5 21V4m0 0h11l-2 4 2 4H5");
export const UiFolderInputIcon = createPathIcon("M3 7h7l2 2h9v10H3V7Zm7 7h6m-2-2 2 2-2 2");
export const UiReturnIcon = createPathIcon("m8 7-4 4 4 4m-4-4h10a6 6 0 0 1 6 6");

export function UiDockSidebarIcon({ size = 16, strokeWidth = 1.8, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: LucideProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props["aria-label"] ? undefined : true} {...props}>
    <path d="M5 4h14M5 20h14M12 7v10" />
    <path d="m9 10 3-3 3 3M9 14l3 3 3-3" />
  </svg>;
}
