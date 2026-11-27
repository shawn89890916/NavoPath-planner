import { useState } from "react";
import {
  UiCalendarCheckIcon, UiCalendarDaysIcon, UiCloudSunIcon,
  UiKanbanIcon, UiLayoutTemplateIcon, UiListIcon, UiMatrixIcon,
  UiMetricsIcon, UiPuzzleIcon, UiTimerIcon, UiZapIcon,
} from "../components/UiIcons";
import { OFFICIAL_SOURCE } from "./packages";
import type { CatalogEntry } from "./types";

const officialIcons = new Map<string, typeof UiListIcon>([
  ["class-timetable", UiCalendarDaysIcon],
  ["daily-overview", UiCalendarCheckIcon],
  ["kanban", UiKanbanIcon],
  ["list", UiListIcon],
  ["matrix", UiMatrixIcon],
  ["metrics", UiMetricsIcon],
  ["pomodoro", UiTimerIcon],
  ["quick-capture", UiZapIcon],
  ["schedule-templates", UiLayoutTemplateIcon],
  ["weather", UiCloudSunIcon],
]);

export function PluginMarketIdentity({ entry }: { entry: CatalogEntry }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const { iconUrl, manifest, sourceId } = entry;
  const Icon = (sourceId === OFFICIAL_SOURCE.id && officialIcons.get(manifest.id)) || UiPuzzleIcon;
  return <span className="df-extension-plugin-icon" aria-hidden="true">
    {iconUrl && iconUrl !== failedUrl
      ? <img src={iconUrl} alt="" loading="lazy" onError={() => setFailedUrl(iconUrl)} />
      : <Icon size={24} />}
  </span>;
}
