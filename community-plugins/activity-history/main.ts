export default {
  onload(context) {
    return context.app.internal.registerNativePlanningView("activity-history", context.manifest.name);
  },
};
