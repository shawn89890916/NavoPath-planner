import { useEffect, useState, useSyncExternalStore } from "react";
import { extensionService } from "../extensions/service";
import type { V2ActivityFacts, V2MetricRow } from "../extensions/sdkV2";
import type { Language } from "../types";

type Provider = NonNullable<ReturnType<typeof extensionService.getSnapshot>["metricsProviders"]>[number];
type Result = { provider: Provider; facts: V2ActivityFacts; revision: number; rows: readonly V2MetricRow[] | null };

function ProviderMetrics({ provider, facts, lang }: { provider: Provider; facts: V2ActivityFacts; lang: Language }) {
  const [result, setResult] = useState<Result>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let off: ReturnType<NonNullable<Provider["subscribe"]>> | undefined;
    try { off = provider.subscribe?.(() => { if (active) setRevision(value => value + 1); }); }
    catch { /* A provider may still return a one-shot result. */ }
    return () => { active = false; void Promise.resolve().then(() => off?.()).catch(() => {}); };
  }, [provider]);
  useEffect(() => {
    let active = true;
    const publish = (rows: readonly V2MetricRow[] | null) => { if (active) setResult({ provider, facts, revision, rows }); };
    const timeout = setTimeout(() => { publish(null); active = false; }, 2000);
    void Promise.resolve().then(() => provider.query(facts)).then(rows => {
      if (!Array.isArray(rows) || rows.length > 50 || rows.some(row => !row || typeof row.label !== "string" || row.label.length > 200 || !Number.isFinite(row.value) || (row.unit !== undefined && (typeof row.unit !== "string" || row.unit.length > 40)))) throw new Error("Invalid metrics");
      publish(rows.map(({ label, value, unit }) => ({ label, value, unit })));
    }).catch(() => publish(null)).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); };
  }, [provider, facts, revision]);
  const current = result?.provider === provider && result.facts === facts && result.revision === revision ? result : undefined;
  return <section className="df-metric-insight-content"><h3>{provider.name}</h3>
    {!current ? <p role="status">{lang === "zh" ? "正在加载插件指标…" : "Loading plugin metrics…"}</p> :
      current.rows === null ? <p role="status">{lang === "zh" ? "插件指标暂不可用" : "Plugin metrics unavailable"}</p> :
      current.rows.length === 0 ? <p>{lang === "zh" ? "暂无指标" : "No metrics"}</p> :
      <dl>{current.rows.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value.toLocaleString(lang === "zh" ? "zh-CN" : "en")}{row.unit ? " " + row.unit : ""}</dd></div>)}</dl>}
  </section>;
}

export function PluginMetrics({ facts, lang }: { facts: V2ActivityFacts; lang: Language }) {
  const { metricsProviders } = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot, extensionService.getSnapshot);
  return <>{metricsProviders?.map(provider => <ProviderMetrics key={provider.id} provider={provider} facts={facts} lang={lang}/>)}</>;
}
