import { term } from "../terminology";
import type { Language } from "../types";
import type { ReactNode } from "react";

export function WorkspaceModeTabs({ mode, lang, onChange, onAi, onPlanningIntent, className = "df-tabs", as = "nav", children }: {
  mode: "planning" | "execute" | "ai";
  lang: Language;
  onChange: (mode: "planning" | "execute") => void;
  onAi?: () => void;
  onPlanningIntent?: () => void;
  className?: string;
  as?: "nav" | "div";
  children?: ReactNode;
}) {
  const Container = as;
  return <Container className={className}>
    {(["execute", "planning"] as const).map((value) => <button key={value} type="button" className={mode === value ? "active" : ""} aria-pressed={mode === value} onPointerEnter={value === "planning" ? onPlanningIntent : undefined} onFocus={value === "planning" ? onPlanningIntent : undefined} onClick={() => onChange(value)}>{term(lang, value)}</button>)}
    {onAi && <button type="button" className={mode === "ai" ? "active" : ""} aria-pressed={mode === "ai"} onClick={onAi}>Navo AI</button>}
    {children}
  </Container>;
}
