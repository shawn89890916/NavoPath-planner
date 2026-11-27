export default {
  onload(context) {
    return context.app.internal.registerNativeFeature("cloud-drive-sync");
  },
};
