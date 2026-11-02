import { useState } from "react";
import { detectSystemLanguage } from "./i18n";
import type { Language } from "./types";
import "./plugin-guide.css";

const MCP_ENDPOINT = import.meta.env.VITE_MCP_ENDPOINT || "https://navopath-mcp.shawn89890916.workers.dev/mcp";

function DocCodeBlock({ value, label, language }: { value: string; label: string; language: Language }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return <div className="df-doc-code-block">
    <div><span>{label}</span><button type="button" onClick={() => void copy()}>{copied ? (language === "zh" ? "已复制" : "Copied") : (language === "zh" ? "复制" : "Copy")}</button></div>
    <pre><code>{value}</code></pre>
  </div>;
}

export default function PluginGuidePage() {
  const [language, setLanguage] = useState<Language>(detectSystemLanguage());
  const zh = language === "zh";
  const labels = {
    back: zh ? "返回工作区" : "Back to app",
    tag: zh ? "社区插件 / 主题 / MCP" : "COMMUNITY PLUGINS / THEMES / MCP",
    title: zh ? "插件系统与 MCP 连接指南" : "Plugins and MCP Integration Guide",
    intro: zh
      ? "通过独立安装包扩展 NavoPath 的工具、计时模式与外观；通过 Model Context Protocol (MCP) 让 AI 客户端读取与操作你的规划数据。"
      : "Extend NavoPath tools, timer modes, and appearance with independent packages. Connect AI clients to planning data through Model Context Protocol (MCP).",
    mcp: zh ? "在新设备上连接 NavoPath" : "Connect NavoPath on a New Computer",
    plugins: zh ? "安装插件与主题" : "Install plugins and themes",
    security: zh ? "安全与权限边界" : "Security & Permission Boundaries",
    host: zh ? "宿主环境能力" : "Host Environment Capabilities",
  };
  const codexConfig = `[mcp_servers.navopath]\nurl = "${MCP_ENDPOINT}"\nbearer_token_env_var = "NAVOPATH_MCP_TOKEN"`;
  const windowsTokenCommand = `[Environment]::SetEnvironmentVariable("NAVOPATH_MCP_TOKEN", "nvp_YOUR_TOKEN", "User")`;
  const unixTokenCommand = `# macOS (zsh)\necho 'export NAVOPATH_MCP_TOKEN="nvp_YOUR_TOKEN"' >> ~/.zshrc\n\n# Linux (bash)\necho 'export NAVOPATH_MCP_TOKEN="nvp_YOUR_TOKEN"' >> ~/.bashrc`;
  const claudeWindowsConfig = `{
  "mcpServers": {
    "navopath": {
      "command": "cmd",
      "args": [
        "/c", "npx", "-y", "mcp-remote",
        "${MCP_ENDPOINT}",
        "--header", "Authorization: Bearer nvp_YOUR_TOKEN"
      ]
    }
  }
}`;
  const claudeUnixConfig = `{
  "mcpServers": {
    "navopath": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "${MCP_ENDPOINT}",
        "--header", "Authorization: Bearer nvp_YOUR_TOKEN"
      ]
    }
  }
}`;

  return <main className="df-doc-page changelog-like">
    <nav className="df-doc-sidebar" aria-label={zh ? "文档导航" : "Documentation Navigation"}>
      <a href="/app">← {labels.back}</a>
      <div className="df-doc-language" aria-label={zh ? "文档语言" : "Documentation Language"}>
        <button type="button" className={zh ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
        <button type="button" className={!zh ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
      </div>
    </nav>
    <article className="df-doc-content">
      <header className="df-doc-hero"><span>{labels.tag}</span><h1>{labels.title}</h1><p>{labels.intro}</p></header>
      <section id="mcp" className="df-doc-section">
        <h2>{labels.mcp}</h2>
        <p className="df-doc-lede">{zh ? "建议为每台设备生成独立令牌。完成以下三个配置步骤后，Codex 或 Claude Desktop 即可联动 NavoPath。" : "We recommend generating a dedicated token for each device. Complete the three steps below to connect Codex or Claude Desktop with NavoPath."}</p>
        <div className="df-doc-steps" aria-label={zh ? "配置步骤" : "Setup Steps"}>
          <article><span>01</span><div><h3>{zh ? "1. 登录同一云端账户" : "1. Sign in to the Same Account"}</h3><p>{zh ? "在新设备上打开 NavoPath，登录保存规划数据的云端账户。" : "Open NavoPath on the new computer and sign in to the cloud account holding your planning data."}</p></div></article>
          <article><span>02</span><div><h3>{zh ? "2. 创建设备专属令牌" : "2. Generate Device Token"}</h3><p>{zh ? "前往“设置 → 日历与集成 → MCP”。按设备名称生成专用令牌，并妥善复制保存。" : "Go to Settings → Calendar & Integrations → MCP. Create a token labelled with your device name and copy it securely."}</p></div></article>
          <article><span>03</span><div><h3>{zh ? "3. 配置客户端并验证连接" : "3. Configure Client & Verify"}</h3><p>{zh ? "根据你使用的客户端填入配置，彻底退出客户端后重新打开，并在对话中测试列出 NavoPath 任务。" : "Apply configuration for your chosen client, fully restart the client application, and test by listing your NavoPath tasks."}</p></div></article>
        </div>
        <aside className="df-doc-note"><span>{zh ? "连接参数" : "Connection Parameters"}</span><dl>
          <div><dt>{zh ? "服务地址 (Endpoint)" : "Service Endpoint"}</dt><dd><code>{MCP_ENDPOINT}</code></dd></div>
          <div><dt>{zh ? "传输协议 (Transport)" : "Transport Protocol"}</dt><dd>Streamable HTTP</dd></div>
          <div><dt>{zh ? "身份认证请求头" : "Authentication Header"}</dt><dd><code>Authorization: Bearer nvp_...</code></dd></div>
        </dl></aside>
      </section>
      <section id="codex" className="df-doc-section df-doc-client">
        <div className="df-doc-section-heading"><span>CLIENT 01</span><h2>Codex</h2></div>
        <p>{zh ? "Codex 桌面端、CLI 与 IDE 插件共享同一份本机配置文件。请将令牌妥善保存在本地配置中。" : "Codex desktop, CLI, and IDE extensions share a single local configuration. Store your token securely in the config file."}</p>
        <ol className="df-doc-checklist"><li>{zh ? "将下列配置写入 ~/.codex/config.toml。Windows 用户可直接使用对应的 PowerShell 路径。" : "Add the block below to ~/.codex/config.toml (or the corresponding Windows PowerShell path)."} {zh ? <>Windows 路径：<code>$HOME\.codex\config.toml</code>。</> : <>Windows path: <code>$HOME\.codex\config.toml</code>.</>}</li></ol>
        <DocCodeBlock value={codexConfig} label="CONFIG.TOML" language={language} />
        <div className="df-doc-platforms">
          <article><span>WINDOWS · POWERSHELL</span><p>{zh ? "将配置中的占位符替换为刚刚生成的设备令牌，然后执行：" : "Replace the placeholder with your generated token, then run:"}</p><DocCodeBlock value={windowsTokenCommand} label="POWERSHELL" language={language} /></article>
          <article><span>MACOS / LINUX</span><p>{zh ? "选择匹配当前操作系统的命令；使用自定义 shell 时请写入对应环境变量文件。" : "Run the command for your operating system, or add it to your shell profile."}</p><DocCodeBlock value={unixTokenCommand} label="SHELL" language={language} /></article>
        </div>
        <ol className="df-doc-checklist" start={2}><li>{zh ? "彻底退出 Codex 进程并重新打开。" : "Completely quit Codex and reopen it."}</li><li>{zh ? "打开 MCP 插件列表确认 navopath 显示为已连接，或直接在对话中输入“列出我的 NavoPath 今日任务”进行验证。" : "Check the MCP tools list to confirm 'navopath' is active, or prompt the assistant to list your NavoPath tasks for today."}</li></ol>
      </section>
      <section id="claude" className="df-doc-section df-doc-client">
        <div className="df-doc-section-heading"><span>CLIENT 02</span><h2>Claude Desktop</h2></div>
        <p>{zh ? "Claude Desktop 可通过 mcp-remote 工具桥接带有 Bearer 认证的远程 MCP 端点。" : "Claude Desktop connects to Bearer-authenticated endpoints via the mcp-remote bridge."}</p>
        <ol className="df-doc-checklist"><li>{zh ? "请先安装 Node.js 环境，并启动一次 Claude Desktop 以便自动生成初始配置文件目录。" : "Ensure Node.js is installed, and launch Claude Desktop once to create default configuration files."} {zh ? <>Windows 配置位置为 <code>%APPDATA%\Claude\claude_desktop_config.json</code>，macOS 为 <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>。</> : <>Open <code>%APPDATA%\Claude\claude_desktop_config.json</code> on Windows or <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS.</>}</li><li>{zh ? "将 nvp_YOUR_TOKEN 替换为当前设备生成的令牌，并保存配置文件。" : "Replace nvp_YOUR_TOKEN with the device token and save changes."}</li></ol>
        <div className="df-doc-platforms">
          <article><span>WINDOWS</span><DocCodeBlock value={claudeWindowsConfig} label="CLAUDE_DESKTOP_CONFIG.JSON" language={language} /></article>
          <article><span>MACOS / LINUX</span><DocCodeBlock value={claudeUnixConfig} label="CLAUDE_DESKTOP_CONFIG.JSON" language={language} /></article>
        </div>
        <ol className="df-doc-checklist" start={3}><li>{zh ? "彻底退出 Claude Desktop 后重新启动，点击输入框旁的附件或工具图标，确认 navopath 工具已成功挂载。" : "Completely restart Claude Desktop. Check the tools menu to ensure NavoPath integration is listed."}</li></ol>
      </section>
      <section id="move" className="df-doc-section">
        <div className="df-doc-section-heading"><span>{zh ? "换机与多设备指南" : "NEW COMPUTER SETUP"}</span><h2>{zh ? "迁移到新设备" : "Migrating to a New Machine"}</h2></div>
        <div className="df-doc-transfer"><p>{zh ? "在新设备上重复操作流程：生成独立令牌、保存配置、填入客户端、重启并完成可用性验证。" : "Repeat the steps on the new device: create a dedicated token, save client configuration, restart, and test connectivity."}</p><ul>
          <li>{zh ? "令牌建议按设备命名便于识别，例如 Office-PC、MacBook-Air。" : "Name tokens by device (e.g. Office-PC, MacBook-Air) to keep them organized."}</li>
          <li>{zh ? "请勿在公开聊天、截屏、云盘共享目录或 Git 仓库中暴露你的 MCP 令牌。" : "Never expose tokens in screenshots, public chat logs, shared cloud folders, or git repositories."}</li>
          <li>{zh ? "若怀疑令牌泄露，请立即在 NavoPath 的 MCP 设置中撤销该令牌并重新生成。" : "If a token is compromised, revoke it immediately in NavoPath MCP Settings and issue a new one."}</li>
        </ul></div>
      </section>
      <section id="troubleshooting" className="df-doc-section">
        <div className="df-doc-section-heading"><span>{zh ? "常见问题与排障" : "QUICK DIAGNOSIS"}</span><h2>{zh ? "客户端未显示连接" : "Connection Not Showing"}</h2></div>
        <table className="df-doc-troubleshooting"><tbody>
          <tr><th><code>401</code></th><td>{zh ? "令牌可能不完整、已被撤销或请求头格式错误。请重新生成设备专属令牌并检查配置中的 Bearer 前缀。" : "The token may be invalid, revoked, or formatted incorrectly. Generate a fresh token and ensure the Bearer prefix is intact."}</td></tr>
          <tr><th>{zh ? "未能读取到工作区数据" : "Workspace Data Missing"}</th><td>{zh ? "请确认在 NavoPath 中已登录同一云端账户，且工作区数据已成功同步加载。" : "Ensure you are signed in to the same NavoPath cloud account and that workspace sync is up to date."}</td></tr>
          <tr><th>{zh ? "客户端提示服务不存在" : "Server Not Found"}</th><td>{zh ? "请核对服务地址结尾是否包含 /mcp，保存配置文件后需彻底重启客户端进程。" : "Verify that the endpoint URL ends with /mcp, save configuration, and fully restart the client application."}</td></tr>
          <tr><th><code>PROFILE_REVISION_CONFLICT</code></th><td>{zh ? "可先让客户端读取规划数据，再尝试执行写操作。" : "Try reading planning data first before triggering modification requests."}</td></tr>
          <tr><th>{zh ? "Claude 无法正常启动" : "Claude Startup Issue"}</th><td>{zh ? "请确认系统中已安装 Node.js 与 npx 命令；Windows 系统中路径反斜杠需转义处理。" : "Verify that Node.js and npx are installed and accessible; ensure file paths in Windows use properly escaped backslashes."}</td></tr>
        </tbody></table>
      </section>
      <section id="plugins" className="df-doc-section"><h2>{labels.plugins}</h2>
        <ol className="df-doc-checklist">
          <li>{zh ? "插件位于“设置 → 插件”；主题位于“设置 → 外观”。点击“浏览市场”，从当前来源按插件或主题类型浏览并安装。" : "Open Settings → Plugins for plugins, or Settings → Appearance for themes. Browse market shows the matching package type from your configured sources."}</li>
          <li>{zh ? "也可导入 ZIP 或 .navopackage.json 扩展包。来源管理支持添加 HTTPS 市场索引。移除来源会保留已安装扩展。" : "You can also import a ZIP or .navopackage.json package. Manage sources accepts HTTPS catalog indexes. Removing a source keeps installed extensions."}</li>
          <li>{zh ? "在已安装列表中启用、停用、更新、回退或卸载。插件专属设置在插件子页面中显示；主题提供声明式颜色、数值和文字选项。" : "Enable, disable, update, roll back, or uninstall from the installed list. Plugin settings open in a dedicated subpage; themes can expose declarative color, numeric, and text options."}</li>
          <li>{zh ? "主题叠加顺序为默认浅色/深色样式、社区主题、用户明确设置。界面模式还可选择跟随系统。" : "Theme precedence is the light/dark base, community theme, then explicit user choices. Interface mode can also follow the system."}</li>
        </ol>
      </section>
      <section id="security" className="df-doc-section"><h2>{labels.security}</h2><p>{zh ? "插件代码在宿主页面中运行，具有与应用相近的访问能力；它可以读取和修改工作区、访问网络，桌面专属插件还可使用桌面桥接能力。请核实作者和来源。受限模式暂停全部插件，保留安装与配置，适合排查异常。主题只加载 CSS 和静态资源。" : "Plugin code runs in the host page with access comparable to the app. It can read and change workspace data, access the network, and use desktop bridge capabilities when available. Verify authors and sources. Restricted mode pauses all plugins while retaining packages and configuration for troubleshooting. Themes load CSS and static assets."}</p></section>
      <section id="host" className="df-doc-section"><h2>{labels.host}</h2><table><tbody>
        <tr><th><code>app.getData()</code></th><td>{zh ? "读取当前规划工作区快照。" : "Read current workspace planning snapshot."}</td></tr>
        <tr><th><code>settings.save(patch)</code></th><td>{zh ? "持久化存储插件专属配置。" : "Persist plugin-specific settings."}</td></tr>
        <tr><th><code>events.emit(event, payload)</code></th><td>{zh ? "监听并广播 NavoPath 插件事件。" : "Listen and broadcast NavoPath plugin events."}</td></tr>
        <tr><th><code>ui.toast(message)</code></th><td>{zh ? "在应用界面展示轻量状态提示。" : "Display lightweight status notifications in the app."}</td></tr>
        <tr><th><code>settings.registerPage / ui.addHeaderItem</code></th><td>{zh ? "挂载插件设置或顶栏入口，并注册清理函数。" : "Mount a plugin settings page or header item and register cleanup."}</td></tr>
        <tr><th><code>timers.registerMode(provider)</code></th><td>{zh ? "注册独立计时模式，随插件停用而清理。" : "Register an independent timer mode with plugin lifecycle cleanup."}</td></tr>
      </tbody></table></section>
    </article>
  </main>;
}
