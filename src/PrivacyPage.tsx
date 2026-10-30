import { useEffect, useState } from "react";
import { siteLanguage } from "./productSite";
import "./privacy.css";

const policy = {
  zh: [
    ["适用范围与维护者", "本政策适用于 NavoPath 网页版、桌面版及其账户服务。服务由 NavoPath 项目维护者提供；除本政策明示的数据处理外，应用不会擅自收集或共享你的个人信息。"],
    ["我们处理哪些信息", "账户信息包括注册邮箱、用于身份验证的密码，以及你主动填写的用户名和头像。密码通过身份验证服务进行单向哈希加密存储；规划数据包括你主动创建的项目、任务、时间轴安排与使用设置。"],
    ["用途与必要性", "我们使用上述信息完成注册和登录、发送确认或密码重置邮件、保存与同步规划、恢复设置、执行你请求的排程操作，以及保障服务基础安全。我们不会将你的规划内容用于广告画像或向无关第三方出售。"],
    ["本地存储与云端同步", "应用使用浏览器本地存储、会话存储或桌面本地文件保存会话、设置及工作区缓存；云端账户的规划与设置通过安全网络连接加密传输并存储在云端数据库，以便你在不同设备间保持同步。"],
    ["AI、日历、通知与外部连接", "AI、外部日历、系统通知、MCP 和插件属于按需使用的功能。本次勾选不代替这些功能所需的独立配置、授权或连接确认。使用个人 API Key 或 MCP 服务时，相关数据直接由你指定的外部接口处理。"],
    ["服务提供商与信息共享", "当前服务使用 Supabase 提供账户验证和云端数据能力，使用 Cloudflare 提供网站托管与网络加速，使用邮件服务提供商发送系统确认与验证邮件。除维持服务运行所必需的基础服务商外，我们不会向其他第三方共享你的个人信息。"],
    ["保存期限与安全", "账户与规划信息在提供服务所需期间保存。删除或注销后，在线数据按相应操作处理；备份、安全日志或法律法规另有要求的信息在相应必要期限内保留后清除。"],
    ["访问、更正、导出与删除", "你可以在应用中查看、修改或删除规划，在设置中修改资料、导出数据、清除 AI 对话、退出登录或注销账户。注销后，服务器中与该账户直接关联的规划数据将被清理。"],
    ["未成年人保护", "本服务暂不面向未满十四周岁的儿童。已满十四周岁但未满十八周岁的用户，应在监护人指导下阅读本政策并确认使用。"],
    ["政策更新与联系方式", "本政策更新时会在本页标注日期。若处理目的、信息种类或使用方式发生重大变化，我们会通过适当方式提示；继续使用即代表你已知悉更新后的内容。"],
  ],
  en: [
    ["Scope and maintainer", "This policy covers the NavoPath web app, desktop client, and account services. Services are provided by the NavoPath maintainer. We do not collect or share personal information beyond the documented processing purposes."],
    ["Information we handle", "Account information includes your registration email, password for authentication, and any display name or avatar you provide. Passwords are cryptographically hashed; planning data includes projects, tasks, timeline schedules, and preferences you create."],
    ["Purposes and necessity", "We use this information to register and authenticate accounts, deliver transactional confirmation and reset emails, persist and synchronize planning workspaces, execute requested scheduling operations, and maintain service security. Your data is never sold or used for advertising."],
    ["Local storage and cloud sync", "The app uses browser local storage, session storage, or desktop local files to store session state, preferences, and workspace caches. Cloud accounts transmit data over secure connections to cloud databases to enable multi-device sync."],
    ["AI, calendars, notifications and connections", "AI, external calendars, system notifications, MCP, and plugins are on-demand features. This consent does not replace independent configuration or authorization required by those tools. Data sent to personal API keys or MCP servers is processed directly by the endpoints you configure."],
    ["Providers and sharing", "The service currently uses Supabase for authentication and database infrastructure, Cloudflare for hosting and delivery, and transactional email providers for verification notices. Outside these core infrastructure partners, we do not share personal information with third parties."],
    ["Retention and security", "Account and planning information is retained as long as your account remains active. Upon deletion, online records are cleared accordingly, with security logs and system backups purged after their standard retention windows."],
    ["Access, correction, export and deletion", "You can view, edit, or delete planning data within the app at any time, export your workspace from settings, clear AI history, or delete your account. Account deletion permanently removes your associated online records."],
    ["Minors", "This service is not intended for children under 14 years of age. Users aged 14 to 18 should review and accept this policy under the supervision of a parent or legal guardian."],
    ["Updates and contact", "Updates are published with a revised effective date on this page. If material changes occur to processing purposes or categories, noticeable notices will be provided."],
  ],
};

export default function PrivacyPage() {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const zh = lang === "zh";
  useEffect(() => {
    document.title = `${zh ? "隐私政策" : "Privacy Policy"} · NavoPath`;
    document.documentElement.lang = zh ? "zh-CN" : "en";
  }, [zh]);
  return <main className="np-privacy-page">
    <nav aria-label={zh ? "页面导航" : "Page navigation"}>
      <a href="/">NavoPath</a>
      <div>{(["zh", "en"] as const).map(value => <button key={value} type="button" aria-pressed={lang === value} onClick={() => {
        setLang(value);
        history.replaceState(null, "", `?lang=${value}`);
      }}>{value === "zh" ? "中文" : "EN"}</button>)}</div>
    </nav>
    <article>
      <p className="np-privacy-meta">{zh ? "更新及生效日期：2026 年 10 月 21 日" : "Updated and effective: 21 October 2026"}</p>
      <h1>{zh ? "隐私政策" : "Privacy Policy"}</h1>
      <p>{zh ? "你的计划，包含属于你的生活。我们希望你清楚这些信息如何保存、使用，以及如何由你掌控。" : "Your plans reflect your everyday life. We believe you should have complete clarity on how your data is handled and kept under your control."}</p>
      {policy[lang].map(([title, body], i) => <section key={i}><h2>{String(i + 1).padStart(2, "0")} / {title}</h2><p>{body}</p></section>)}
      <footer><a href="https://github.com/shawn89890916/NavoPath-planner/issues" target="_blank" rel="noopener noreferrer">{zh ? "联系维护者 / 项目反馈" : "Contact the maintainer / Project feedback"}</a><a href="/">{zh ? "返回首页" : "Back to home"}</a></footer>
    </article>
  </main>;
}
