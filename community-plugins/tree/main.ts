export default {
  onload(context) {
    return context.app.internal.registerNativePlanningView("tree", context.manifest.name);
  },
};
