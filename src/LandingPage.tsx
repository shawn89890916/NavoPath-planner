import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import { type CSSProperties, useEffect, useState } from "react";
import { ProductIcon } from "./WorkspacePresentation";
import { DESKTOP_DOWNLOAD_URL } from "./downloads";
import { CloseButton, IconButton } from "./components/UiPrimitives";
import { UiEyeIcon } from "./components/UiIcons";
import { setAuthPersistencePreference } from "./authSessionStorage";
import { PrivacyConsent } from "./components/PrivacyConsent";
import PasswordResetRequest from "./components/PasswordResetRequest";
import LandingPortals from "./LandingPortals";
import ProductScreenshot from "./ProductScreenshot";
import { prefersReducedMotion } from "./motion";
import { PERSONAL_SITE_URL, PRODUCT_FEATURES, featureHref, featureNames, principleHref, siteHref, siteLanguage } from "./productSite";
import "./landing.css";

type AuthIntent = "signin" | "signup";
type Lang = "en" | "zh";

const copy = {
  en: {
    productName: "NavoPath",
    title: "See what to do today — and when to do it.",
    scroll: "Scroll to explore", start: "Start now", download: "Download for Windows",
    stepsKicker: "Workspace", stepsTitle: "Take a task from the project tree to today’s timeline.",
    steps: [
      ["01", "Break down a project", "Turn a project into steps you can act on."],
      ["02", "Choose what to advance today", "Move the next task into Today’s Candidates."],
      ["03", "Make time for it", "Place that same task into an open slot on your timeline."],
    ],
    dockTitle: "Keep NavoPath at the edge of your screen.",
    dockBody: "In the desktop app, use the N in the top left to dock on either side. Reopen from the screen-edge tab, or select N again to restore a normal window.",
    marketTitle: "Add the views and tools you need.",
    marketBody: "Browse the plugin market in Settings to add views such as Board, Matrix, and List to your workspace.",
    marketLink: "Explore the plugin market",
    ctaTitle: "Do one thing well today.", ctaBody: "Open NavoPath and start planning your day.",
  },
  zh: {
    productName: "NavoPath",
    title: "今天要做的事，排得清清楚楚",
    scroll: "向下浏览", start: "立即开始", download: "下载 Windows 客户端",
    stepsKicker: "一体化工作区", stepsTitle: "让一项任务从项目树走到今天的时间轴。",
    steps: [
      ["01", "拆解项目", "把一个项目拆成可以着手的行动。"],
      ["02", "挑选今天要推进的事", "将下一项任务加入今日候选。"],
      ["03", "给任务留出时间", "把同一项任务排入时间轴上的空闲时段。"],
    ],
    dockTitle: "把 NavoPath 停靠在屏幕边缘。",
    dockBody: "在桌面端点击左上角的 N，选择停靠在左侧或右侧。通过屏幕边缘的小条重新展开，再点击 N 即可恢复普通窗口。",
    marketTitle: "按需添加视图和工具。",
    marketBody: "在设置中浏览插件市场，为工作区添加看板、矩阵、列表等视图。",
    marketLink: "了解插件市场",
    ctaTitle: "从今天开始，理清节奏。", ctaBody: "打开 NavoPath，开始规划你的每日日程。",
  },
} as const;

function AuthDialog({ lang, onClose, onLogin, onResend, onContinueAfterConfirm, onForgotPassword, busy, error, notice }: {
  lang: Lang;
  onClose: () => void;
  onLogin: (email: string, password: string, displayName: string, intent: AuthIntent, theme: "light" | "dark", privacyAccepted: boolean) => void;
  onResend: (email: string) => void;
  onContinueAfterConfirm: (email: string) => void;
  onForgotPassword: (email: string) => Promise<void>;
  busy: boolean;
  error: string;
  notice: { type: "confirm-email"; email: string } | null;
}) {
  const [authIntent, setAuthIntent] = useState<AuthIntent>("signin");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const text = lang === "zh" ? {
    account: "NavoPath 账户", welcome: "欢迎回来。", begin: "理清计划，从当下开始。", signIn: "登录", signUp: "注册", name: "用户名 / 昵称", email: "电子邮箱", password: "密码（至少 6 位）", confirm: "确认密码", show: "显示密码", hide: "隐藏密码", save: "记住密码", inbox: "请查收确认邮件", inboxBody: "验证邮件已发送至该邮箱。请点击邮件中的链接完成验证后再登录。", resend: "重新发送邮件", continue: "前往登录", mismatch: "两次输入的密码不一致。", working: "正在处理…", open: "进入工作区", create: "创建账户", forgot: "忘记密码？",
  } : {
    account: "NavoPath Account", welcome: "Welcome back.", begin: "Start your path.", signIn: "Sign in", signUp: "Sign up", name: "Display name", email: "Email", password: "Password (6+ characters)", confirm: "Confirm password", show: "Show password", hide: "Hide password", save: "Save password", inbox: "Check your inbox", inboxBody: "A verification email has been sent. Please click the link to confirm before signing in.", resend: "Resend email", continue: "Continue to sign in", mismatch: "Passwords do not match.", working: "Working...", open: "Open workspace", create: "Create account", forgot: "Forgot password?",
  };
  const passwordMismatch = authIntent === "signup" && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  return <div className="landing-auth-overlay" onMouseDown={onClose}>
    <section className="landing-auth-card" onMouseDown={(event) => event.stopPropagation()}>
      <CloseButton className="landing-auth-close" label={lang === "zh" ? "关闭" : "Close"} onClick={onClose} />
      <div className="landing-auth-brand"><ProductIcon /><span className="landing-auth-label">{text.account}</span></div>
      {forgotPassword ? <PasswordResetRequest lang={lang} email={email} onRequest={onForgotPassword} onBack={() => setForgotPassword(false)} landing /> : <>
        <h2>{authIntent === "signin" ? text.welcome : text.begin}</h2>
        <div className="landing-auth-tabs"><button className={authIntent === "signin" ? "active" : ""} onClick={() => { if (authIntent !== "signin") setPrivacyAccepted(false); setAuthIntent("signin"); }}>{text.signIn}</button><button className={authIntent === "signup" ? "active" : ""} onClick={() => { if (authIntent !== "signup") setPrivacyAccepted(false); setAuthIntent("signup"); }}>{text.signUp}</button></div>
        <form autoComplete="on" onSubmit={(event) => { event.preventDefault(); if (!busy && privacyAccepted && !passwordMismatch) { setAuthPersistencePreference(savePassword); onLogin(email.trim(), password, displayName.trim(), authIntent, "light", privacyAccepted); } }}>
          {authIntent === "signup" && <input name="name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={text.name} maxLength={64} />}
          <input name="email" autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={text.email} required />
          <div className="landing-auth-password-field">
            <input name="password" autoComplete={authIntent === "signin" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.password} minLength={6} required />
            <IconButton className="landing-password-visibility" icon={<UiEyeIcon />} label={showPassword ? text.hide : text.show} onClick={() => setShowPassword((visible) => !visible)} />
          </div>
          {authIntent === "signup" && <div className="landing-auth-password-field">
            <input name="confirm-password" autoComplete="new-password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={text.confirm} minLength={6} required />
            <IconButton className="landing-password-visibility" icon={<UiEyeIcon />} label={showPassword ? text.hide : text.show} onClick={() => setShowPassword((visible) => !visible)} />
          </div>}
          <div className="landing-auth-account-actions">
            <label className="landing-auth-check"><input type="checkbox" checked={savePassword} onChange={(event) => setSavePassword(event.target.checked)} />{text.save}</label>
            {authIntent === "signin" && <button type="button" className="landing-forgot-link" disabled={busy} onClick={() => setForgotPassword(true)}>{text.forgot}</button>}
          </div>
          <PrivacyConsent lang={lang} checked={privacyAccepted} onChange={setPrivacyAccepted} disabled={busy} />
          {notice && <div className="landing-auth-notice"><strong>{text.inbox}</strong><p>{text.inboxBody}<br />{notice.email}</p><button type="button" onClick={() => onResend(notice.email)}>{text.resend}</button><button type="button" disabled={busy || !privacyAccepted} onClick={() => { if (privacyAccepted) onContinueAfterConfirm(notice.email); }}>{text.continue}</button></div>}
          {passwordMismatch && <p className="landing-auth-error">{text.mismatch}</p>}{error && <p className="landing-auth-error">{error}</p>}
          <button className="landing-button primary full" disabled={busy || !privacyAccepted || passwordMismatch}>{busy ? text.working : authIntent === "signin" ? text.open : text.create}</button>
        </form>
      </>}
    </section>
  </div>;
}

type LandingAuth = {
  onLogin: (email: string, password: string, displayName: string, intent: AuthIntent, theme: "light" | "dark", privacyAccepted: boolean) => void;
  onResend: (email: string) => void;
  onContinueAfterConfirm: (email: string) => void;
  onForgotPassword: (email: string) => Promise<void>;
  busy: boolean;
  error: string;
  notice: { type: "confirm-email"; email: string } | null;
  initialShowAuth?: boolean;
  signedIn?: boolean;
};

export default function LandingPage(props: LandingAuth | { preview: true }) {
  const auth = "preview" in props ? null : props;
  const [lang, setLang] = useState<Lang>(() => siteLanguage(location.search));
  const [showAuth, setShowAuth] = useState(auth?.initialShowAuth ?? false);
  const [coverRecede, setCoverRecede] = useState(0);
  const [portalExit, setPortalExit] = useState(0);
  const [entering, setEntering] = useState(() => !prefersReducedMotion() && window.scrollY < 1 && !location.hash);
  const c = copy[lang];

  useEffect(() => {
    document.documentElement.classList.add("landing-document");
    const nodes = [document.documentElement, document.body, document.getElementById("root")].filter(Boolean) as HTMLElement[];
    const previous = nodes.map((node) => node.getAttribute("style"));
    nodes.forEach((node) => {
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("min-height", "100%", "important");
      node.style.setProperty("overflow-y", "auto", "important");
      node.style.setProperty("overflow-x", "clip", "important");
      node.style.setProperty("touch-action", "pan-y", "important");
      node.style.setProperty("overscroll-behavior-y", "auto", "important");
    });
    return () => {
      document.documentElement.classList.remove("landing-document");
      nodes.forEach((node, index) => {
        const style = previous[index];
        if (style === null) node.removeAttribute("style");
        else node.setAttribute("style", style);
      });
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const endEntrance = () => setEntering(false);
    const update = () => {
      frame = 0;
      const viewport = Math.max(window.innerHeight, 1);
      if (window.scrollY > 0) setEntering(false);
      const distance = Math.min(1, Math.max(0, (window.scrollY - viewport * .1) / (viewport * 1.4)));
      const progress = distance ** .34;
      setCoverRecede((current) => Math.abs(current - progress) < .01 ? current : progress);
      const exit = Math.min(1, Math.max(0, window.scrollY / (viewport * .58)));
      setPortalExit(current => Math.abs(current - exit) < .004 ? current : exit);
    };
    const requestUpdate = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reduced.addEventListener("change", endEntrance);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reduced.removeEventListener("change", endEntrance);
    };
  }, []);

  const coverStyle = {
    "--landing-cover-scale": String(1 - coverRecede * .16),
    "--landing-cover-gray": String(coverRecede * .98),
    "--landing-cover-brightness": String(1 - coverRecede * .22),
    "--landing-cover-opacity": String(1 - coverRecede * .56),
  } as CSSProperties;

  return <div className={`landing${entering ? " landing--entering" : ""}`} lang={lang} onPointerDownCapture={() => setEntering(false)} onKeyDownCapture={() => setEntering(false)} onFocusCapture={() => setEntering(false)} onAnimationEnd={event => { if (event.animationName === "landing-preview-arrive") setEntering(false); }}>
    <nav className="landing-nav" aria-label="NavoPath">
      <a className="landing-brand" href={siteHref(`/?lang=${lang}`)}><ProductIcon compact /><span>NavoPath</span></a>
      <div className="landing-nav-links"><ProductMenu lang={lang} /><ProductMenu lang={lang} kind="principles" /><ProductMenu lang={lang} kind="support" includeGitHub /></div>
      <div className="landing-nav-actions"><SiteLanguageSwitch lang={lang} onChange={setLang} /><a className="np-start-link" href="/app" onClick={(event) => { if (auth && !auth.signedIn) { event.preventDefault(); setShowAuth(true); } }}>{lang === "zh" ? "立即开始" : "Start now"}</a></div>
    </nav>
    <main>
      <section className="landing-cover" id="top"><LandingPortals lang={lang} recede={portalExit} /><div className="landing-cover-content" style={coverStyle}><div className="landing-cover-logo"><ProductIcon /></div><div className="landing-brand-copy"><p className="landing-product-name">{c.productName}</p><h1 className="landing-slogan">{c.title}</h1></div></div><span className="landing-product-scroll-cue" aria-hidden="true"><i>↑</i>{c.scroll}</span></section>
      <section className="landing-product-rise" aria-label={featureNames[lang].workspace}>
        <ProductScreenshot feature="workspace" lang={lang} alt={lang === "zh" ? "NavoPath 项目规划工作区" : "The NavoPath project workspace"} eager />
      </section>
      <section className="landing-steps" id="how-it-works"><div className="landing-steps-intro"><span>01 / {c.stepsKicker}</span><h2>{c.stepsTitle}</h2></div><ol>{c.steps.map(([number, title, body]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
      <section className="landing-planning" id="desktop-dock">
        <div className="landing-planning-copy"><h2>{c.dockTitle}</h2><p>{c.dockBody}</p></div>
      </section>
      <section className="landing-planning" id="plugin-market">
        <div className="landing-planning-copy"><h2>{c.marketTitle}</h2><p>{c.marketBody}</p><a className="landing-button quiet" href={featureHref("plugins", lang)}>{c.marketLink}<span aria-hidden="true">→</span></a></div>
        <div className="landing-planning-preview"><ProductScreenshot feature="plugins" lang={lang} alt={featureNames[lang].plugins} /></div>
      </section>
      <section className="landing-cta"><span>03 / NAVOPATH</span><h2>{c.ctaTitle}</h2><p>{c.ctaBody}</p><div className="landing-actions">{auth ? <button className="np-start-link" onClick={() => setShowAuth(true)}>{c.start}</button> : <a className="np-start-link" href="/app">{c.start}</a>}<a className="landing-button quiet" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">{c.download}<span>→</span></a></div></section>
    </main>
    <footer className="landing-footer"><nav aria-label={lang === "zh" ? "产品功能" : "Features"}>{PRODUCT_FEATURES.map(feature => <a key={feature} href={featureHref(feature, lang)}>{featureNames[lang][feature]}</a>)}<a href={siteHref(`/privacy?lang=${lang}`)}>{lang === "zh" ? "隐私政策" : "Privacy Policy"}</a></nav><a className="landing-footer-author" href={PERSONAL_SITE_URL} target="_blank" rel="noreferrer">© 2026 Xiaoyang Chen</a><a className="landing-footer-principles" href={principleHref("index", lang)}>{lang === "zh" ? "设计原理" : "Principles"}</a></footer>
    {auth && showAuth && <AuthDialog lang={lang} onClose={() => setShowAuth(false)} onLogin={auth.onLogin} onResend={auth.onResend} onContinueAfterConfirm={auth.onContinueAfterConfirm} onForgotPassword={auth.onForgotPassword} busy={auth.busy} error={auth.error} notice={auth.notice} />}
  </div>;
}
