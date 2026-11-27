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
          window.metricsResult=(phase==="exerciseUi"?import("/scripts/metrics-ui-browser.mjs"):phase==="exerciseConnections"?import("/scripts/connections-ui-browser.mjs"):phase==="exerciseMotion"?import("/scripts/stability-motion-browser.mjs"):phase==="exerciseSettings"?import("/scripts/settings-ui-browser.mjs"):phase==="exerciseIntent"?import("/scripts/intent-ui-browser.mjs"):import("/scripts/metrics-storage-browser.mjs")).then(tests=>tests[phase]()).then(value=>({value}),error=>({error:String(error?.stack||error)}));
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
    if (process.env.NAVOPATH_INTENT_ONLY === "1") {
      win.webContents.debugger.attach("1.3");
      try {
      await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
      for (const [width,height] of [[1280,900],[420,840]]) {
        win.setContentSize(width,height);
        await win.loadURL(url+"?phase=exerciseIntent");
        const intent = await win.webContents.executeJavaScript("(async()=>{for(let i=0;i<250;i++){if(window.metricsResult)return await window.metricsResult;await new Promise(r=>setTimeout(r,20));}throw Error('Intent fixture missing');})()");
        if (!intent || intent.error) throw Error(intent?.error || "Intent fixture failed");
        console.log("Intent Chromium: "+JSON.stringify(intent.value));
      }
      } finally {
        await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [] });
        win.webContents.debugger.detach();
      }
    } else {
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
    for (const [width,height] of [[1440,900],[620,840],[420,840],[300,640]]) {
      win.setContentSize(width,height);
      await win.loadURL(url+"?phase=exerciseSettings");
      const settings=await win.webContents.executeJavaScript("(async()=>{for(let i=0;i<250;i++){if(window.metricsResult)return await window.metricsResult;await new Promise(r=>setTimeout(r,20));}throw Error('Settings fixture missing');})()");
      if(!settings||settings.error)throw Error(settings?.error||"Settings UI fixture failed");
      console.log("Settings Chromium UI: "+JSON.stringify(settings.value));
    }
    win.webContents.debugger.attach("1.3");
    try {
      for (const value of ["no-preference", "reduce"]) {
        await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value }] });
        await win.loadURL(url+"?phase=exerciseMotion&motion="+value);
        const motion = await win.webContents.executeJavaScript("(async()=>{for(let i=0;i<250;i++){if(window.metricsResult)return await window.metricsResult;await new Promise(r=>setTimeout(r,20));}throw Error('Motion fixture missing');})()");
        if (!motion || motion.error) throw Error(motion?.error || "Motion fixture failed");
        if (value === "no-preference" ? motion.value?.cycles !== 100 : motion.value?.systemReducedMotion !== true) throw Error("Motion fixture did not exercise "+value);
        console.log("Stability Chromium motion: "+JSON.stringify(motion.value));
      }
    } finally {
      await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [] });
      win.webContents.debugger.detach();
    }
    // Exercise the actual shared controls in Chromium at all five radius points.
    for (const [width,height] of [[1280,900],[420,840],[300,640]]) {
      win.setContentSize(width,height);
      await win.loadURL(new URL("/dev/ui-review.html",url).href);
      const result = await win.webContents.executeJavaScript(`(async()=>{
        const wait=async(fn)=>{for(let i=0;i<250;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,20));}throw Error("Settings review did not load")};
        const input=await wait(()=>document.querySelector('[aria-label="Review radius"]'));
        const nativeSet=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;
        const group=document.querySelector(".df-settings-group--grouped > .df-settings-group-body");
        const select=group.querySelector("select"), nav=document.querySelector(".df-settings-nav > .ui-choice-item");
        const knob=group.querySelector(".df-settings-toggle-knob");
        const round=el=>parseFloat(getComputedStyle(el).borderTopLeftRadius);
        const assert=(v,m)=>{if(!v)throw Error(m)};
        let results=[];
        for(const dark of [false,true]){
          if(dark){[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="深色")?.click();await wait(()=>document.querySelector(".theme-dark"));}
          const baseline=group.getBoundingClientRect();
          for(const r of [0,16,32,48,64]){
            nativeSet.call(input,String(r));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));
            await wait(()=>document.documentElement.style.getPropertyValue("--workspace-corner-radius")===r+"px");
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            assert(Math.abs(round(group)-r)<.1,"Group radius "+round(group)+" at "+r);
            assert(Math.abs(round(select)-r)<.1,"Control radius "+round(select)+" at "+r);
            assert(Math.abs(round(nav)-r)<.1,"Navigation radius "+round(nav)+" at "+r);
            assert(getComputedStyle(knob).borderTopLeftRadius==="50%","Switch geometry changed");
            const box=group.getBoundingClientRect();
            assert(Math.abs(box.width-baseline.width)<1 && Math.abs(box.height-baseline.height)<1,"Radius changed layout");
            assert(group.scrollWidth<=group.clientWidth+2,"Grouped settings overflow");
            results.push({dark,r,group:round(group),control:round(select),navigation:round(nav)});
          }
        }
        return {width:innerWidth,results};
      })()`);
      console.log("Settings Chromium UI: "+JSON.stringify(result));
    }
    }
  } finally { win.destroy(); }
  app.exit(0);
}
