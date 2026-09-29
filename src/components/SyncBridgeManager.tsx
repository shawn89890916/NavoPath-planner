import { useCallback, useEffect, useState } from "react";
import type { Language, SyncBridgeStatus } from "../types";
import { buildSyncBridgeSetupPrompt } from "../syncBridgePrompt";
import { Button } from "./UiPrimitives";

const MCP_ENDPOINT = import.meta.env.VITE_MCP_ENDPOINT || "https://navopath-mcp.shawn89890916.workers.dev/mcp";
const providers = [
  { id: "iCloud Drive", zh: "iCloud Drive", en: "iCloud Drive" },
  { id: "OneDrive", zh: "OneDrive", en: "OneDrive" },
  { id: "Dropbox", zh: "Dropbox", en: "Dropbox" },
  { id: "custom", zh: "其他本机同步文件夹", en: "Another synced folder" },
];

function bridgeState(item: SyncBridgeStatus, lang: Language) {
  const stale = !item.lastSeenAt || Date.now() - Date.parse(item.lastSeenAt) > 2 * 60_000;
  if (stale) return lang === "zh" ? "等待桥接电脑连接" : "Waiting for bridge computer";
  if (item.status === "error") return lang === "zh" ? "需要处理" : "Needs attention";
  if (item.status === "stopped") return lang === "zh" ? "已停止" : "Stopped";
  return lang === "zh" ? "运行中" : "Running";
}

export default function SyncBridgeManager({ lang }: { lang: Language }) {
  const api = window.plannerApi;
  const [provider, setProvider] = useState(providers[0].id);
  const [statuses, setStatuses] = useState<SyncBridgeStatus[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fallbackPrompt, setFallbackPrompt] = useState("");
  const refresh = useCallback(async () => {
    if (!api.listSyncBridgeStatuses) return;
    try {
      setStatuses(await api.listSyncBridgeStatuses());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const copyPrompt = async () => {
    const selected = providers.find((item) => item.id === provider)!;
    const prompt = buildSyncBridgeSetupPrompt({ language: lang, provider: lang === "zh" ? selected.zh : selected.en, endpoint: MCP_ENDPOINT });
    try {
      await navigator.clipboard.writeText(prompt);
      setFallbackPrompt("");
      setNotice(lang === "zh" ? "已复制配置提示词" : "Setup prompt copied");
    } catch {
      setFallbackPrompt(prompt);
      setNotice(lang === "zh" ? "复制失败，可从下方手动复制。" : "Copy failed. Select the prompt below.");
    }
  };

  return <div className="df-sync-bridge">
    <header className="df-mcp-overview">
      <div>
        <strong>{lang === "zh" ? "把工作区同步到自己的云盘" : "Sync your workspace to your cloud folder"}</strong>
        <p>{lang === "zh"
          ? "选择一台常开电脑，让后台桥接服务同步 NavoPath 云端与这台电脑的云盘文件夹。其他设备仍通过同一 NavoPath 账户自动更新。"
          : "Use one always-on computer to sync NavoPath cloud data with a folder managed by your cloud provider. Other devices update through the same NavoPath account."}</p>
      </div>
    </header>

    <div className="df-sync-bridge-setup">
      <label htmlFor="sync-bridge-provider">{lang === "zh" ? "本机云盘服务" : "Local cloud provider"}</label>
      <div className="df-sync-bridge-actions">
        <select id="sync-bridge-provider" className="ui-input" value={provider} onChange={(event) => setProvider(event.target.value)}>
          {providers.map((item) => <option key={item.id} value={item.id}>{lang === "zh" ? item.zh : item.en}</option>)}
        </select>
        <Button variant="primary" onClick={() => void copyPrompt()}>{lang === "zh" ? "复制给 Agent 的配置提示词" : "Copy setup prompt for agent"}</Button>
      </div>
      <p>{lang === "zh"
        ? "先在旁边的 MCP 页签生成一个“Sync Bridge”专用令牌。Agent 会指导你在本机终端输入令牌并安装后台服务；令牌不会写入云盘。"
        : "First create a dedicated “Sync Bridge” token in the adjacent MCP tab. The agent will guide you through entering it locally and installing the background service. The token stays out of your cloud folder."}</p>
      {notice && <p className="df-mcp-status" role="status">{notice}</p>}
      {fallbackPrompt && <textarea readOnly aria-label={lang === "zh" ? "手动复制配置提示词" : "Copy setup prompt manually"} value={fallbackPrompt} rows={8} onFocus={(event) => event.currentTarget.select()} />}
    </div>

    <section className="df-sync-bridge-status" aria-label={lang === "zh" ? "桥接状态" : "Bridge status"}>
      <div className="df-mcp-section-head"><strong>{lang === "zh" ? "桥接状态" : "Bridge status"}</strong><Button variant="ghost" onClick={() => void refresh()}>{lang === "zh" ? "刷新" : "Refresh"}</Button></div>
      {!api.listSyncBridgeStatuses && <p className="df-mcp-status muted">{lang === "zh" ? "登录云端账户后可查看桥接状态。" : "Sign in to see bridge status."}</p>}
      {api.listSyncBridgeStatuses && statuses.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "尚未连接桥接电脑。" : "No bridge computer connected yet."}</p>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {statuses.map((item) => <div className="df-sync-bridge-device" key={item.deviceId}>
        <div><strong>{item.deviceName}</strong><span>{bridgeState(item, lang)}</span></div>
        <code>{item.folderPath}</code>
        <small>{item.lastSuccessAt
          ? `${lang === "zh" ? "最近成功同步" : "Last successful sync"} · ${new Date(item.lastSuccessAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}`
          : (lang === "zh" ? "等待首次同步" : "Waiting for first sync")}</small>
        {item.error && <p className="df-mcp-status error" role="alert">{item.error}</p>}
      </div>)}
    </section>

    <details className="df-mcp-manual df-sync-bridge-manual">
      <summary>{lang === "zh" ? "手动同步教程" : "Manual sync guide"}</summary>
      <ol>
        <li>{lang === "zh" ? "在「账户与数据 → 数据与备份」导出完整 JSON 备份，把下载的文件保存到自己已同步的云盘文件夹。" : "Export a full JSON backup from Account & Data → Data & Backup, then save it in your synced cloud folder."}</li>
        <li>{lang === "zh" ? "等待云盘客户端完成上传；在另一台设备上下载同一文件。" : "Wait for your cloud provider to upload it, then download the same file on your other device."}</li>
        <li>{lang === "zh" ? "在另一台设备的「数据与备份」导入该 JSON 文件。导入会覆盖该设备当前数据；先导出一份当前备份。" : "Import the JSON in Data & Backup on the other device. Import replaces that device's current data; export its current backup first."}</li>
      </ol>
      <p>{lang === "zh" ? "自动桥接使用 navopath-workspace.json；手动备份使用下载的 navopath-backup 文件。请保留云盘产生的冲突副本，先核对再处理。" : "The bridge uses navopath-workspace.json; manual backups use downloaded navopath-backup files. Keep any cloud conflict copies until you review them."}</p>
    </details>
  </div>;
}
