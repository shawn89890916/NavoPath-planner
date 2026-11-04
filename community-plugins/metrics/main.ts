export default {
  onload(context) {
    return context.app.internal.registerNativePlanningView("metrics", context.manifest.name);
  },
};
