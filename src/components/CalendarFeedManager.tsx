import { useCallback, useEffect, useState } from "react";
import type { CalendarFeedTokenMetadata, Language } from "../types";
import { EmptyState } from "./EmptyState";

const CALENDAR_FEED_ENDPOINT = import.meta.env.VITE_MCP_ENDPOINT || "https://navopath.com";

function calendarFeedUrl(token: string) {
  const endpoint = new URL(CALENDAR_FEED_ENDPOINT);
  endpoint.pathname = `${endpoint.pathname.replace(/\/mcp\/?$/, "").replace(/\/$/, "")}/calendar/${token}.ics`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

export default function CalendarFeedManager({ lang, historyOnly = false, errorMessage }: { lang: Language; historyOnly?: boolean; errorMessage: (error: unknown, lang: Language) => string }) {
  const [tokens, setTokens] = useState<CalendarFeedTokenMetadata[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [historyUrl, setHistoryUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const api = window.plannerApi;
  const supported = Boolean(api.listCalendarFeedTokens && api.createCalendarFeedToken && api.revokeCalendarFeedToken);
  const refresh = useCallback(async () => {
    if (!api.listCalendarFeedTokens) { setLoading(false); return; }
    try {
      setError("");
      setTokens(await api.listCalendarFeedTokens());
    } catch (caught) {
      setError(errorMessage(caught, lang));
    } finally {
      setLoading(false);
    }
  }, [api, lang, errorMessage]);
  useEffect(() => { if (supported) void refresh(); else setLoading(false); }, [refresh, supported]);
  const copyFeedUrl = async (history = false) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      let url = feedUrl;
      if (history) {
        if (!api.getCalendarHistoryToken) throw new Error(lang === "zh" ? "当前环境不支持获取历史链接。" : "History link retrieval is unavailable.");
        if (!api.listCalendarFeedTokens || !api.createCalendarFeedToken) throw new Error(lang === "zh" ? "日历服务不可用。" : "Calendar service unavailable.");
        const existing = await api.listCalendarFeedTokens();
        if (!existing.length) {
          const created = await api.createCalendarFeedToken();
          setFeedUrl(calendarFeedUrl(created.token));
          await refresh();
        }
        const token = await api.getCalendarHistoryToken();
        url = calendarFeedUrl(token + "-history");
        setHistoryUrl(url);
      }
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        setError(lang === "zh" ? "复制失败，请手动选择链接。" : "Copy failed. Select the link manually.");
        return;
      }
      setNotice(history ? (lang === "zh" ? "SP 时间轴历史链接已复制" : "SP timeline history link copied") : (lang === "zh" ? "订阅链接已复制" : "Subscription link copied"));
      window.setTimeout(() => setNotice(""), 1800);
    } catch (caught) {
      setError(errorMessage(caught, lang));
    } finally {
      setBusy(false);
    }
  };
  const createFeed = async () => {
    if (!api.createCalendarFeedToken) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api.createCalendarFeedToken();
      setFeedUrl(calendarFeedUrl(created.token));
      setHistoryUrl("");
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught, lang));
    } finally {
      setBusy(false);
    }
  };
  if (historyOnly) return <section className="df-mcp-settings df-calendar-settings">
    {supported && api.getCalendarHistoryToken ? <div className="df-calendar-actions">
      <button type="button" disabled={busy || loading} onClick={() => void copyFeedUrl(true)}>{busy ? (lang === "zh" ? "处理中…" : "Working…") : (lang === "zh" ? "复制历史订阅链接" : "Copy history subscription link")}</button>
    </div> : <p>{lang === "zh" ? "登录云端账户后可获取历史订阅链接。" : "Sign in to obtain a history subscription link."}</p>}
    {historyUrl && <div className="df-mcp-token"><small>{lang === "zh" ? "私密链接，请勿公开分享。" : "Private link; do not share publicly."}</small><code>{historyUrl}</code></div>}
    {feedUrl && <details className="df-mcp-manual"><summary>{lang === "zh" ? "同时保存完整日历订阅链接（仅首次生成时显示）" : "Also save full calendar link (shown only on first creation)"}</summary><div className="df-mcp-token"><code>{feedUrl}</code><button type="button" disabled={busy} onClick={() => void copyFeedUrl()}>{lang === "zh" ? "复制完整日历链接" : "Copy full calendar link"}</button></div></details>}
    {error && <p className="df-mcp-status error" role="alert">{error}</p>}
    {notice && <p className="df-mcp-status" role="status">{notice}</p>}
  </section>;
  return (
    <section className="df-mcp-settings df-calendar-settings">
      <strong>{lang === "zh" ? "只读日历订阅" : "Read-only calendar subscription"}</strong>
      <p>{supported
        ? (lang === "zh" ? "将时间轴排程、日历事件和未排程任务的截止日订阅到 iPhone、Notion Calendar 或其他日历。链接包含私密令牌，请勿公开分享。" : "Subscribe to timeline blocks, calendar events, and unscheduled task deadlines from iPhone, Notion Calendar, or another calendar. The link contains a private token; do not share it publicly.")
        : (lang === "zh" ? "登录云端账户后可生成日历订阅链接。" : "Sign in to a cloud account to create a calendar subscription link.")}</p>
      {supported && <button className="df-calendar-generate" type="button" disabled={busy || loading} onClick={() => {
        if (tokens.length && !window.confirm(lang === "zh" ? "更换将使现有普通和历史订阅链接失效。确定继续？" : "Replacing invalidates existing regular and history subscriptions. Continue?")) return;
        void createFeed();
      }}>{busy
        ? (lang === "zh" ? "正在生成…" : "Generating…")
        : tokens.length > 0
          ? (lang === "zh" ? "更换订阅链接" : "Replace subscription link")
          : (lang === "zh" ? "生成订阅链接" : "Create subscription link")}</button>}
      {feedUrl && <div className="df-mcp-token">
        <small>{lang === "zh" ? "此完整链接只显示一次；更换链接会让旧订阅失效。" : "This complete link is shown once. Replacing it invalidates the old subscription."}</small>
        <code>{feedUrl}</code>
        <div className="df-calendar-actions">
          <button type="button" onClick={() => void copyFeedUrl()}>{lang === "zh" ? "复制链接" : "Copy link"}</button>
          <button type="button" onClick={() => { window.location.href = feedUrl.replace(/^https?:/, "webcal:"); }}>{lang === "zh" ? "在日历中订阅" : "Subscribe in Calendar"}</button>
        </div>
      </div>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {notice && <p className="df-mcp-status" role="status">{notice}</p>}
      {loading && <p className="df-mcp-status">{lang === "zh" ? "正在读取订阅状态…" : "Loading subscription status…"}</p>}
      {!loading && supported && tokens.length === 0 && !error && <EmptyState compact announce title={lang === "zh" ? "还没有日历订阅" : "No calendar subscription yet"} />}
      {tokens.map((token) => <div className="df-mcp-token-row" key={token.id}><span><strong>{lang === "zh" ? "NavoPath 日历" : "NavoPath Calendar"}</strong><small>{token.tokenPrefix}… · {new Date(token.createdAt).toLocaleDateString()}</small></span><button type="button" disabled={busy} onClick={async () => {
        if (!api.revokeCalendarFeedToken) return;
        setBusy(true);
        setError("");
        try {
          await api.revokeCalendarFeedToken(token.id);
          setFeedUrl("");
          setHistoryUrl("");
          await refresh();
        } catch (caught) {
          setError(errorMessage(caught, lang));
        } finally {
          setBusy(false);
        }
      }}>{lang === "zh" ? "撤销" : "Revoke"}</button></div>)}
    </section>
  );
}

