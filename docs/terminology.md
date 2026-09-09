# NavoPath 产品术语表

这份表是 NavoPath 用户可见词汇的约束来源。代码中的高风险标签、按钮、状态、
Tooltip、`aria-label`、帮助文档和 Toast 应优先复用 `src/terminology.ts`。

| Key | 中文 | English | 定义 | 禁用同义词 | 使用示例 |
| --- | --- | --- | --- | --- | --- |
| `planning` | 规划 | Planning | 管理项目、任务和长期安排 | Plan、计划 | 打开规划，整理长期项目。 |
| `execute` | 执行 | Execute | 完成今天已经选定的工作 | 工作台、Focus | 在执行中完成今日任务。 |
| `todayCandidates` | 今日候选 | Today's Candidates | 已选中今天推进、尚未放入具体时间的任务 | Queue、Inbox、待办 | 从规划加入今日候选。 |
| `schedule` | 安排 | Schedule | 将任务放入具体时间段 | Plan、Adopt、计划 | 安排任务到 10:00。 |
| `timeline` | 时间轴 | Timeline | 展示时间安排的时间网格 | Calendar、日历 | 在时间轴上查看安排。 |
| `task` | 任务 | Task | 需要完成的可执行事项 | Event、事项 | 创建任务并设置时长。 |
| `event` | 事件 | Event | 日历中的时间事项，不包含任务完成流程 | Task、任务 | 将会议保存为事件。 |
| `project` | 项目 | Project | 承载一组长期任务的工作单元 | Category、分类 | 将任务归入项目。 |
| `done` | 已完成 | Done | 任务或时间块已经完成的状态 | Complete、Completed | 显示已完成任务。 |
| `complete` | 完成 | Complete | 将任务或时间块标记为完成的动作 | Done、Finish | 点击完成。 |
| `incomplete` | 未完成 | Incomplete | 任务或时间块尚未完成的状态 | Unfinished | 处理未完成任务。 |
| `apply` | 应用 | Apply | 接受 AI 生成的安排或操作 | Adopt、Confirm all | 应用这份安排。 |
| `unschedule` | 取消安排 | Unschedule | 保留任务并移除时间轴安排 | Delete、Remove | 取消安排后任务仍保留。 |
| `delete` | 删除 | Delete | 永久删除任务、项目或数据 | Remove、Unschedule | 删除项目及其数据。 |
| `navoAi` | Navo AI | Navo AI | 普通 AI 对话入口 | Assistant、Agent | 向 Navo AI 提问。 |
| `aiAgent` | AI 助理 | AI Agent | 能读取工作区并执行操作的 AI | Chat、普通对话 | AI 助理会先请求确认高风险操作。 |

## 规则

- `Done` 只用于状态，`Complete` 只用于动作。
- `Calendar` 只用于外部或同步日历，应用内部时间网格统一称为 `Timeline`。
- `Unschedule` 保留任务；`Delete` 永久删除数据；`Remove` 只用于从集合中移除。
- `Apply` 用于接受 AI 预览或建议，表单保存继续使用 `Save`。
- 长句可以根据上下文自然翻译，核心对象、动作和状态保持表中写法。
