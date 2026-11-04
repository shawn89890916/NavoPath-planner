export default {
  onload(context) {
    return context.app.internal.registerNativePlanningView("eisenhower", context.manifest.name);
  },
};
