/** Experimental v2 example. Tested against a mock host only; not installable yet. */
import type { PluginModuleV2 } from "../api/v2";

const plugin: PluginModuleV2 = {
  onload(ctx) {
    ctx.ui.registerTaskGroup({
      id: "sample-group", name: "Sample tasks",
      resolve: candidateIds => candidateIds.slice(0, 2),
      actions: [{ id: "create", label: "Create sample task" }],
      async invoke(id) {
        if (id !== "create") return;
        const result = await ctx.tasks.execute({
          kind: "create", operationId: crypto.randomUUID(), title: "Sample task",
        });
        if ("message" in result) ctx.ui.toast(result.message);
      },
    });
    ctx.ui.registerWorkspacePage({
      id: "sample", name: "Sample",
      async mount(container) {
        const tasks = await ctx.tasks.list();
        if (ctx.signal.aborted) return;
        const output = document.createElement("p");
        output.textContent = `${tasks.length} tasks`;
        container.append(output);
        return () => output.remove();
      },
    });
    ctx.ui.registerPlanningView({ id: "view", name: "Sample view", mount: () => {} });
    ctx.ui.registerSettingsPage({ id: "settings", name: "Sample settings", mount: () => {} });
    ctx.metrics.registerProvider({
      id: "actual", name: "Sample minutes",
      query: facts => [{ label: "Actual", value: facts.actual.reduce((sum, entry) => sum + entry.minutes, 0), unit: "min" }],
    });
  },
};
export default plugin;
