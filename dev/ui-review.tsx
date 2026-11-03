import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, IconButton, Input, Modal } from "../src/components/UiPrimitives";
import { SettingSection, SettingRow, SettingToggle, SettingSelect, SettingTextInput, SettingActionButton } from "../src/components/SettingsControls";
import { UiCloseIcon } from "../src/components/UiIcons";
import "../src/app.css";
import "../src/ui-primitives.css";
import "./ui-review.css";

function Review() {
  const [dark, setDark] = useState(false);
  useEffect(() => { document.body.dataset.navopathBaseTheme = dark ? "dark" : "light"; }, [dark]);
  const [english, setEnglish] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [pending, setPending] = useState(false);
  const [modal, setModal] = useState(false);
  const [value, setValue] = useState("");
  const t = (zh: string, en: string) => english ? en : zh;
  return <div className={`df-app mode-execute ui-review${dark ? " theme-dark" : ""}`}>
    <header className="ui-review-head">
      <h1>NavoPath <span>UI review</span></h1>
      <div><Button onClick={() => setEnglish(!english)}>{english ? "中文" : "English"}</Button><Button onClick={() => setDark(!dark)}>{t(dark ? "浅色" : "深色", dark ? "Light" : "Dark")}</Button></div>
    </header>
    <p>{t("复用应用中的真实控件。用 Tab 检查焦点，悬停与按下检查反馈；缩窄窗口检查设置行。", "Actual application controls. Use Tab to check focus, hover and press for feedback, and resize to inspect settings rows.")}</p>
    <section className="ui-review-controls">
      <h2>{t("操作与状态", "Actions and states")}</h2>
      <div className="ui-review-actions">
        <Button variant="primary">{t("保存", "Save")}</Button>
        <Button>{t("取消", "Cancel")}</Button>
        <Button variant="danger">{t("删除", "Delete")}</Button>
        <Button disabled>{t("不可用", "Unavailable")}</Button>
        <Button pending={pending} onClick={() => setPending(true)}>{t("检查更新", "Check updates")}</Button>
        <Button onClick={() => setPending(false)}>{t("重置检查", "Reset check")}</Button>
        <IconButton label={t("关闭示例", "Close example")} icon={<UiCloseIcon size={16} />} />
      </div>
      <div className="ui-review-actions"><Input aria-label={t("任务名称", "Task name")} placeholder={t("输入任务名称", "Enter a task name")} /><Input disabled aria-label={t("禁用输入", "Disabled input")} value={t("不可用", "Unavailable")} readOnly /></div>
      <div className="ui-choice-list ui-choice-list--inline"><Button className="ui-choice-item active" aria-pressed>{t("天", "Day")}</Button><Button className="ui-choice-item">{t("周", "Week")}</Button><Button className="ui-choice-item">{t("月", "Month")}</Button></div>
    </section>
    <div className="df-settings-content">
      <SettingSection presentation="plain" title={t("设置行", "Settings rows")} description={t("文字、开关、选择与动作共享同一套比例。", "Text, switches, selections and actions share one scale.")}>
        <SettingRow title={t("通知", "Notifications")} description={t("显示未读数量，关闭后仍可在通知中心查看。", "Show unread counts. Notifications remain available in the notification center when hidden.")} control={<SettingToggle checked={enabled} ariaLabel={t("通知", "Notifications")} onChange={setEnabled} />} />
        <SettingRow title={t("时间视图", "Timeline view")} description={t("窄面板将选择框放到说明下方，保留足够的阅读宽度。", "Narrow panels place the selection below its description to preserve reading space.")} control={<SettingSelect value="day" onChange={() => {}} ariaLabel={t("时间视图", "Timeline view")} options={[{value:"day",label:t("天", "Day")},{value:"week",label:t("周", "Week")}]} />} />
        <SettingRow title={t("名称", "Name")} control={<SettingTextInput value={value} onChange={setValue} ariaLabel={t("名称", "Name")} />} />
        <SettingRow title={t("禁用状态", "Disabled state")} disabled description={t("保留可读的文字与控件轮廓。", "Keep labels and control boundaries readable.")} control={<SettingToggle disabled checked={false} ariaLabel={t("禁用开关", "Disabled switch")} onChange={() => {}} />} />
        <SettingRow title={t("弹窗", "Modal")} control={<SettingActionButton onClick={() => setModal(true)}>{t("打开弹窗", "Open modal")}</SettingActionButton>} />
      </SettingSection>
    </div>
    <Modal open={modal} label={t("确认", "Confirm")} onClose={() => setModal(false)}>
      <h2>{t("确认操作", "Confirm action")}</h2><p>{t("检查弹窗进入、退出与焦点返回。", "Inspect entry, exit and focus restoration.")}</p>
      <Button onClick={() => setModal(false)}>{t("关闭", "Close")}</Button>
    </Modal>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Review />);
