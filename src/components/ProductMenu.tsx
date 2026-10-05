import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Language } from "../types";
import { PRINCIPLES, PRODUCT_FEATURES, featureHref, featureNames, principleHref, principleNames } from "../productSite";
import "./product-menu.css";

const summaries = {
  zh: { planning: "把目标整理成项目与任务。", execute: "为今天要做的事安排时间。", ai: "检查、调整并应用建议。" },
  en: { planning: "Turn goals into projects and tasks.", execute: "Make time for today's tasks.", ai: "Review, refine, and apply suggestions." },
};

export function ProductMenu({ lang, kind = "product", children, includeGitHub = false, compact = false, active = false }: { lang: Language; kind?: "product" | "support" | "brand" | "principles"; children?: ReactNode; includeGitHub?: boolean; compact?: boolean; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const menuId = useId(), closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const zh = lang === "zh";
  const reveal = () => { clearTimeout(closeTimer.current); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const label = kind === "brand" ? children : kind === "support" ? (zh ? "支持" : "Support") : kind === "principles" ? (zh ? "相关原理" : "Principles") : (zh ? "产品" : "Product");
  const quick = kind !== "product" || compact;
  useLayoutEffect(() => {
    const panel = host.current?.querySelector<HTMLElement>(".np-quick-menu");
    if (!open || !panel) return;
    const fit = () => {
      panel.style.removeProperty("--menu-shift");
      const rect = panel.getBoundingClientRect();
      const shift = Math.max(12 - rect.left, Math.min(0, document.documentElement.clientWidth - 12 - rect.right));
      panel.style.setProperty("--menu-shift", `${shift}px`);
    };
    fit(); addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [open, quick, lang]);
  const shared = { "aria-expanded": open, "aria-controls": menuId, "aria-haspopup": true as const };
  return <div className={`np-product-menu np-product-menu--${kind}${active ? " np-product-menu--active" : ""}`} ref={host}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") reveal(); }}
    onPointerLeave={(event) => { if (event.pointerType === "mouse") closeTimer.current = setTimeout(() => setOpen(false), 160); }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (event.key === "ArrowDown" && event.target === trigger.current) {
        event.preventDefault(); reveal(); requestAnimationFrame(() => host.current?.querySelector<HTMLAnchorElement>("nav a[href]")?.focus());
      }
    }}>
    {kind === "support" || kind === "principles" || compact ? <button ref={(node) => { trigger.current = node; }} type="button" {...shared} onClick={(event) => { if (event.detail === 0 || matchMedia("(hover: none)").matches) setOpen(!open); else reveal(); }}>{label}</button>
      : <a ref={(node) => { trigger.current = node; }} className={kind === "brand" ? "np-navigation-brand" : undefined} href={kind === "brand" ? "/" : featureHref("planning", lang)} {...shared}
        onClick={(event) => { if (kind === "brand" && matchMedia("(hover: none)").matches) { event.preventDefault(); setOpen(!open); } }}>{label}</a>}
    {open && <nav id={menuId} className={quick ? "np-quick-menu" : "np-mega-menu"} aria-label={kind === "support" ? (zh ? "支持与个人网站" : "Support and personal website") : kind === "principles" ? (zh ? "相关原理主题" : "Principle topics") : (zh ? "网站导航" : "Site navigation")}>
      {kind === "support" ? <><a href="https://afdian.com/a/233cxy/plan" target="_blank" rel="noreferrer">{zh ? "爱发电" : "Afdian"}</a>{includeGitHub && <a href="https://github.com/shawn89890916/NavoPath-planner" target="_blank" rel="noreferrer">GitHub</a>}<span role="link" aria-disabled="true">{zh ? "个人网站" : "Personal website"}</span></>
        : kind === "principles" ? PRINCIPLES.map(topic => <a key={topic} href={principleHref(topic, lang)} target="_top">{principleNames[lang][topic]}</a>)
        : <div className="np-menu-content">{kind === "brand" && <a href="/">{zh ? "首页" : "Home"}</a>}
          {PRODUCT_FEATURES.map((feature) => <a key={feature} href={featureHref(feature, lang)} target="_top"><strong>{featureNames[lang][feature]}</strong>{kind === "product" && !compact && <span>{summaries[lang][feature]}</span>}</a>)}
          {kind === "brand" && <a href="https://github.com/shawn89890916/NavoPath-planner" target="_blank" rel="noreferrer">GitHub</a>}
        </div>}
    </nav>}
  </div>;
}

export function SiteLanguageSwitch({ lang, onChange }: { lang: Language; onChange: (lang: Language) => void }) {
  return <button className="np-language-switch" type="button" role="switch" aria-checked={lang === "zh"} aria-label={lang === "zh" ? "语言：中文，切换为英文" : "Language: English, switch to Chinese"} onClick={() => onChange(lang === "zh" ? "en" : "zh")}><span className="np-language-thumb" aria-hidden="true" /><span aria-hidden="true">EN</span><span aria-hidden="true">中</span></button>;
}
