import { useCallback, useEffect, useState } from "react";
import type { Language, McpTokenMetadata } from "../types";

const MCP_ENDPOINT = import.meta.env.VITE_MCP_ENDPOINT || "https://navopath-mcp.shawn89890916.workers.dev/mcp";

export default function McpTokenManager({ lang }: { lang: Language }) {
  const [tokens, setTokens] = useState<McpTokenMetadata[]>([]);
  const [name, setName] = useState("");
  const [rawToken, setRawToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const api = window.plannerApi;
  const supported = Boolean(api.listMcpTokens && api.createMcpToken && api.revokeMcpToken);
  const refresh = useCallback(async () => {
    if (!api.listMcpTokens) { setLoading(false); return; }
    try {
      setError("");
      setTokens(await api.listMcpTokens());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { if (supported) void refresh(); else setLoading(false); }, [refresh, supported]);
  const configToken = rawToken || "nvp_REPLACE_ME";
  const codexConfig = `[mcp_servers.navopath]\nurl = "${MCP_ENDPOINT}"\nhttp_headers = { Authorization = "Bearer ${configToken}" }`;
  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(lang === "zh" ? "已复制" : "Copied");
      window.setTimeout(() => setNotice(""), 1800);
    } catch {
      setError(lang === "zh" ? "复制失败，请手动选择文本。" : "Copy failed. Select the text manually.");
    }
  };
  const copyAgentSetupPrompt = async () => {
    if (!rawToken) return;
    const { buildNavoPathAgentSetupPrompt } = await import("../mcpAgentSetup");
    await copyText(buildNavoPathAgentSetupPrompt({ endpoint: MCP_ENDPOINT, token: rawToken, language: lang }));
  };
  return (
    <section className="df-mcp-settings">
      <strong>{lang === "zh" ? "远程 MCP 访问" : "Remote MCP access"}</strong>
      <p>{supported
        ? (lang === "zh" ? "为远程 MCP 客户端创建个人 Bearer Token。原始令牌只显示一次。" : "Create a personal Bearer token for a remote MCP client. The raw token is shown once.")
        : (lang === "zh" ? "登录云端账户后可管理 MCP 令牌。" : "Sign in to a cloud account to manage MCP tokens.")}</p>
      <a className="df-plugin-doc-link" href="/plugin-guide#mcp">
        <span>{lang === "zh" ? "查看 MCP 配置教程" : "View MCP setup guide"}</span>
        <small>{lang === "zh" ? "端点、Token、客户端配置和排错说明" : "Endpoint, token, client config, and troubleshooting notes"}</small>
        <i aria-hidden="true">↗</i>
      </a>
      <div className="df-mcp-docs">
        <div className="df-mcp-doc-head"><span>{lang === "zh" ? "服务地址" : "Server endpoint"}</span><button type="button" onClick={() => void copyText(MCP_ENDPOINT)}>{lang === "zh" ? "复制" : "Copy"}</button></div>
        <code>{MCP_ENDPOINT}</code>
        <div className="df-mcp-doc-head"><span>{lang === "zh" ? "客户端配置" : "Client configuration"}</span><button type="button" onClick={() => void copyText(codexConfig)}>{lang === "zh" ? "复制配置" : "Copy config"}</button></div>
        <pre>{codexConfig}</pre>
        <small>{lang === "zh" ? "连接方式：Streamable HTTP。令牌通过 Authorization: Bearer 请求头发送。" : "Transport: Streamable HTTP. Send the token in the Authorization: Bearer header."}</small>
      </div>
      {supported && <div className="df-mcp-create-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={lang === "zh" ? "令牌名称" : "Token name"} /><button type="button" disabled={busy} onClick={async () => {
        if (!api.createMcpToken) return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
          const created = await api.createMcpToken(name.trim() || "MCP client");
          setRawToken(created.token);
          setName("");
          await refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught));
        } finally { setBusy(false); }
      }}>{busy ? (lang === "zh" ? "生成中…" : "Generating…") : (lang === "zh" ? "生成" : "Generate")}</button></div>}
      {error && <p className="df-mcp-status error" role="alert">{error}</p>}
      {notice && <p className="df-mcp-status" role="status">{notice}</p>}
      {rawToken && <div className="df-mcp-token"><small>{lang === "zh" ? "请立即保存，关闭设置后无法再次查看" : "Save this now; it cannot be viewed again"}</small><code>{rawToken}</code><button type="button" onClick={() => void copyText(rawToken)}>{lang === "zh" ? "复制令牌" : "Copy token"}</button></div>}
      <div className="df-mcp-docs">
        <div className="df-mcp-doc-head"><span>{lang === "zh" ? "安装日程 Skill" : "Install schedule skill"}</span><button type="button" disabled={!rawToken} onClick={() => void copyAgentSetupPrompt()}>{lang === "zh" ? "复制给 Agent" : "Copy for agent"}</button></div>
        <p>{rawToken
          ? (lang === "zh" ? "提示词已带入当前账户的 MCP Token。仅粘贴到你信任的 Agent；泄露后请立即撤销。" : "The prompt includes this account's MCP token. Paste it only into an agent you trust and revoke it immediately if exposed.")
          : (lang === "zh" ? "先生成一个专用于 Agent 的新令牌，提示词会自动带入下载地址和账户连接信息。" : "Create a new agent-specific token first; the prompt will then include the download and account connection details.")}</p>
      </div>
      {loading && <p className="df-mcp-status">{lang === "zh" ? "正在读取令牌…" : "Loading tokens…"}</p>}
      {!loading && supported && tokens.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "还没有有效令牌。" : "No active tokens yet."}</p>}
      {tokens.map((token) => <div className="df-mcp-token-row" key={token.id}><span><strong>{token.name}</strong><small>{token.tokenPrefix}… · {new Date(token.createdAt).toLocaleDateString()}</small></span><button type="button" disabled={busy} onClick={async () => { if (!api.revokeMcpToken) return; setBusy(true); setError(""); try { await api.revokeMcpToken(token.id); await refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } finally { setBusy(false); } }}>{lang === "zh" ? "撤销" : "Revoke"}</button></div>)}
    </section>
  );
}
