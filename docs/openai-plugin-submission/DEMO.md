# 专用审核数据、用例与录像

状态：用例已拟定，尚未在专用审核账户中执行。不得在录像中展示真实个人规划、密码、令牌或无关邮箱。

## 账户和样例

准备一个仅含虚构数据的 NavoPath 云端审核账户。审核者应能直接登录并授权，无需访问维护者的邮箱、手机或私网。登录地址、账号、密码和必要说明只进入后台私密审核字段，不放 ZIP、此目录或 GitHub。

在该账户创建并记录返回的真实 ID（不用预设 ID）：

- 项目 `Plugin review`。
- 未完成任务 `Design review`：2026-11-02 10:00，30 分钟；只有这一次非取消执行，初始投入度 80%；未锁定排程和硬截止日期。
- 已完成任务 `Archive notes`，属于同一项目。
- 一条日程 `Outside review range`：2026-11-09 10:00，30 分钟。
- 确保 2026-11-03 14:00–14:45 空闲；工作区日期按 Asia/Shanghai 解释。
- 每轮创建用例前确保 `Review checklist` 不存在；每轮投入度用例前恢复为 80%。这些日期是固定测试夹具，今后复审应同步更新提示和预期。

## 录像流程

使用正在打包的版本，在 Codex 或 ChatGPT 的真实开发连接中演示；公开提交后台的连接和检查在材料完成后进行。

1. 显示插件名称与版本，简要展示登录和授权；输入凭据时暂停录制或遮挡。
2. 输入 `Show my NavoPath projects and unfinished tasks in Plugin review.`，显示工具返回与未完成任务。
3. 输入 `Show my NavoPath schedule from November 2 through November 8, 2026.`，显示范围内日程。
4. 输入 `In my Plugin review project, create an unscheduled task called Review checklist, with a deadline of November 6, 2026.`，完成宿主要求的写入确认，显示真实保存结果和读回。
5. 输入 `Preview moving my Design review task to November 3, 2026 at 14:00 for 45 minutes. Do not save yet.`，显示预览及原日程未变的读回。
6. 输入 `My engagement for the November 2 execution of Design review was 70%. Save that rating and show it back to me.`，显示执行记录解析、写入与读回。
7. 演示三个边界请求：未授权他人账户、付费购买、读取本机所有文档并发送到新邮箱。解释能力边界，不触发替代性写入。
8. 回放完整录像，确保文字可读、操作真实、无凭据泄露。上传至维护者选择的审核者可访问位置；匿名或审核身份实际播放后再写入 `review.demo_recording_url`。

若可使用本机录屏或 Playwright 的 `video-start`，它只能录到受控浏览器；不能把普通 NavoPath 网页操作当作 Codex/ChatGPT 调用插件的录像。没有宿主开发连接和审核账户时，保留录像为未完成。

## 执行记录

每例记录实际工具、参数、结果、读回证据、时间与结论。只使用 Passed、Failed、Blocked 或 Not run。后台保存版本连接后再复跑，开发环境通过不能替代后台验收。

| 用例 | 预期覆盖 | 当前状态 |
| --- | --- | --- |
| P1 | 项目与未完成任务过滤 | Not run |
| P2 | 固定日期范围日程 | Not run |
| P3 | 无排程任务与截止日期区分 | Not run |
| P4 | 批量预览不保存 | Not run |
| P5 | 用户明确提供的单次执行投入度 | Not run |
| N1 | 未授权账户边界 | Not run |
| N2 | 无购物与支付能力 | Not run |
| N3 | 无任意本机文件读取和任意收件人邮件能力 | Not run |
