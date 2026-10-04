import { useEffect, useState } from "react";

type ConsentState =
  | { status: "loading" }
  | { status: "consent"; clientName: string; scopes: string[]; redirectUri: string }
  | { status: "error"; message: string; details?: string };

function errorDetails(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return String(error || "Unknown error");
  const value = error as { message?: unknown; code?: unknown; status?: unknown };
  return [value.message, value.code, value.status]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .map(String)
    .join(" · ") || "Unknown error";
}

const copy = {
  en: {
    title: "Connect an application",
    intro: "is requesting access to your NavoPath account.",
    scopes: "Requested access",
    approve: "Approve",
    deny: "Deny",
    loading: "Checking authorization request…",
    missing: "This authorization request is missing its ID. Return to the MCP client and try connecting again.",
    expired: "Your NavoPath session has expired. Sign in again, then reopen this authorization request.",
    failure: "This authorization request could not be loaded. Return to the MCP client and try again.",
    working: "Working…",
    scopeNames: { openid: "Confirm your NavoPath account", profile: "Read your profile", email: "Read your email address", phone: "Read your phone number" } as Record<string, string>,
  },
  zh: {
    title: "连接应用",
    intro: "正在申请访问你的 NavoPath 账号。",
    scopes: "申请的权限",
    approve: "允许访问",
    deny: "拒绝",
    loading: "正在检查授权请求…",
    missing: "授权请求缺少 ID。请返回 MCP 客户端后重新连接。",
    expired: "NavoPath 登录状态已过期。请重新登录，再打开这次授权请求。",
    failure: "无法读取这次授权请求。请返回 MCP 客户端重试。",
    working: "正在处理…",
    scopeNames: { openid: "确认 NavoPath 账号", profile: "读取个人资料", email: "读取邮箱地址", phone: "读取电话号码" } as Record<string, string>,
  },
};

export default function OAuthConsentPage() {
  const lang = (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en") as "en" | "zh";
  const text = copy[lang];
  const [authorizationId] = useState(() => new URLSearchParams(window.location.search).get("authorization_id")?.trim() || "");
  const [state, setState] = useState<ConsentState>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!authorizationId) {
        setState({ status: "error", message: text.missing });
        return;
      }
      const api = window.plannerApi;
      if (!api?.getOAuthAuthorizationDetails) {
        setState({ status: "error", message: text.failure });
        return;
      }
      const { data, error } = await api.getOAuthAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (error || !data) {
        setState({
          status: "error",
          message: error?.message.toLowerCase().includes("session") ? text.expired : text.failure,
          details: error ? errorDetails(error) : "Supabase returned no authorization details.",
        });
        return;
      }
      if (!("authorization_id" in data)) {
        window.location.assign(data.redirect_url);
        return;
      }
      setState({
        status: "consent",
        clientName: data.client.name || "MCP client",
        scopes: data.scope.split(/\s+/).filter(Boolean),
        redirectUri: data.redirect_uri,
      });
    })().catch((error) => {
      if (!cancelled) setState({ status: "error", message: text.failure, details: errorDetails(error) });
    });
    return () => { cancelled = true; };
  }, [authorizationId, text.expired, text.failure, text.missing]);

  async function decide(approve: boolean) {
    const api = window.plannerApi;
    if (!api || busy || state.status !== "consent") return;
    setBusy(true);
    try {
      const { data, error } = approve
        ? await api.approveOAuthAuthorization?.(authorizationId) || { data: null, error: { message: "OAuth approval unavailable" } }
        : await api.denyOAuthAuthorization?.(authorizationId) || { data: null, error: { message: "OAuth denial unavailable" } };
      if (error || !data?.redirect_url) throw error || new Error("Missing redirect URL");
      window.location.assign(data.redirect_url);
    } catch (error) {
      setState({ status: "error", message: text.failure, details: errorDetails(error) });
      setBusy(false);
    }
  }

  return <main className="oauth-consent-page">
    <section className="oauth-consent-content" aria-labelledby="oauth-consent-title">
      <p className="oauth-consent-kicker">NAVOPATH · AUTHORIZATION</p>
      <h1 id="oauth-consent-title">{text.title}</h1>
      {state.status === "loading" && <p role="status">{text.loading}</p>}
      {state.status === "error" && <p className="oauth-consent-error" role="alert">
        {state.message}{state.details && <><br /><code>{state.details}</code></>}
      </p>}
      {state.status === "consent" && <>
        <p className="oauth-consent-client"><strong>{state.clientName}</strong> {text.intro}</p>
        <h2>{text.scopes}</h2>
        <ul>{state.scopes.map((scope) => <li className="oauth-consent-scope" key={scope}>{text.scopeNames[scope] || scope}</li>)}</ul>
        <p className="oauth-consent-redirect">{state.redirectUri}</p>
        <div className="oauth-consent-actions">
          <button className="oauth-consent-approve" type="button" disabled={busy} onClick={() => void decide(true)}>{busy ? text.working : text.approve}</button>
          <button className="oauth-consent-deny" type="button" disabled={busy} onClick={() => void decide(false)}>{text.deny}</button>
        </div>
      </>}
    </section>
  </main>;
}
