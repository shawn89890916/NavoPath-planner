import { Bell, ChartNoAxesColumn, Columns3, Grid2X2, List, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Ellipsis, ListChecks, PanelLeftClose, PanelLeftOpen, Pencil, Plus, RotateCw, Search, Settings, Sparkles, Trash2, X, Zap, type LucideIcon, type LucideProps } from "lucide-react";

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
export const UiChevronUpIcon = createNamedIcon(ChevronUp);
export const UiChevronDownIcon = createNamedIcon(ChevronDown);
export const UiChevronLeftIcon = createNamedIcon(ChevronLeft);
export const UiChevronRightIcon = createNamedIcon(ChevronRight);
export const UiSearchIcon = createNamedIcon(Search);
export const UiSettingsIcon = createNamedIcon(Settings);
export const UiTrashIcon = createNamedIcon(Trash2);
export const UiMoreIcon = createNamedIcon(Ellipsis);
export const UiSparklesIcon = createNamedIcon(Sparkles);
export const UiMetricsIcon = createNamedIcon(ChartNoAxesColumn);
export const UiKanbanIcon = createNamedIcon(Columns3);
export const UiMatrixIcon = createNamedIcon(Grid2X2);
export const UiListIcon = createNamedIcon(List);
export const UiListChecksIcon = createNamedIcon(ListChecks);
export const UiPanelLeftCloseIcon = createNamedIcon(PanelLeftClose);
export const UiPanelLeftOpenIcon = createNamedIcon(PanelLeftOpen);
export const UiRefreshIcon = createNamedIcon(RotateCw);
export const UiZapIcon = createNamedIcon(Zap);
function createPathIcon(path: string) {
  return function PathIcon({ size = 16, strokeWidth = 1.8, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: LucideProps) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props["aria-label"] ? undefined : true} {...props}><path d={path} /></svg>;
  };
}

export const UiInfoIcon = createPathIcon("M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 16v-4m0-4h.01");
export const UiEyeIcon = createPathIcon("M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z");
export const UiCalendarCheckIcon = createPathIcon("M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 10 2 2 5-5");
export const UiCalendarClockIcon = createPathIcon("M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v4M4 9v11h7m5-7v4l2 1m3-1a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z");
export const UiFilterIcon = createPathIcon("M4 6h16M7 12h10m-7 6h4");
export const UiFlagIcon = createPathIcon("M5 21V4m0 0h11l-2 4 2 4H5");
export const UiFolderInputIcon = createPathIcon("M3 7h7l2 2h9v10H3V7Zm7 7h6m-2-2 2 2-2 2");
export const UiReturnIcon = createPathIcon("m8 7-4 4 4 4m-4-4h10a6 6 0 0 1 6 6");
export const UiCursorIcon = createPathIcon("M4 3v17l4-4 4 7 4-2-4-7h6L4 3Z");
export const UiPointingHandIcon = createPathIcon("M9 14V4a2 2 0 0 1 4 0v7m0-1a2 2 0 0 1 4 0v2m0-1a2 2 0 0 1 4 0v6a5 5 0 0 1-5 5h-4a5 5 0 0 1-4-2l-4-5a2 2 0 0 1 3-2l3 3");

export function UiDockSidebarIcon({ size = 16, strokeWidth = 1.8, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: LucideProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props["aria-label"] ? undefined : true} {...props}>
    <path d="M5 4h14M5 20h14M12 7v10" />
    <path d="m9 10 3-3 3 3M9 14l3 3 3-3" />
  </svg>;
}

export function UiDockLeftIcon({ size = 20, strokeWidth = 1.8, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: LucideProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props["aria-label"] ? undefined : true} {...props}>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M9 4v16m8-11-3 3 3 3" />
  </svg>;
}

export function UiDockRightIcon({ size = 20, strokeWidth = 1.8, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: LucideProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={props["aria-label"] ? undefined : true} {...props}>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M15 4v16M7 9l3 3-3 3" />
  </svg>;
}
