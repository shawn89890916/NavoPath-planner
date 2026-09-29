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
  const [loaded, setLoaded] = useState(false);
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
    } finally {
      setLoaded(true);
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

  const hasBridge = statuses.length > 0;

  return <div className="df-sync-bridge">
    <header className="df-mcp-overview">
      <div>
        <strong>{lang === "zh" ? "你的同步路径" : "How your workspace syncs"}</strong>
        <p>{lang === "zh"
          ? "网页、iPhone 和 Windows 使用同一 NavoPath 账户双向同步。桥接电脑再将账户云端与所选云盘文件夹双向同步。"
          : "Web, iPhone, and Windows sync both ways through the same NavoPath account. The bridge computer then syncs the account cloud both ways with your chosen cloud folder."}</p>
      </div>
    </header>

    <div className="df-sync-bridge-path" aria-label={lang === "zh" ? "同步路径" : "Sync path"}>
      <p><span>{lang === "zh" ? "日常设备" : "Everyday devices"}</span><strong>{lang === "zh" ? "网页 / iPhone / Windows ↔ NavoPath 账户云端" : "Web / iPhone / Windows ↔ NavoPath account cloud"}</strong></p>
      <p><span>{lang === "zh" ? "云盘镜像" : "Cloud folder mirror"}</span><strong>{lang === "zh" ? "账户云端 ↔ 一台桥接电脑 ↔ 云盘文件夹" : "Account cloud ↔ one bridge computer ↔ cloud folder"}</strong></p>
    </div>
    <p className="df-sync-bridge-note">{lang === "zh"
      ? "手机只需登录同一账户并打开 NavoPath，无需安装桥接服务或使用 MCP 令牌。桥接电脑离线时，其他设备仍通过账户云端同步；电脑恢复运行后会补齐云盘镜像。"
      : "On your phone, sign in to the same account and open NavoPath. No bridge or MCP token is needed. Other devices can keep syncing through the account cloud while the bridge computer is offline; the folder mirror catches up when it returns."}</p>

    <section className="df-sync-bridge-status" aria-label={lang === "zh" ? "桥接状态" : "Bridge status"}>
      <div className="df-mcp-section-head"><strong>{lang === "zh" ? "桥接电脑" : "Bridge computer"}</strong><Button variant="ghost" onClick={() => void refresh()}>{lang === "zh" ? "刷新" : "Refresh"}</Button></div>
      {!api.listSyncBridgeStatuses && <p className="df-mcp-status muted">{lang === "zh" ? "登录 NavoPath 账户后可查看桥接状态。" : "Sign in to your NavoPath account to see bridge status."}</p>}
      {api.listSyncBridgeStatuses && !loaded && <p className="df-mcp-status muted">{lang === "zh" ? "正在读取桥接状态…" : "Loading bridge status…"}</p>}
      {api.listSyncBridgeStatuses && loaded && !hasBridge && !error && <p className="df-mcp-status muted">{lang === "zh" ? "尚未连接桥接电脑。先按下方的首次配置步骤操作。" : "No bridge computer connected yet. Follow the first-time setup below."}</p>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {statuses.map((item) => <div className="df-sync-bridge-device" key={item.deviceId}>
        <div><strong>{item.deviceName}</strong><span>{bridgeState(item, lang)}</span></div>
        <code>{item.folderPath}</code>
        <small>{item.lastSuccessAt
          ? `${lang === "zh" ? "最近桥接成功" : "Last bridge sync"} · ${new Date(item.lastSuccessAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}`
          : (lang === "zh" ? "等待首次同步" : "Waiting for first sync")}</small>
        {item.error && <p className="df-mcp-status error" role="alert">{item.error}</p>}
      </div>)}
      {hasBridge && <p className="df-sync-bridge-note">{lang === "zh"
        ? "这里显示桥接服务与 NavoPath 云端的状态。iCloud Drive 等云盘的文件上传进度，请在其本机客户端查看。桥接电脑需保持登录且云盘客户端持续运行。"
        : "This reports the bridge's connection to NavoPath cloud. Check the local iCloud Drive or other cloud client for file upload progress. Keep the bridge computer signed in and its cloud client running."}</p>}
    </section>

    <details className="df-mcp-manual df-sync-bridge-setup" key={loaded ? (hasBridge ? "configured" : "unconfigured") : "loading"} open={loaded && !hasBridge && !error && !!api.listSyncBridgeStatuses}>
      <summary>{lang === "zh" ? "首次配置或更换桥接电脑" : "Set up or replace the bridge computer"}</summary>
      <div className="df-sync-bridge-setup-body">
        <ol>
          <li>{lang === "zh" ? "选一台常开 Windows 或 macOS 电脑，确认 Node.js 20+ 和云盘客户端已安装；自己选定已在本机同步的文件夹。更换电脑时先停用旧桥接，一个账户只运行一台。" : "Choose one always-on Windows or macOS computer with Node.js 20+ and a running cloud client. Choose its existing local synced folder yourself. Stop the old bridge before replacing it; run only one per account."}</li>
          <li>{lang === "zh" ? "到旁边的 MCP 页签新建“Sync Bridge”专用令牌，并暂时保留在本机。" : "Create a dedicated “Sync Bridge” token in the adjacent MCP tab and keep it locally for setup."}</li>
          <li>{lang === "zh" ? "选择云盘服务，复制下面的提示词交给这台电脑上的 Agent。Agent 会检查脚本并引导你配置和安装后台任务。" : "Choose the cloud provider and copy the prompt below to an Agent on that computer. The Agent will inspect the script and guide setup and background installation."}</li>
          <li>{lang === "zh" ? "只在终端的隐藏提示中粘贴令牌并按 Enter。输入时屏幕不会显示字符，这是正常的；不要把令牌发到聊天、命令参数或云盘文件夹。" : "Paste the token only into the terminal's hidden prompt, then press Enter. Nothing appears while you type; that is expected. Keep the token out of chat, command arguments, and the cloud folder."}</li>
          <li>{lang === "zh" ? "看到配置成功后再安装后台任务，并回到这里核对目录、运行状态和最近桥接时间。" : "Install the background task after setup succeeds, then return here to check the folder, running status, and latest bridge sync."}</li>
        </ol>
        <label htmlFor="sync-bridge-provider">{lang === "zh" ? "本机云盘服务" : "Local cloud provider"}</label>
        <div className="df-sync-bridge-actions">
          <select id="sync-bridge-provider" className="ui-input" value={provider} onChange={(event) => setProvider(event.target.value)}>
            {providers.map((item) => <option key={item.id} value={item.id}>{lang === "zh" ? item.zh : item.en}</option>)}
          </select>
          <Button variant="primary" onClick={() => void copyPrompt()}>{lang === "zh" ? "复制给 Agent 的配置提示词" : "Copy setup prompt for agent"}</Button>
        </div>
        {notice && <p className="df-mcp-status" role="status">{notice}</p>}
        {fallbackPrompt && <textarea readOnly aria-label={lang === "zh" ? "手动复制配置提示词" : "Copy setup prompt manually"} value={fallbackPrompt} rows={8} onFocus={(event) => event.currentTarget.select()} />}
        <p className="df-sync-bridge-note">{lang === "zh"
          ? "如果显示 Setup cancelled 或找不到 sync-bridge.json，说明配置尚未完成：重新运行 setup 并在隐藏提示中提交令牌，再运行 install。连接超时或 401 时，请让 Agent 检查本机代理、令牌和云端状态；保留已有备份与冲突副本。"
          : "If you see Setup cancelled or a missing sync-bridge.json, setup did not finish. Run setup again, submit the token at the hidden prompt, then run install. For timeouts or 401 errors, ask the Agent to check the local proxy, token, and cloud status. Keep existing backups and conflict copies."}</p>
      </div>
    </details>

    <details className="df-mcp-manual df-sync-bridge-manual">
      <summary>{lang === "zh" ? "手动备份与恢复" : "Manual backup and restore"}</summary>
      <ol>
        <li>{lang === "zh" ? "在「账户与数据 → 数据与备份」导出完整 JSON 备份，把下载的文件保存到自己已同步的云盘文件夹。" : "Export a full JSON backup from Account & Data → Data & Backup, then save it in your synced cloud folder."}</li>
        <li>{lang === "zh" ? "等待云盘客户端完成上传；在另一台设备上下载同一文件。" : "Wait for your cloud provider to upload it, then download the same file on your other device."}</li>
        <li>{lang === "zh" ? "在另一台设备的「数据与备份」导入该 JSON 文件。导入会覆盖该设备当前数据；先导出一份当前备份。" : "Import the JSON in Data & Backup on the other device. Import replaces that device's current data; export its current backup first."}</li>
      </ol>
      <p>{lang === "zh" ? "自动桥接使用 navopath-workspace.json；手动备份使用下载的 navopath-backup 文件。请保留云盘产生的冲突副本，先核对再处理。" : "The bridge uses navopath-workspace.json; manual backups use downloaded navopath-backup files. Keep any cloud conflict copies until you review them."}</p>
    </details>
  </div>;
}
