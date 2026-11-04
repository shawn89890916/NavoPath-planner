export default {
  onload(context) {
    return context.app.internal.registerNativePlanningView("list", context.manifest.name);
  },
};
