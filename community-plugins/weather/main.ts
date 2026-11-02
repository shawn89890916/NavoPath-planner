/** Open-Meteo current conditions and daily forecast. No location or forecast is fabricated. */
export function weatherCondition(code: unknown, zh: boolean) {
  const conditions: Record<number, [string, string, string]> = {
    0: ["晴", "Clear sky", "sun"], 1: ["大部晴朗", "Mainly clear", "sun"], 2: ["局部多云", "Partly cloudy", "cloud"], 3: ["阴", "Overcast", "cloud"],
    45: ["雾", "Fog", "fog"], 48: ["雾凇", "Rime fog", "fog"],
    51: ["小毛毛雨", "Light drizzle", "rain"], 53: ["中毛毛雨", "Moderate drizzle", "rain"], 55: ["浓毛毛雨", "Dense drizzle", "rain"], 56: ["小冻毛毛雨", "Light freezing drizzle", "rain"], 57: ["浓冻毛毛雨", "Dense freezing drizzle", "rain"],
    61: ["小雨", "Light rain", "rain"], 63: ["中雨", "Moderate rain", "rain"], 65: ["大雨", "Heavy rain", "rain"], 66: ["小冻雨", "Light freezing rain", "rain"], 67: ["大冻雨", "Heavy freezing rain", "rain"],
    71: ["小雪", "Light snow", "snow"], 73: ["中雪", "Moderate snow", "snow"], 75: ["大雪", "Heavy snow", "snow"], 77: ["米雪", "Snow grains", "snow"],
    80: ["小阵雨", "Light showers", "rain"], 81: ["中阵雨", "Moderate showers", "rain"], 82: ["强阵雨", "Heavy showers", "rain"], 85: ["小阵雪", "Light snow showers", "snow"], 86: ["强阵雪", "Heavy snow showers", "snow"],
    95: ["雷暴", "Thunderstorm", "storm"], 96: ["雷暴伴小冰雹", "Thunderstorm with hail", "storm"], 97: ["强雷暴", "Heavy thunderstorm", "storm"], 99: ["雷暴伴强冰雹", "Thunderstorm with heavy hail", "storm"],
  };
  const value = typeof code === "number" ? conditions[code] : undefined;
  return { label: value?.[zh ? 0 : 1] ?? (zh ? "天气状况暂无数据" : "Conditions unavailable"), icon: value?.[2] ?? "unknown" };
}

function weatherIcon(kind: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({ viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) svg.setAttribute(name, value);
  const path = document.createElementNS(svg.namespaceURI, "path");
  const cloud = "M5 16a4 4 0 1 1 1-7.9A6 6 0 0 1 18 9a3.5 3.5 0 0 1 0 7";
  const shapes: Record<string, string> = {
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5",
    cloud: `${cloud}H5`, fog: `${cloud}M4 19h16M7 22h10`, rain: `${cloud}M8 18l-1 3m6-3-1 3m6-3-1 3`, snow: `${cloud}M12 17v6m-2.6-4.5 5.2 3m-5.2 0 5.2-3`, storm: `${cloud}M13 15l-3 5h4l-2 3`, unknown: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01",
  };
  path.setAttribute("d", shapes[kind] ?? shapes.unknown); svg.append(path); return svg;
}

export default {
  async onload(ctx: any) {
    const zh = ctx.language === "zh";
    const defaults = { city: "", latitude: null, longitude: null, unit: "celsius", intervalMinutes: 30, endpoint: "https://api.open-meteo.com/v1/forecast" };
    const settings = () => ({ ...defaults, ...ctx.settings.get() });
    const nodes = new Set<HTMLDetailsElement>();
    const requests = new Set<AbortController>();
    let stopped = false, busy = false, error = "", forecastVersion = 0;
    let forecastRequest: AbortController | null = null, pending: Promise<void> | null = null;
    let cache: any = await ctx.storage.get("forecast");
    const render = () => {
      const s = settings(); const same = cache?.latitude === s.latitude && cache?.longitude === s.longitude && cache?.unit === s.unit;
      for (const node of nodes) {
        node.replaceChildren();
        const condition = weatherCondition(same ? cache.weather_code : undefined, zh);
        const current = document.createElement("summary"); current.className = "navopath-weather-summary";
        current.append(weatherIcon(condition.icon));
        const city = document.createElement("span"); city.className = "navopath-weather-city"; city.textContent = s.city || (zh ? "天气 · 请设置城市" : "Weather · choose a city"); current.append(city);
        if (same) { const temperature = document.createElement("span"); temperature.textContent = `${Math.round(cache.current)}°${s.unit === "fahrenheit" ? "F" : "C"}`; current.append(temperature); }
        current.setAttribute("aria-label", [city.textContent, same ? current.textContent : (zh ? "天气暂不可用" : "Weather unavailable"), same ? condition.label : ""].filter(Boolean).join(" · "));
        node.append(current);
        const updated = same ? `${zh ? "更新于" : "Updated"} ${new Date(cache.timestamp).toLocaleString(ctx.language)}` : "";
        node.setAttribute("aria-busy", String(busy));
        node.dataset.stale = String(Boolean(error || (same && Date.now() - cache.timestamp > Math.max(5, Number(s.intervalMinutes)) * 60000)));
        const detail = document.createElement("div"); detail.className = "navopath-weather-details";
        const description = document.createElement("p"); description.textContent = same ? condition.label : s.city ? (zh ? "天气暂不可用" : "Weather unavailable") : (zh ? "请在插件设置中搜索并选择城市。" : "Search and choose a city in the plugin settings."); detail.append(description);
        if (same) {
          const values = document.createElement("dl");
          for (const [label, value] of [[zh ? "最高 / 最低" : "High / low", `${Math.round(cache.high)}° / ${Math.round(cache.low)}°`], [zh ? "降水概率" : "Precipitation chance", `${cache.precipitation}%`]]) { const row = document.createElement("div"), term = document.createElement("dt"), reading = document.createElement("dd"); term.textContent = label; reading.textContent = value; row.append(term, reading); values.append(row); }
          detail.append(values); const time = document.createElement("time"); time.dateTime = new Date(cache.timestamp).toISOString(); time.textContent = updated; detail.append(time);
        }
        if (error) { const warning = document.createElement("p"); warning.className = "navopath-weather-error"; warning.setAttribute("role", "alert"); warning.textContent = `${same ? (zh ? "离线缓存" : "Cached / offline") : (zh ? "获取失败" : "Request failed")}: ${error}`; detail.append(warning); }
        const refreshButton = document.createElement("button"); refreshButton.type = "button"; refreshButton.textContent = busy ? (zh ? "正在更新…" : "Refreshing…") : (zh ? "刷新" : "Refresh"); refreshButton.disabled = busy || !Number.isFinite(s.latitude) || !Number.isFinite(s.longitude); refreshButton.onclick = () => { void refresh(); };
        const attribution = document.createElement("a"); attribution.href = "https://open-meteo.com/"; attribution.target = "_blank"; attribution.rel = "noopener noreferrer"; attribution.textContent = "Open-Meteo";
        const actions = document.createElement("div"); actions.className = "navopath-weather-actions"; actions.append(refreshButton, attribution); detail.append(actions); node.append(detail);
      }
    };
    const json = async (url: URL, controller = new AbortController()) => {
      requests.add(controller);
      const timeout = setTimeout(() => controller.abort(), 15000);
      try { const response = await fetch(url, { signal: controller.signal, cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); }
      finally { clearTimeout(timeout); requests.delete(controller); }
    };
    function refresh(force = false): Promise<void> {
      const s = settings();
      if (stopped) return Promise.resolve();
      if (force) { forecastVersion++; forecastRequest?.abort(); busy = false; }
      if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) { render(); return Promise.resolve(); }
      if (busy) return pending ?? Promise.resolve();
      const version = ++forecastVersion;
      forecastRequest = new AbortController(); const controller = forecastRequest;
      busy = true; render();
      pending = (async () => {
      try {
        const url = new URL(s.endpoint || defaults.endpoint);
        if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error(zh ? "天气地址需要 HTTPS" : "Weather endpoint must use HTTPS");
        for (const [key, value] of Object.entries({ latitude: s.latitude, longitude: s.longitude, current: "temperature_2m,weather_code", daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max", temperature_unit: s.unit, timezone: "auto", forecast_days: 1 })) url.searchParams.set(key, String(value));
        const key = ctx.localStorage.get("apiKey"); if (key) url.searchParams.set("apikey", key);
        const result = await json(url, controller);
        const current = result.current?.temperature_2m, high = result.daily?.temperature_2m_max?.[0], low = result.daily?.temperature_2m_min?.[0], precipitation = result.daily?.precipitation_probability_max?.[0];
        if (![current, high, low, precipitation].every((value) => typeof value === "number" && Number.isFinite(value))) throw new Error(zh ? "天气响应缺少有效数据" : "Weather response is missing valid data");
        if (stopped || version !== forecastVersion) return;
        const weather_code = typeof result.current?.weather_code === "number" && Number.isFinite(result.current.weather_code) ? result.current.weather_code : null;
        cache = { latitude: s.latitude, longitude: s.longitude, unit: s.unit, current, high, low, precipitation, weather_code, timestamp: Date.now() };
        await ctx.storage.set("forecast", cache); error = "";
      } catch (cause: any) { if (!stopped && version === forecastVersion) error = cause?.message || String(cause); }
      finally { if (version === forecastVersion) { busy = false; if (!stopped) render(); } }
      })();
      return pending;
    }
    ctx.ui.addHeaderItem(zh ? "天气" : "Weather", (container: HTMLElement) => {
      const details = document.createElement("details"); details.className = "navopath-weather"; container.append(details); nodes.add(details); render();
      return () => { nodes.delete(details); details.remove(); };
    });
    ctx.settings.registerPage(zh ? "天气" : "Weather", (container: HTMLElement) => {
      const s = settings(); const form = document.createElement("form"); form.className = "navopath-plugin-settings";
      const city = document.createElement("input"); city.placeholder = zh ? "搜索城市" : "Search city"; city.value = s.city; city.setAttribute("aria-label", city.placeholder);
      const search = document.createElement("button"); search.type = "button"; search.textContent = zh ? "搜索" : "Search";
      const results = document.createElement("div"); results.setAttribute("aria-live", "polite"); let selected: any = null, searchVersion = 0, searchRequest: AbortController | null = null;
      search.onclick = async () => {
        const query = city.value.trim(); if (!query) return;
        const version = ++searchVersion; searchRequest?.abort(); searchRequest = new AbortController(); results.textContent = zh ? "正在搜索…" : "Searching…";
        try {
          const url = new URL("https://geocoding-api.open-meteo.com/v1/search"); url.searchParams.set("name", query); url.searchParams.set("count", "8"); url.searchParams.set("language", ctx.language);
          const response = await json(url, searchRequest); if (version !== searchVersion || stopped) return; results.replaceChildren();
          const places = Array.isArray(response.results) ? response.results : [];
          if (!places.length) results.textContent = zh ? "未找到城市" : "No cities found";
          for (const place of places) { const option = document.createElement("button"); option.type = "button"; option.textContent = [place.name, place.admin1, place.country].filter(Boolean).join(", "); option.onclick = () => { selected = { city: option.textContent, latitude: place.latitude, longitude: place.longitude }; city.value = selected.city; results.textContent = zh ? "已选择城市" : "City selected"; }; results.append(option); }
        } catch (cause: any) { if (version === searchVersion) results.textContent = cause.message; }
      };
      form.append(city, search, results);
      const field = (title: string, input: HTMLElement) => { const row = document.createElement("label"); const text = document.createElement("span"); text.textContent = title; row.append(text, input); form.append(row); };
      const unit = document.createElement("select"); for (const [value, text] of [["celsius", "°C"], ["fahrenheit", "°F"]]) { const option = document.createElement("option"); option.value = value; option.textContent = text; unit.append(option); } unit.value = s.unit; field(zh ? "温度单位" : "Temperature unit", unit);
      const interval = document.createElement("input"); interval.type = "number"; interval.min = "5"; interval.max = "1440"; interval.value = String(s.intervalMinutes); field(zh ? "更新间隔（分钟）" : "Refresh interval (minutes)", interval);
      const endpoint = document.createElement("input"); endpoint.type = "url"; endpoint.value = s.endpoint; field(zh ? "自定义地址（Open-Meteo 格式）" : "Custom endpoint (Open-Meteo format)", endpoint);
      const key = document.createElement("input"); key.type = "password"; key.autocomplete = "off"; key.value = ctx.localStorage.get("apiKey") || ""; field(zh ? "API 密钥（仅保存到此设备）" : "API key (stored on this device only)", key);
      const status = document.createElement("p"); status.setAttribute("aria-live", "polite");
      const save = document.createElement("button"); save.type = "submit"; save.textContent = zh ? "保存并更新" : "Save and refresh"; form.append(save, status);
      form.onsubmit = async (event) => { event.preventDefault(); if (!selected && city.value !== s.city) { status.textContent = zh ? "请先搜索并选择城市" : "Search and select a city first"; return; } try { new URL(endpoint.value); ctx.localStorage.set("apiKey", key.value); await ctx.settings.save({ ...(selected || {}), unit: unit.value, intervalMinutes: Math.max(5, Math.min(1440, Number(interval.value) || 30)), endpoint: endpoint.value }); await refresh(); status.textContent = error || (zh ? "已更新" : "Updated"); } catch (cause: any) { status.textContent = cause.message; } };
      container.append(form); return () => { searchVersion++; searchRequest?.abort(); form.remove(); };
    });
    ctx.interval(() => { const s = settings(); if (!cache || cache.unit !== s.unit || cache.latitude !== s.latitude || cache.longitude !== s.longitude || Date.now() - cache.timestamp >= Math.max(5, Number(s.intervalMinutes) || 30) * 60000) void refresh(); }, 60000);
    ctx.on(window, "online", () => { void refresh(); });
    ctx.events.on(`config:${ctx.id}`, () => { error = ""; void refresh(true); });
    ctx.register(() => { stopped = true; requests.forEach((request) => request.abort()); nodes.clear(); });
    void refresh();
  },
};
