export default {
  onload(context) {
    return context.app.internal.registerNativeFeature("desktop-widget");
  },
};
