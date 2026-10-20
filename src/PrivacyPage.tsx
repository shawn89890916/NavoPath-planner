import { useEffect, useState } from "react";
import { siteLanguage } from "./productSite";
import "./privacy.css";

const policy = {
  zh: [
    ["适用范围与维护者", "本政策适用于 NavoPath 网页版、桌面版及其账户服务。服务由 NavoPath 项目维护者提供，项目地址为 github.com/shawn89890916/NavoPath-planner。它说明我们为提供服务如何处理信息，以及你可以如何管理自己的数据。请在登录或注册前阅读；不同意时请停止登录或注册。"],
    ["我们处理哪些信息", "账户信息包括注册邮箱、用于身份验证的密码，以及你主动填写的用户名和头像。密码通过身份验证服务处理，应用不会将明文密码保存到任务数据中。规划信息包括你创建或导入的项目、任务、笔记、日程、习惯、执行记录、投入度评分和设置。使用 AI 时，还可能处理对话、所附内容及相关规划上下文。网络基础设施和身份验证服务可能处理 IP 地址、请求时间、设备或浏览器信息、错误及安全日志，以交付服务并防范滥用。"],
    ["用途与必要性", "我们使用上述信息完成注册和登录、发送确认或密码重置邮件、保存与同步规划、恢复设置、执行你请求的功能，以及排查故障和保障安全。注册邮箱和身份验证信息用于账户服务；用户名、头像和任务内容由你选择提供。请只提交使用功能所需的内容，避免上传身份证件、金融账户、健康信息及未经授权的他人资料。"],
    ["本地存储与云端同步", "应用使用浏览器本地存储、会话存储或桌面本地文件保存会话、设置及工作区缓存；云端账户的规划与设置还会同步到服务器。登录页的“保存密码”实际控制登录会话是否跨浏览器会话保留，并不表示应用保存明文密码。退出登录不等于删除所有本地缓存；共用设备使用后请退出，并按需要清理站点数据。启用云盘桥接后，镜像文件也会保存在你指定的本地目录或云盘，遵循对应服务的政策。"],
    ["AI、日历、通知与外部连接", "AI、外部日历、系统通知、MCP 和插件属于按需使用的功能。本次勾选不代替这些功能所需的独立授权。发起 AI 请求或启用自动助手时，服务会按功能需要向所用模型服务传送消息、附件提取内容和相关规划上下文；模型输出可能有误，请在采取重要行动前核对。连接外部日历后会处理订阅地址和事件；授权第三方连接后，第三方可在授权范围内读取或修改规划。通知权限由系统单独询问。你可以停用相关功能、移除订阅或撤销连接与令牌。"],
    ["服务提供商与信息共享", "当前服务使用 Supabase 提供账户验证和云端数据能力，使用 Cloudflare 提供网页及部分后端服务；AI 处理还涉及实际选用的模型提供商，例如 SiliconFlow、DeepSeek 或 TypeSafe。你主动启用的云盘、日历、插件或连接服务也可能处理对应信息。我们仅为提供功能、安全维护或依法履行义务处理及共享必要信息，不出售个人信息，不将规划内容用于广告画像。服务提供商可能在你所在地区以外处理数据，其隐私政策和实际部署同样适用。涉及依法需单独同意的处理，应另行告知并取得相应同意。"],
    ["保存期限与安全", "账户与规划信息在提供服务所需期间保存。删除或注销后，在线数据按相应操作处理；备份、安全日志及依法需要保留的记录可能在必要期限内继续保存。我们采用身份验证、账户访问限制和传输保护等措施降低风险，但无法保证任何网络系统绝对安全。第三方客户端、你导出的文件和云盘副本需要由你在相应位置管理；注销账户不会自动移除这些副本。"],
    ["访问、更正、导出与删除", "你可以在应用中查看、修改或删除规划，在设置中修改资料、导出数据、清除 AI 对话、退出登录或注销账户。注销前建议先导出所需资料。对于本地缓存和已导出的文件，请自行删除；对于授权的第三方副本，请向对应服务申请处理。你可以通过下方项目反馈入口提出访问、更正、删除、撤回同意或其他隐私请求。撤回后，依赖相关信息的功能可能无法继续提供；撤回不影响此前合法进行的处理。"],
    ["未成年人", "本服务暂不面向未满十四周岁的儿童。已满十四周岁但未满十八周岁的用户，应在监护人指导下阅读本政策并使用服务。若你发现儿童在不符合条件的情况下提供了个人信息，请通过项目反馈入口联系维护者处理。"],
    ["政策更新与联系", "本政策更新时会在本页标注日期。若处理目的、信息种类或使用方式发生重大变化，我们会通过适当方式提示，并在法律要求时重新征求同意。隐私问题可通过下方 GitHub 项目反馈入口联系维护者；公开反馈只描述问题类型，不要附上密码、令牌、完整邮箱、私人日程或其他敏感信息。维护者将按适用要求核实并处理请求。"],
  ],
  en: [
    ["Scope and maintainer", "This policy covers the NavoPath web app, desktop app and account services, provided by the NavoPath project maintainer at github.com/shawn89890916/NavoPath-planner. It explains how information is handled to deliver the service and how you can manage your data. Read it before signing in or creating an account. If you disagree, do not sign in or register."],
    ["Information we handle", "Account information includes your registration email, a password processed by the authentication service, and any display name or avatar you provide. The app does not save plaintext passwords in planner data. Planner information includes projects, tasks, notes, schedules, habits, execution records, engagement ratings and settings you create or import. AI features may also process conversations, attached content and relevant planning context. Infrastructure and authentication providers may process IP addresses, request times, device or browser information, errors and security logs to deliver and protect the service."],
    ["Purposes and necessity", "We use this information to register and authenticate accounts, send confirmation or password reset emails, save and sync plans, restore settings, carry out requested features, troubleshoot and maintain security. Your email and authentication information are needed for account services. Names, avatars and planning content are provided at your discretion. Submit only what a feature needs. Avoid identity documents, financial account details, health information and other people's information without permission."],
    ["Local storage and cloud sync", "The app uses browser local storage, session storage or desktop files for sessions, settings and workspace caches. Cloud accounts also sync planner data and settings to servers. The login option labelled Save password controls whether your sign-in session persists across browser sessions; it does not mean the app stores a plaintext password. Signing out does not delete every local cache. On shared devices, sign out and clear site data as needed. Enabling a cloud-drive bridge also creates copies in the local folder or cloud drive you choose, subject to that service's policy."],
    ["AI, calendars, notifications and connections", "AI, external calendars, system notifications, MCP and plugins are optional features. Agreeing here does not replace any separate authorization they require. Sending an AI request or enabling an automated assistant may transmit messages, extracted attachment content and relevant planning context to the selected model provider. AI output may be wrong; check it before important actions. Calendar connections process subscription URLs and events. Authorized third-party connections may read or modify plans within their granted access. The system asks separately for notification permission. You can disable features, remove subscriptions, or revoke connections and tokens."],
    ["Providers and sharing", "The service currently uses Supabase for authentication and cloud data, and Cloudflare for hosting and some backend services. AI processing also involves the selected model provider, such as SiliconFlow, DeepSeek or TypeSafe. Drive, calendar, plugin and connection services you enable may process the corresponding data. We process and share necessary information to provide features, protect the service or meet legal obligations. We do not sell personal information or use planning content for advertising profiles. Providers may process data outside your region, subject to their policies and actual deployment. Processing that legally requires separate consent must be disclosed and separately agreed to."],
    ["Retention and security", "Account and planning information is retained for as long as needed to provide the service. Deletion and account closure act on online data through the relevant operation; backups, security logs and legally required records may remain for necessary periods. Authentication, account access controls and transport protection help reduce risk, but no networked system is absolutely secure. You manage third-party clients, exported files and cloud-drive copies where they are stored. Closing your account does not automatically remove those copies."],
    ["Access, correction, export and deletion", "You can view, edit and delete plans in the app. Settings let you edit your profile, export data, clear AI conversations, sign out or close your account. Export anything you need before closing an account. Delete local caches and exported files yourself, and ask the relevant provider to handle third-party copies. Use the project feedback link below for access, correction, deletion, withdrawal of consent or other privacy requests. Features depending on the information may become unavailable after withdrawal. Withdrawal does not affect prior lawful processing."],
    ["Minors", "This service is currently not intended for children under fourteen. Users aged fourteen to seventeen should review this policy and use the service with a guardian's guidance. If you discover that a child has provided personal information without meeting these conditions, contact the maintainer through project feedback so it can be addressed."],
    ["Updates and contact", "Updates will be dated on this page. Material changes to purposes, information categories or use will be brought to your attention appropriately, with renewed consent where legally required. For privacy questions, contact the maintainer through the GitHub project feedback link below. Public reports should describe only the type of issue. Do not post passwords, tokens, full email addresses, private schedules or other sensitive information. Requests will be verified and handled according to applicable requirements."],
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
      <p>{zh ? "你的计划，包含属于你的生活。我们希望你清楚这些信息如何保存、使用，以及如何由你掌控。" : "Your plans contain pieces of your life. You should know how that information is stored, used and kept under your control."}</p>
      {policy[lang].map(([title, body], i) => <section key={i}><h2>{String(i + 1).padStart(2, "0")} / {title}</h2><p>{body}</p></section>)}
      <footer><a href="https://github.com/shawn89890916/NavoPath-planner/issues" target="_blank" rel="noopener noreferrer">{zh ? "联系维护者 / 项目反馈" : "Contact the maintainer / Project feedback"}</a><a href="/">{zh ? "返回首页" : "Back to home"}</a></footer>
    </article>
  </main>;
}
