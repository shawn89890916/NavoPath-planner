import { useEffect, useState } from "react";
import type { Language } from "./types";
import type { FeatureCopy, ProductFeature } from "./productSite";

export default function ProductStory({ feature, lang, copy }: { feature: ProductFeature; lang: Language; copy: FeatureCopy }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== "navopath-product-demo" || event.data.type !== "story") return;
      const progress = event.data.progress;
      if (typeof progress === "number" && Number.isFinite(progress) && progress >= 0 && progress <= copy.benefits.length - 1) setActive(progress);
    };
    addEventListener("message", receive);
    if (parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "story-ready" }, location.origin);
    return () => removeEventListener("message", receive);
  }, [copy.benefits.length]);
  return <aside className={`df-product-story df-product-story--${feature}`} aria-label={lang === "zh" ? "功能介绍" : "Feature introduction"}>
    <h1>{copy.title}</h1>
    <p className="df-product-story-lead">{copy.description}</p>
    <div>{copy.benefits.map(([title, description], index) => <section className={index === Math.round(active) ? "is-current" : ""} style={{ opacity: .32 + .68 * Math.max(0, 1 - Math.abs(index - active)) }} key={title}>
      <h2>{title}</h2><p>{description}</p>
    </section>)}</div>
  </aside>;
}
