export default {
  onload(context) {
    return context.app.internal.registerNativePlanningView("kanban", context.manifest.name);
  },
};
