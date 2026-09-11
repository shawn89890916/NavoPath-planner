import { Bell, Bot, CalendarDays, ChevronRight, Copy, Languages, Monitor, Palette, Pencil, Plus, Search, Settings2, Sun, Trash2, UserRound, Workflow, X, type LucideIcon, type LucideProps } from "lucide-react";

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
export const UiBotIcon = createNamedIcon(Bot);
export const UiCalendarIcon = createNamedIcon(CalendarDays);
export const UiChevronRightIcon = createNamedIcon(ChevronRight);
export const UiLanguagesIcon = createNamedIcon(Languages);
export const UiMonitorIcon = createNamedIcon(Monitor);
export const UiPaletteIcon = createNamedIcon(Palette);
export const UiSettingsIcon = createNamedIcon(Settings2);
export const UiSunIcon = createNamedIcon(Sun);
export const UiUserIcon = createNamedIcon(UserRound);
export const UiWorkflowIcon = createNamedIcon(Workflow);
