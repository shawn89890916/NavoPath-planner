import type { Language } from "./types";

export const NAVOPATH_SCHEDULE_SKILL_INSTALL_COMMAND = "npx skills add shawn89890916/NavoPath-planner --skill navopath-schedule";
export const NAVOPATH_SCHEDULE_SKILL_PAGE = "https://github.com/shawn89890916/NavoPath-planner/blob/main/skills/navopath-schedule/SKILL.md";
export const NAVOPATH_SCHEDULE_SKILL_RAW = "https://raw.githubusercontent.com/shawn89890916/NavoPath-planner/main/skills/navopath-schedule/SKILL.md";

export function buildNavoPathAgentSetupPrompt({
  endpoint,
  token,
  language,
}: {
  endpoint: string;
  token: string;
  language: Language;
}) {
  if (language === "zh") {
    return `安装 NavoPath Schedule skill。运行 \`${NAVOPATH_SCHEDULE_SKILL_INSTALL_COMMAND}\`，并选择你当前使用的 Agent。只使用一种安装方式。你也可以直接阅读 Skill：${NAVOPATH_SCHEDULE_SKILL_PAGE}（raw：${NAVOPATH_SCHEDULE_SKILL_RAW}）。

然后为当前 Agent 配置这个账户的 NavoPath MCP：
- 名称：navopath
- 传输方式：Streamable HTTP
- URL：${endpoint}
- Authorization：Bearer ${token}

请根据当前 Agent 和操作系统选择它支持的 MCP 配置方式。将 Token 保存在 Agent 支持的密钥存储或本机环境变量中；不要写入项目文件、提交到 Git、记录到日志，或在回复中复述完整 Token。若配置需要重启，请保存后告诉我需要执行的唯一重启步骤；重启后调用 navopath 的 list_projects 验证连接。以后我要求新增、查询或调整日程时，使用 navopath-schedule skill 和 navopath MCP。`;
  }

  return `Install the NavoPath Schedule skill. Run \`${NAVOPATH_SCHEDULE_SKILL_INSTALL_COMMAND}\` and select your current agent. Use one installation method. You can read the skill directly at ${NAVOPATH_SCHEDULE_SKILL_PAGE} (raw: ${NAVOPATH_SCHEDULE_SKILL_RAW}).

Then configure this account's NavoPath MCP connection for the current agent:
- Name: navopath
- Transport: Streamable HTTP
- URL: ${endpoint}
- Authorization: Bearer ${token}

Choose the MCP configuration method supported by the current agent and operating system. Store the token in the agent's supported secret store or a local environment variable; do not write it to project files, commit it to Git, log it, or repeat the full token in your response. If the configuration requires a restart, save it and tell me the single restart step I need to take; after restart, call navopath list_projects to verify the connection. Use the navopath-schedule skill and navopath MCP whenever I ask to add, inspect, or move a schedule.`;
}
