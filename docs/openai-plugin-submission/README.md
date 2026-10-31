# NavoPath OpenAI 插件提交准备

这是公开上传包的独立源目录和审核工作说明。原有 Codex MCP、私有连接和 App 绑定不变。

## 已确定的商品页

| 项目 | 值 |
| --- | --- |
| 名称 | NavoPath |
| 发布者意向 | Xiaoyang Chen（待目标后台核验已验证身份） |
| 英文副标题 | Plan tasks and schedules |
| 中文副标题 | 在对话中管理项目、任务与日程 |
| 分类 | Productivity |
| 可用地区 | 所有平台允许的国家/地区；`countries: []` 明确取消地区限制 |
| 商业行为 | 不涉及付费、订阅或购买（用户 2026-10-31 确认） |
| 认证 | 现有远程 MCP 的 OAuth；DCR、openid、email |
| 品牌 | 沿用透明外画布、白色正面 N 和黑色立体阴影；两种模式均用原图，浅色 #27231E、深色 #A9A49B |

完整中英简介、三条默认提示、5 个正向和 3 个负向用例、版本说明已写入 `integrations/navopath-openai-plugin/plugin.json`。

## 生成与检查

```powershell
python scripts/prepare-openai-plugin.py
python scripts/prepare-openai-plugin.py --require-ready
```

需要 Pillow。输出在忽略跟踪的 `release-openai-plugin/0.1.0/`：

- `navopath-0.1.0-DRAFT.zip`：单一顶层目录，内含 plugin.json、mcp.json 和真实图标。
- `READINESS.md` 和 `readiness.json`：实际 ZIP 的清单、尺寸、透明度、字段、凭据模式及材料缺口检查。

`--require-ready` 在材料不齐时退出 2；普通生成保留可审阅草稿。缺失字段不填猜测链接，不以空字符串冒充完成。后台校验仍是最终要求。

2026-10-31 另取公开 Agent Plugins 1.0 JSON Schema 检查：完整 `plugin.json` 通过。公开 MCP 基础 schema 未包含服务级 `extensions`，会拒绝 OpenAI 官方文档要求的 OAuth 扩展；保留实际认证配置，基础传输投影单独验收，完整 OpenAI 格式以后续后台校验为准。未把完整 MCP schema 检查标记为通过。

## 准备顺序

1. 完成商品页链接与政策：官网、隐私页及 GitHub Issues 支持渠道已打开核验；现有隐私政策需扩充插件处理说明；服务条款尚待维护者定稿和发布。
2. 按 [DEMO.md](DEMO.md) 准备专用样例账户、跑通用例、录制真实宿主演示。脚本、截图或未执行的预期均不能当成录像与通过证据。
3. 把已验证的支持页、服务条款和录像链接补入清单，更新准备状态，重新生成并检查 ZIP。
4. 在 [提交后台](https://platform.openai.com/plugins) 核对目标组织、权限和已验证发布身份，再上传草稿。
5. 按真实 challenge 完成域名验证，OAuth 连接并扫描，核对已保存版本、工具和导入元数据。
6. 开发者本人完成政策声明，提交审核；获批后另行发布。上传、提交审核、发布分别记录状态。

## 服务端检查

MCP 源码中 27 个工具显式声明 `readOnlyHint`、`destructiveHint`、`openWorldHint`。删除、无法撤回的覆盖及可触发外部工作的工具采用相应保守提示；仅预览的模式不使同一批量工具整体成为只读。

`send_notification` 的 MCP 参数未暴露 `email`，实际只排队站内通知；描述已与此保持一致。启用后台助理或摄入工作区事件可能触发后续外部工作，单独标记。

源代码测试不代表线上部署完成。用例也需在审核账户中通过真实连接执行。

## 参考

- [官方提交流程](https://developers.openai.com/plugins/deploy/submission)
- [官方插件包格式与认证](https://developers.openai.com/plugins/build/plugins)
- [官方 OAuth 要求](https://developers.openai.com/plugins/build/auth)
- [官方远程 MCP 审核要求](https://developers.openai.com/plugins/deploy/app-review)
