// Trusted installed desktop entry: full Node capability, isolated from the renderer
// in its own utilityProcess. This is a lifecycle boundary, not a permission sandbox.
const { pathToFileURL } = require("node:url");
const entry = process.argv[2];
const port = process.parentPort;
let methods;
const ready = (async () => {
  const imported = await import(pathToFileURL(entry).href);
  methods = imported.default && typeof imported.default === "object" ? imported.default : imported;
  await methods.onLoad?.();
  port.postMessage({ type: "ready" });
})();
ready.catch((error) => port.postMessage({ type: "startup-error", error: String(error?.message || error) }));
port.on("message", async ({ data }) => {
  const { id, method, payload, type } = data || {};
  try {
    await ready;
    if (type === "stop") {
      await methods.onUnload?.();
      port.postMessage({ id, result: null });
      return;
    }
    if (type !== "invoke" || typeof method !== "string" || ["onLoad", "onUnload", "constructor", "__proto__", "prototype"].includes(method)
      || !Object.hasOwn(methods, method) || typeof methods[method] !== "function") throw new Error("Unknown extension method");
    const result = await methods[method](payload);
    port.postMessage({ id, result });
  } catch (error) { port.postMessage({ id, error: String(error?.message || error) }); }
});
