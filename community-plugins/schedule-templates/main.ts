export default {
  onload(ctx: any) {
    ctx.app.internal.registerNativeToolPage("schedule-templates", ctx.language === "zh" ? "日程模板" : "Schedule templates");
  },
};
