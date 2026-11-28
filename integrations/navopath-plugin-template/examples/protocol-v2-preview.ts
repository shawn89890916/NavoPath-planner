/** The wired preview subset; not a published package. */
import type { PluginModuleV2 } from "../api/v2";

const plugin: PluginModuleV2 = {
  onload(ctx) {
    const mount = async (container: HTMLElement) => {
      const tasks = await ctx.tasks.list();
      if (ctx.signal.aborted) return;
      const output = document.createElement("p");
      output.textContent = `${tasks.length} tasks`;
      container.append(output);
      return () => output.remove();
    };
    ctx.ui.registerTaskGroup({
      id: "sample-group", name: "Sample group", resolve: ids => ids.slice(0, 2),
      actions: [{ id: "create", label: "Create sample task" }],
      async invoke() {
        const result = await ctx.tasks.execute({ kind: "create", operationId: crypto.randomUUID(), title: "Sample task" });
        if ("message" in result) ctx.ui.toast(result.message);
      },
    });
    ctx.ui.registerWorkspacePage({ id: "sample", name: "Sample", mount });
    ctx.ui.registerPlanningView({ id: "view", name: "Sample view", mount });
    ctx.ui.registerSettingsPage({ id: "settings", name: "Sample settings", mount });
  },
};
export default plugin;
