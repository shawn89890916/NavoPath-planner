import { useEffect, useRef, useState } from "react";
import { featureNames, siteHref } from "./productSite";
import type { Language } from "./types";
import ProductScreenshot from "./ProductScreenshot";
import "./product-demo-frame.css";

type DemoFrameProps =
  | { feature: "workspace" | "ai"; lang: Language }
  | {
    feature: "execute"; lang: Language;
    onReady: (ready: boolean) => void; onProgress: (scheduled: boolean) => void;
    timelineScroll: boolean; onExitTimelineScroll: (restoreFocus: boolean) => void;
  };

export default function ProductDemoFrame(props: DemoFrameProps) {
  const { feature, lang } = props;
  const home = props.feature === "execute" ? props : undefined;
  const onReady = home?.onReady;
  const onProgress = home?.onProgress;
  const timelineScroll = home?.timelineScroll;
  const onExitTimelineScroll = home?.onExitTimelineScroll;
  const frame = useRef<HTMLIFrameElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const zh = lang === "zh";

  useEffect(() => {
    const element = host.current;
    if (!element || mounted) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setMounted(true);
    }, { rootMargin: "400px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted || status !== "loading") return;
    const timeout = window.setTimeout(() => setStatus("failed"), 15000);
    return () => window.clearTimeout(timeout);
  }, [mounted, status, attempt]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let visible = false;
    const sendVisibility = () => frame.current?.contentWindow?.postMessage(
      { channel: "navopath-product-demo", type: "visibility", visible },
      location.origin,
    );
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sendVisibility();
      if (!visible && timelineScroll) onExitTimelineScroll?.(false);
    });
    observer.observe(element);
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "navopath-product-demo") return;
      if (event.data.type === "ready") {
        setStatus("ready");
        sendVisibility();
      }
      if (event.data.type === "error") setStatus("failed");
      if (event.data.type === "progress" && typeof event.data.scheduled === "boolean") onProgress?.(event.data.scheduled);
      if (event.data.type === "page-scroll" && timelineScroll === false && Number.isFinite(event.data.deltaY)) {
        window.scrollBy({ top: event.data.deltaY, behavior: "instant" });
      }
      if (event.data.type === "exit-timeline-scroll" && timelineScroll) onExitTimelineScroll?.(true);
    };
    addEventListener("message", receive);
    return () => {
      observer.disconnect();
      removeEventListener("message", receive);
    };
  }, [onProgress, onExitTimelineScroll, timelineScroll]);

  useEffect(() => {
    if (status === "ready" && timelineScroll !== undefined) {
      frame.current?.contentWindow?.postMessage({ channel: "navopath-product-demo", type: "scroll-mode", timelineScroll }, location.origin);
    }
  }, [status, timelineScroll]);

  useEffect(() => {
    onReady?.(status === "ready");
  }, [onReady, status]);

  const presentation = home ? "home" : "full";
  return <div className="np-product-window" ref={host}>
    {mounted && status !== "failed" && <iframe
      key={attempt}
      ref={frame}
      src={siteHref(`/product-demo/${feature}?lang=${lang}&presentation=${presentation}`)}
      title={home ? (zh ? "NavoPath 排程演示" : "NavoPath scheduling demo") : (zh ? "NavoPath 交互演示" : "NavoPath interactive demo")}
      tabIndex={status === "ready" ? undefined : -1}
      aria-hidden={status !== "ready" || undefined}
      onError={() => setStatus("failed")}
    />}
    <div className="np-demo-status" aria-hidden={!mounted || status === "ready" || undefined}>
      {props.feature !== "execute" && <ProductScreenshot feature={props.feature} lang={lang} alt={featureNames[lang][props.feature]} eager />}
      <div className="np-demo-loading-label">
        <span role="status">{status === "failed" ? (zh ? "试玩未能加载。" : "The demo couldn’t load.") : (zh ? "正在加载试玩…" : "Loading demo…")}</span>
        {status === "failed" && <>
          <button type="button" onClick={() => { setAttempt(value => value + 1); setStatus("loading"); }}>{zh ? "重试" : "Retry"}</button>
          {home && <a href="/app">{zh ? "打开网页版" : "Open web app"}</a>}
        </>}
      </div>
    </div>
  </div>;
}
