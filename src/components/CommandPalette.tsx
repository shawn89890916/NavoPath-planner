import { useEffect, useMemo, useRef } from "react";
import type { Language, PlannerData, Settings } from "../types";
import { buildCommandSearchIndex, searchCommands, type CommandSearchResult } from "../utils/commandSearch";
import { EmptyState } from "./EmptyState";
import { Button, CloseButton } from "./UiPrimitives";
import { UiSearchIcon } from "./UiIcons";

export default function CommandPalette(props: {
  closing: boolean;
  query: string;
  data?: PlannerData | null;
  settings?: Settings | null;
  lang: Language;
  onQuery: (value: string) => void;
  onClose: () => void;
  onChoose: (result: CommandSearchResult) => void;
}) {
  const {data,settings,query}=props;
  const index=useMemo(()=>data&&settings?buildCommandSearchIndex(data,settings):[],[data,settings]);
  const results=useMemo(()=>searchCommands(index,query),[index,query]);
  const zh = props.lang === "zh";
  const searchLabel = zh ? "搜索工作区" : "Search workspace";
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.closing) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [props.closing]);
  const kindLabel = (kind: CommandSearchResult["kind"]) => {
    if (props.lang === "zh") {
      if (kind === "task") return "任务";
      if (kind === "project") return "项目";
      if (kind === "habit") return "习惯";
      if (kind === "setting") return "设置";
      return "备注";
    }
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  };
  return (
    <>
      <button className="df-command-backdrop" data-workspace-backdrop="transparent" data-motion-closing={props.closing || undefined} disabled={props.closing} type="button" aria-label={props.lang === "zh" ? "关闭搜索" : "Close search"} onClick={props.onClose} />
      <section className="df-command-palette" data-workspace-panel data-motion-closing={props.closing || undefined} inert={props.closing} role="dialog" aria-label={props.lang === "zh" ? "搜索" : "Search"}>
        <div className="df-command-input-row">
          <UiSearchIcon size={20} />
          <input
            ref={inputRef}
            type="search"
            aria-label={searchLabel}
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                props.onClose();
              }
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                props.onChoose(results[0]);
              }
            }}
            placeholder={searchLabel}
          />
          <CloseButton label={props.lang === "zh" ? "关闭搜索" : "Close search"} onClick={props.onClose} />
        </div>
        <div className="df-command-results">
          {results.map((result) => (
            <button key={result.id} type="button" onClick={() => props.onChoose(result)}>
              <span className="df-command-kind">{kindLabel(result.kind)}</span>
              <span className="df-command-main">
                <strong>{result.title}</strong>
                {result.subtitle && <small>{result.subtitle}</small>}
              </span>
            </button>
          ))}
          {results.length === 0 && (props.query.trim()
            ? <EmptyState compact announce title={zh ? "没有匹配结果" : "No matching results"}>
                <Button onClick={() => { props.onQuery(""); inputRef.current?.focus(); }}>{zh ? "清除搜索" : "Clear search"}</Button>
              </EmptyState>
            : <EmptyState compact title={zh ? "搜索任务、项目或设置" : "Find tasks, projects, or settings"} />)}
        </div>
      </section>
    </>
  );
}
