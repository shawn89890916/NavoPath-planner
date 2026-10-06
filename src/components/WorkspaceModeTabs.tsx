import { term } from "../terminology";
import type { Language } from "../types";
import type { ReactNode } from "react";

export function WorkspaceModeTabs({ mode, lang, onChange, onAi, className = "df-tabs", as = "nav", children }: {
  mode: "planning" | "execute" | "ai";
  lang: Language;
  onChange: (mode: "planning" | "execute") => void;
  onAi?: () => void;
  className?: string;
  as?: "nav" | "div";
  children?: ReactNode;
}) {
  const Container = as;
  return <Container className={className}>
    {(["execute", "planning"] as const).map((value) => <button key={value} type="button" className={mode === value ? "active" : ""} aria-pressed={mode === value} onClick={() => onChange(value)}>{term(lang, value)}</button>)}
    {onAi && <button type="button" className={mode === "ai" ? "active" : ""} aria-pressed={mode === "ai"} onClick={onAi}>Navo AI</button>}
    {children}
  </Container>;
}
