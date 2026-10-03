import { useEffect, useRef, useState } from "react";
import type { Language } from "../types";
import { PRODUCT_FEATURES, featureHref, featureNames } from "../productSite";
import "./product-menu.css";

export function ProductMenu({ lang }: { lang: Language }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div
      className="np-product-menu"
      ref={host}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
        if (event.key === "ArrowDown" && event.target === button.current) {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() =>
            host.current?.querySelector<HTMLAnchorElement>("a")?.focus(),
          );
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="np-product-links"
        onClick={() => setOpen((value) => !value)}
      >
        {lang === "zh" ? "产品" : "Product"}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <nav
          id="np-product-links"
          aria-label={lang === "zh" ? "产品功能" : "Product features"}
        >
          {PRODUCT_FEATURES.map((feature) => (
            <a key={feature} href={featureHref(feature, lang)}>
              {featureNames[lang][feature]}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
