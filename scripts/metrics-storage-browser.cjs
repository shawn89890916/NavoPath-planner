const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

if (process.versions.electron) {
  runRenderer().catch(error => { console.error(error); require("electron").app.exit(1); });
} else {
  runServer().catch(error => { console.error(error); process.exitCode = 1; });
}
async function runServer() {
  const { createServer } = await import("vite");
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "navopath-metrics-test-"));
  const server = await createServer({
    root: path.resolve(__dirname, ".."), configFile: false, logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false },
    plugins: [{ name: "isolated-metrics-test", configureServer(server) {
      server.middlewares.use("/__metrics_test", (_req, res) => {
        res.setHeader("Content-Type", "text/html");
        res.end(`<!doctype html><html><body>Isolated Metrics storage test<script type="module">
          const phase=new URL(location.href).searchParams.get("phase");
          window.metricsResult=(phase==="exerciseUi"?import("/scripts/metrics-ui-browser.mjs"):phase==="exerciseConnections"?import("/scripts/connections-ui-browser.mjs"):import("/scripts/metrics-storage-browser.mjs")).then(tests=>tests[phase]()).then(value=>({value}),error=>({error:String(error?.stack||error)}));
        </script></body></html>`);
      });
    } }]
  });
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    await new Promise((resolve, reject) => {
      const child = spawn(require("electron"), [__filename], {
        env: { ...process.env, NAVOPATH_METRICS_TEST_PROFILE: profile, NAVOPATH_METRICS_TEST_URL: "http://127.0.0.1:"+port+"/__metrics_test" },
        stdio: "inherit", windowsHide: true
      });
      const timeout = setTimeout(() => child.kill(), 120000);
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("close", code => { clearTimeout(timeout); code === 0 ? resolve() : reject(Error("Metrics Chromium test exited with "+code)); });
    });
  } finally {
    await server.close();
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
}
async function runRenderer() {
  const { app, BrowserWindow } = require("electron");
  const profile = process.env.NAVOPATH_METRICS_TEST_PROFILE;
  const url = process.env.NAVOPATH_METRICS_TEST_URL;
  if (!profile || !url || !url.startsWith("http://127.0.0.1:")) throw Error("Isolated test profile and loopback origin required");
  app.setPath("userData", profile);
  app.commandLine.appendSwitch("disable-gpu");
  await app.whenReady();
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  try {
    for (const phase of ["seedInterrupted", "recoverAndExercise", "recoverPurge"]) {
      await win.loadURL(url+"?phase="+phase);
      const result = await win.webContents.executeJavaScript("(async()=>{for(let i=0;i<250;i++){if(window.metricsResult)return await window.metricsResult;await new Promise(r=>setTimeout(r,20));}throw Error('Metrics test bootstrap missing');})()");
      if (!result || result.error) throw Error(result?.error || "Metrics test module failed to initialize");
      console.log("Metrics Chromium: "+JSON.stringify(result.value));
    }
    for (const [width,height] of [[1280,900],[420,840],[300,640]]) {
      win.setContentSize(width,height);
      await win.loadURL(url+"?phase=exerciseUi");
      const result=await win.webContents.executeJavaScript("(async()=>{for(let i=0;i<250;i++){if(window.metricsResult)return await window.metricsResult;await new Promise(r=>setTimeout(r,20));}throw Error('Metrics test bootstrap missing');})()");
      if(!result||result.error)throw Error(result?.error||"Metrics UI fixture did not initialize");
      // CDP keyboard events use Chromium's native activation path even with a hidden window.
      win.webContents.debugger.attach("1.3");
      try{
        await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent",{type:"rawKeyDown",key:" ",code:"Space",windowsVirtualKeyCode:32});
        await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent",{type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
      }finally{win.webContents.debugger.detach();}
      const keyboard=await win.webContents.executeJavaScript("window.verifyMetricsKeyboard()");
      if(!keyboard)throw Error("Native keyboard activation did not change the selected metric view");
      console.log("Metrics Chromium UI: "+JSON.stringify({...result.value,keyboard}));
    }
    for (const [width,height] of [[1280,900],[420,840],[300,640]]) {
      win.setContentSize(width,height);
      await win.loadURL(url+"?phase=exerciseConnections");
      const result=await win.webContents.executeJavaScript("(async()=>{for(let i=0;i<250;i++){if(window.metricsResult)return await window.metricsResult;await new Promise(r=>setTimeout(r,20));}throw Error('Connections test bootstrap missing');})()");
      if(!result||result.error)throw Error(result?.error||"Connections UI fixture did not initialize");
      console.log("Connections Chromium UI: "+JSON.stringify(result.value));
    }
  } finally { win.destroy(); }
  app.exit(0);
}
