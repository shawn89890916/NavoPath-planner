import type { Language } from "../types";
import type { CSSProperties } from "react";
import { UiPlusIcon } from "./UiIcons";

type Props = {
  compactLayout: boolean;
  productPresentation: boolean;
  drawerOpen: boolean;
  notificationCenterOpen: boolean;
  cloudWorkspace: boolean;
  utilityPanelOpen: boolean;
  aiOpen: boolean;
  lang: Language;
  style?: CSSProperties;
  onAdd: () => void;
};

export function MobileQuickAddButton(props: Props) {
  if (!props.compactLayout || props.productPresentation || props.drawerOpen
    || (props.notificationCenterOpen && props.cloudWorkspace) || props.utilityPanelOpen || props.aiOpen) return null;
  const label = props.lang === "zh" ? "快速添加任务" : "Quick add task";
  return <button type="button" className="df-mobile-quick-add-fab" style={props.style} aria-label={label} title={label} onClick={props.onAdd}>
    <UiPlusIcon size={20} />
  </button>;
}
