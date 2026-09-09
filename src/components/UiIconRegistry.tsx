import { Cherry, MoreHorizontal, Pause, Pin, PinOff, Play, RotateCcw, Sprout, X, type LucideIcon, type LucideProps } from "lucide-react";

export type UiIconName = "cherry" | "close" | "more" | "pause" | "pin" | "pin-off" | "play" | "reset" | "sprout";

const UI_ICONS: Record<UiIconName, LucideIcon> = {
  cherry: Cherry,
  close: X,
  more: MoreHorizontal,
  pause: Pause,
  pin: Pin,
  "pin-off": PinOff,
  play: Play,
  reset: RotateCcw,
  sprout: Sprout,
};

export function UiIcon({ name, size = 16, strokeWidth = 1.8, ...props }: LucideProps & { name: UiIconName }) {
  const Icon = UI_ICONS[name];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true} {...props} />;
}
