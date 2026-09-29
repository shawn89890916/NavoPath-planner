import type { Language } from "./types";

const BRIDGE_SOURCE = "https://raw.githubusercontent.com/shawn89890916/NavoPath-planner/main/sync-bridge/bridge.mjs";

export function buildSyncBridgeSetupPrompt(input: { language: Language; provider: string; endpoint: string }) {
  const { language, provider, endpoint } = input;
  if (language === "zh") return `请帮我在这台常开电脑上配置 NavoPath 文件夹同步桥接服务。我的云盘是 ${provider}，MCP 地址是 ${endpoint}。

先确认这台电脑运行 Windows 或 macOS、已安装 Node.js 20+，且 ${provider} 客户端已经把文件夹同步到本机。让我选择该服务商的本机同步文件夹；不要猜测路径，也不要把 NavoPath 数据写进其他文件夹。

从 NavoPath 官方仓库下载并检查桥接脚本：${BRIDGE_SOURCE}。将脚本保存到一个不会被云盘同步的本机目录。运行脚本的 setup --folder <我选的文件夹> --endpoint ${endpoint}，让我在终端的隐藏输入提示中粘贴在 NavoPath「日历与集成 → MCP」里新建的专用令牌。不要让我把令牌发到聊天里；不要在命令行参数、日志、Git 或云盘文件夹里保存令牌。配置会把令牌存入 macOS 钥匙串或 Windows 用户 DPAPI 加密存储。

然后运行脚本的 install，配置登录后自动启动的后台服务。检查服务已运行，并在 NavoPath「日历与集成 → 同步」中确认状态变为运行中、出现所选目录和最近同步时间。只有这一台电脑运行桥接服务。若失败，说明具体原因并修复；不要删除或覆盖现有备份与冲突副本。完成后告诉我这个常开电脑需要保持登录和云盘客户端运行。`;
  return `Set up the NavoPath folder sync bridge on this always-on computer. My cloud provider is ${provider}; the MCP endpoint is ${endpoint}.

Check that this is Windows or macOS, Node.js 20+ is installed, and the ${provider} client already syncs a folder locally. Let me choose that folder. Do not guess its path or place NavoPath data elsewhere.

Download and inspect the bridge script from NavoPath's official repository: ${BRIDGE_SOURCE}. Keep the script outside the cloud-synced folder. Run setup --folder <my chosen folder> --endpoint ${endpoint} and let me paste a dedicated token created under NavoPath Settings → Calendar & Integrations → MCP into the terminal's hidden prompt. Do not ask me to send the token in chat or put it in command arguments, logs, Git, or the synced folder. Setup stores it in macOS Keychain or Windows user-scoped DPAPI storage.

Run install to register the background service at login. Verify it is running and that NavoPath Settings → Calendar & Integrations → Sync shows the chosen folder, running status, and a recent sync time. Use only this one computer as the bridge. If setup fails, explain and repair the specific failure without deleting existing backups or conflict copies. Tell me that this computer must stay signed in with the cloud provider running.`;
}
