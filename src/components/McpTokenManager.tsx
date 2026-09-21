import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Language, McpTokenMetadata } from "../types";
import { Button, Input } from "./UiPrimitives";

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
  const createToken = async (event: FormEvent) => {
    event.preventDefault();
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
    } finally {
      setBusy(false);
    }
  };
  const revokeToken = async (id: string) => {
    if (!api.revokeMcpToken) return;
    setBusy(true);
    setError("");
    try {
      await api.revokeMcpToken(id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="df-mcp-settings">
      <header className="df-mcp-overview">
        <div>
          <strong>{lang === "zh" ? "连接你的 Agent" : "Connect your agent"}</strong>
          <p>{supported
            ? (lang === "zh" ? "创建专用访问令牌，再复制一段已带入 Skill 和账户连接信息的提示词。" : "Create a dedicated token, then copy a prompt with the Skill and account connection details included.")
            : (lang === "zh" ? "登录云端账户后可管理 MCP 令牌。" : "Sign in to a cloud account to manage MCP tokens.")}</p>
        </div>
        <a className="df-mcp-guide-link" href="/plugin-guide#mcp">{lang === "zh" ? "配置教程 ↗" : "Setup guide ↗"}</a>
      </header>

      {supported && <ol className="df-mcp-steps">
        <li>
          <span className="df-mcp-step-number" aria-hidden="true">01</span>
          <div className="df-mcp-step-body">
            <strong>{lang === "zh" ? "生成专用令牌" : "Generate a dedicated token"}</strong>
            <p>{lang === "zh" ? "原始令牌只显示一次。建议用 Agent 名称标记，便于之后单独撤销。" : "The raw token is shown once. Name it after the agent so you can revoke it separately later."}</p>
            <form className="df-mcp-create-row" onSubmit={(event) => void createToken(event)}>
              <label className="df-mcp-field-label" htmlFor="mcp-token-name">{lang === "zh" ? "令牌名称" : "Token name"}</label>
              <Input id="mcp-token-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={lang === "zh" ? "例如：Claude Code" : "e.g. Claude Code"} autoComplete="off" />
              <Button variant="primary" type="submit" disabled={busy}>{busy ? (lang === "zh" ? "生成中…" : "Generating…") : (lang === "zh" ? "生成令牌" : "Generate token")}</Button>
            </form>
            {error && <p className="df-mcp-status error" role="alert">{error}</p>}
            {notice && <p className="df-mcp-status" role="status">{notice}</p>}
            {rawToken && <div className="df-mcp-token">
              <small>{lang === "zh" ? "请立即保存；离开此页面后无法再次查看。" : "Save this now; it cannot be viewed again after you leave this page."}</small>
              <code>{rawToken}</code>
              <Button onClick={() => void copyText(rawToken)}>{lang === "zh" ? "复制令牌" : "Copy token"}</Button>
            </div>}
          </div>
        </li>
        <li>
          <span className="df-mcp-step-number" aria-hidden="true">02</span>
          <div className="df-mcp-step-body">
            <div className="df-mcp-step-action">
              <strong>{lang === "zh" ? "安装日程 Skill" : "Install the schedule Skill"}</strong>
              <Button variant="primary" disabled={!rawToken} onClick={() => void copyAgentSetupPrompt()}>{lang === "zh" ? "复制给 Agent" : "Copy for agent"}</Button>
            </div>
            <p>{rawToken
              ? (lang === "zh" ? "提示词已带入当前账户的端点和令牌。只粘贴到你信任的 Agent。" : "The prompt now includes this account's endpoint and token. Paste it only into an agent you trust.")
              : (lang === "zh" ? "生成令牌后，这里会提供可直接交给 Agent 的完整安装与连接提示词。" : "After generating a token, this provides a complete installation and connection prompt for your agent.")}</p>
          </div>
        </li>
      </ol>}

      <details className="df-mcp-manual">
        <summary>
          <span>{lang === "zh" ? "手动客户端配置" : "Manual client configuration"}</span>
          <small>{lang === "zh" ? "端点、请求头与可复制配置" : "Endpoint, authorization header, and copyable config"}</small>
        </summary>
        <div className="df-mcp-docs">
          <div className="df-mcp-doc-head"><span>{lang === "zh" ? "服务地址" : "Server endpoint"}</span><Button variant="ghost" onClick={() => void copyText(MCP_ENDPOINT)}>{lang === "zh" ? "复制" : "Copy"}</Button></div>
          <code>{MCP_ENDPOINT}</code>
          <div className="df-mcp-doc-head"><span>{lang === "zh" ? "客户端配置" : "Client configuration"}</span><Button variant="ghost" onClick={() => void copyText(codexConfig)}>{lang === "zh" ? "复制配置" : "Copy config"}</Button></div>
          <pre>{codexConfig}</pre>
          <small>{lang === "zh" ? "连接方式：Streamable HTTP。令牌通过 Authorization: Bearer 请求头发送。" : "Transport: Streamable HTTP. Send the token in the Authorization: Bearer header."}</small>
        </div>
      </details>

      {supported && <section className="df-mcp-active" aria-labelledby="mcp-active-title">
        <div className="df-mcp-section-head">
          <strong id="mcp-active-title">{lang === "zh" ? "有效令牌" : "Active tokens"}</strong>
          {!loading && <span>{tokens.length}</span>}
        </div>
        {loading && <p className="df-mcp-status">{lang === "zh" ? "正在读取令牌…" : "Loading tokens…"}</p>}
        {!loading && tokens.length === 0 && !error && <p className="df-mcp-status muted">{lang === "zh" ? "还没有有效令牌。" : "No active tokens yet."}</p>}
        {tokens.map((token) => <div className="df-mcp-token-row" key={token.id}>
          <span><strong>{token.name}</strong><small>{token.tokenPrefix}… · {new Date(token.createdAt).toLocaleDateString()}</small></span>
          <Button variant="danger" disabled={busy} onClick={() => void revokeToken(token.id)}>{lang === "zh" ? "撤销" : "Revoke"}</Button>
        </div>)}
      </section>}
    </section>
  );
}
