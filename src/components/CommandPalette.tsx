import { useEffect, useRef } from "react";
import type { Language } from "../types";
import type { CommandSearchResult } from "../utils/commandSearch";
import { CloseButton } from "./UiPrimitives";
import { UiSearchIcon } from "./UiIcons";

export default function CommandPalette(props: {
  closing: boolean;
  query: string;
  results: CommandSearchResult[];
  lang: Language;
  onQuery: (value: string) => void;
  onClose: () => void;
  onChoose: (result: CommandSearchResult) => void;
}) {
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
      if (kind === "event") return "事件";
      return "备注";
    }
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  };
  return (
    <>
      <button className="df-command-backdrop" data-workspace-backdrop data-motion-closing={props.closing || undefined} disabled={props.closing} type="button" aria-label={props.lang === "zh" ? "关闭搜索" : "Close search"} onClick={props.onClose} />
      <section className="df-command-palette" data-workspace-panel data-motion-closing={props.closing || undefined} inert={props.closing} role="dialog" aria-label={props.lang === "zh" ? "搜索" : "Search"}>
        <div className="df-command-input-row">
          <UiSearchIcon size={20} />
          <input
            ref={inputRef}
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                props.onClose();
              }
              if (event.key === "Enter" && props.results[0]) {
                event.preventDefault();
                props.onChoose(props.results[0]);
              }
            }}
            placeholder={props.lang === "zh" ? "搜索任务、项目、习惯、设置" : "Search tasks, projects, habits, settings"}
          />
          <CloseButton label={props.lang === "zh" ? "关闭搜索" : "Close search"} onClick={props.onClose} />
        </div>
        <div className="df-command-results">
          {props.results.map((result) => (
            <button key={result.id} type="button" onClick={() => props.onChoose(result)}>
              <span className="df-command-kind">{kindLabel(result.kind)}</span>
              <span className="df-command-main">
                <strong>{result.title}</strong>
                <small>{result.subtitle}</small>
              </span>
              {result.focusTarget && <span className="df-command-jump">{props.lang === "zh" ? "跳转" : "Jump"}</span>}
            </button>
          ))}
          {props.results.length === 0 && <p className="df-command-empty">{props.lang === "zh" ? "没有匹配结果" : "No matching results"}</p>}
        </div>
      </section>
    </>
  );
}
