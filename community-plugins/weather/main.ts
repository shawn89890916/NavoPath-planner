import { weatherGlyphs } from "../../src/extensions/weatherGlyphs";
import cityAliases from "./city-aliases.json";

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
  for (const [name, value] of Object.entries({ viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) svg.setAttribute(name, value);
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", weatherGlyphs[kind as keyof typeof weatherGlyphs] ?? weatherGlyphs.unknown); svg.append(path); return svg;
}

/** Keep the provider's administrative label for selection and a separate compact city label. */
export function weatherCityName(settings: { city?: string; cityShort?: string }) {
  return (settings.cityShort || settings.city?.split(/[,，]/)[0] || "").trim();
}

export function weatherSearchQueries(query: string) {
  const name = query.trim().replace(/，/g, ",");
  // GeoNames indexes some Chinese cities with 市 and others without it.
  // Probe both real names rather than inventing aliases or coordinates.
  const [city, ...qualifier] = name.split(",").map(part => part.trim());
  const short = city.replace(/[市县縣区區]$/, "");
  const alternate = short !== city ? short : `${city}市`;
  return [...new Set([name, ...(/^[\p{Script=Han}]+$/u.test(city) ? [[alternate, ...qualifier].join(",")] : [])])];
}

type WeatherPlace = { city: string; cityShort: string; latitude: number; longitude: number; population: number; id?: number };
export async function searchWeatherCities(query: string, language: string, request: (url: URL) => Promise<any>): Promise<WeatherPlace[]> {
  const aliasKey = query.trim().replace(/[市县縣区區]$/, "");
  const aliases = query.includes(",") || query.includes("，") ? [] : (cityAliases as Record<string, Array<{ id: number; name: string; country: string }>>)[aliasKey] || [];
  const aliasIds = new Set(aliases.map(alias => alias.id));
  const searches = weatherSearchQueries(query).map(name => {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", name); url.searchParams.set("count", "30"); url.searchParams.set("language", language);
    return request(url);
  });
  for (const alias of aliases) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/get");
    url.searchParams.set("id", String(alias.id)); url.searchParams.set("language", language);
    searches.push(request(url).then(place => ({ results: [place] })));
  }
  const responses = await Promise.allSettled(searches);
  if (responses.every(response => response.status === "rejected")) throw (responses[0] as PromiseRejectedResult).reason;
  const places = new Map<string, WeatherPlace>();
  for (const response of responses) {
    if (response.status !== "fulfilled" || !Array.isArray(response.value?.results)) continue;
    for (const place of response.value.results) {
      if (typeof place.name !== "string" || !place.name.trim() || !validCoordinates(place.latitude, place.longitude)) continue;
      const key = String(place.id ?? `${place.latitude},${place.longitude}`);
      const cityShort = place.name.trim();
      places.set(key, { city: [...new Set([cityShort, place.admin1, place.country].filter(Boolean))].join(", "), cityShort, latitude: place.latitude, longitude: place.longitude, population: Number(place.population) || 0, id: place.id });
    }
  }
  const normalized = (name: string) => name.toLocaleLowerCase().replace(/[市县縣区區]$/, "").trim();
  const city = normalized(query.split(/[,，]/)[0]);
  return [...places.values()].sort((a, b) => Number(aliasIds.has(b.id!)) - Number(aliasIds.has(a.id!)) || Number(normalized(b.cityShort) === city) - Number(normalized(a.cityShort) === city) || b.population - a.population).slice(0, 12);
}

function validCoordinates(latitude: unknown, longitude: unknown) {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export default {
  async onload(ctx: any) {
    const zh = ctx.language === "zh";
    const title = zh ? "天气" : "Weather";
    const defaults = { city: "", cityShort: "", latitude: null, longitude: null, unit: "celsius", intervalMinutes: 30, endpoint: "https://api.open-meteo.com/v1/forecast" };
    const settings = () => ({ ...defaults, ...ctx.settings.get() });
    const nodes = new Set<{ panel: HTMLElement; dispose: () => void }>();
    const requests = new Map<AbortController, number>();
    let stopped = false, busy = false, error = "", forecastVersion = 0;
    let forecastRequest: AbortController | null = null, pending: Promise<void> | null = null;
    let cache: any = await ctx.storage.get("forecast");
    const render = () => {
      const s = settings();
      const same = cache?.latitude === s.latitude && cache?.longitude === s.longitude && cache?.unit === s.unit && [cache?.current, cache?.high, cache?.low, cache?.precipitation, cache?.timestamp].every(value => typeof value === "number" && Number.isFinite(value));
      const condition = weatherCondition(same ? cache.weather_code : undefined, zh);
      const temperature = same ? String(Math.round(cache.current)) + "°" + (s.unit === "fahrenheit" ? "F" : "C") : (zh ? "天气暂无数据" : "Weather unavailable");
      const label = [weatherCityName(s) || title, temperature, condition.label].join(" · ");
      ctx.ui.setLauncherStatus({ label, weather: condition.icon });
      for (const { panel } of nodes) {
        const restoreRefreshFocus = panel.contains(document.activeElement);
        panel.replaceChildren();
        const heading = document.createElement("h3"); heading.textContent = s.city || (zh ? "天气" : "Weather"); panel.append(heading);
        const description = document.createElement("p"); description.className = "navopath-weather-current";
        if (same) {
          description.append(weatherIcon(condition.icon));
          const temperature = document.createElement("strong"); temperature.textContent = `${Math.round(cache.current)}°${s.unit === "fahrenheit" ? "F" : "C"}`; description.append(temperature);
        }
        const summary = document.createElement("span"); summary.textContent = same ? condition.label : s.city ? (zh ? "天气暂不可用" : "Weather unavailable") : (zh ? "请在下方搜索并选择城市。" : "Search and choose a city below."); description.append(summary); panel.append(description);
        panel.setAttribute("aria-label", zh ? `${weatherCityName(s)}天气` : `${weatherCityName(s)} weather`);
        panel.setAttribute("aria-busy", String(busy));
        if (same) {
          const values = document.createElement("dl");
          for (const [label, value] of [[zh ? "最高 / 最低" : "High / low", `${Math.round(cache.high)}° / ${Math.round(cache.low)}°`], [zh ? "降水概率" : "Precipitation chance", `${cache.precipitation}%`]]) { const row = document.createElement("div"), term = document.createElement("dt"), reading = document.createElement("dd"); term.textContent = label; reading.textContent = value; row.append(term, reading); values.append(row); }
          panel.append(values); const time = document.createElement("time"); time.dateTime = new Date(cache.timestamp).toISOString(); time.textContent = `${zh ? "更新于" : "Updated"} ${new Date(cache.timestamp).toLocaleString(ctx.language)}`; panel.append(time);
        }
        if (error) { const warning = document.createElement("p"); warning.className = "navopath-weather-error"; warning.setAttribute("role", "alert"); warning.textContent = `${same ? (zh ? "离线缓存" : "Cached / offline") : (zh ? "获取失败" : "Request failed")}: ${error}`; panel.append(warning); }
        const refreshButton = document.createElement("button"); refreshButton.type = "button"; refreshButton.className = "ui-button ui-button--secondary"; refreshButton.textContent = busy ? (zh ? "正在更新…" : "Refreshing…") : (zh ? "刷新" : "Refresh"); refreshButton.disabled = busy || !validCoordinates(s.latitude, s.longitude); refreshButton.onclick = () => { void refresh(); };
        const attribution = document.createElement("a"); attribution.href = "https://open-meteo.com/"; attribution.target = "_blank"; attribution.rel = "noopener noreferrer"; attribution.textContent = "Open-Meteo";
        const actions = document.createElement("div"); actions.className = "navopath-weather-actions"; actions.append(refreshButton, attribution); panel.append(actions);
        if (restoreRefreshFocus) { if (refreshButton.disabled) { panel.tabIndex = -1; panel.focus({ preventScroll: true }); } else refreshButton.focus({ preventScroll: true }); }
      }
    };
    const json = async (url: URL, controller = new AbortController()) => {
      requests.set(controller, (requests.get(controller) || 0) + 1);
      const timeout = setTimeout(() => controller.abort(), 15000);
      try { const response = await fetch(url, { signal: controller.signal, cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); }
      finally { clearTimeout(timeout); const remaining = (requests.get(controller) || 1) - 1; if (remaining) requests.set(controller, remaining); else requests.delete(controller); }
    };
    function refresh(force = false): Promise<void> {
      const s = settings();
      if (stopped) return Promise.resolve();
      if (force) { forecastVersion++; forecastRequest?.abort(); busy = false; }
      if (!validCoordinates(s.latitude, s.longitude)) { render(); return Promise.resolve(); }
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
    ctx.ui.registerPage(title, (container: HTMLElement) => {
      const panel = document.createElement("section"); panel.className = "navopath-weather-details";
      const s = settings(); const form = document.createElement("form"); form.className = "navopath-weather-settings";
      const heading = document.createElement("h3"); heading.textContent = zh ? "天气设置" : "Weather settings"; form.append(heading);
      const city = document.createElement("input"); city.placeholder = zh ? "搜索城市" : "Search city"; city.value = s.city; city.setAttribute("aria-label", city.placeholder);
      const search = document.createElement("button"); search.type = "button"; search.textContent = zh ? "搜索" : "Search";
      const results = document.createElement("div"); results.className = "navopath-weather-results"; results.setAttribute("aria-live", "polite"); let selected: WeatherPlace | null = null, searchVersion = 0, searchRequest: AbortController | null = null;
      city.oninput = () => { selected = null; searchVersion++; searchRequest?.abort(); results.replaceChildren(); };
      search.onclick = async () => {
        const query = city.value.trim(); if (!query) return;
        const version = ++searchVersion; searchRequest?.abort(); searchRequest = new AbortController(); const controller = searchRequest; results.textContent = zh ? "正在搜索…" : "Searching…";
        try {
          const places = await searchWeatherCities(query, ctx.language, url => json(url, controller)); if (version !== searchVersion || stopped) return; results.replaceChildren();
          if (!places.length) results.textContent = zh ? "未找到城市，请尝试城市全名、当地名称或英文名称。" : "No cities found. Try the full, local or English city name.";
          for (const place of places) { const option = document.createElement("button"); option.type = "button"; option.textContent = place.city; option.onclick = () => { selected = place; city.value = place.city; results.textContent = zh ? "已选择城市" : "City selected"; }; results.append(option); }
        } catch (cause: any) { if (version === searchVersion && !stopped) results.textContent = cause.message; }
      };
      city.onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); search.click(); } };
      form.append(city, search, results);
      const geocodingAttribution = document.createElement("a"); geocodingAttribution.href = "https://www.geonames.org/"; geocodingAttribution.target = "_blank"; geocodingAttribution.rel = "noopener noreferrer"; geocodingAttribution.textContent = zh ? "城市数据：GeoNames · Open-Meteo" : "City data: GeoNames · Open-Meteo"; form.append(geocodingAttribution);
      const field = (title: string, input: HTMLElement) => { const row = document.createElement("label"); const text = document.createElement("span"); text.textContent = title; row.append(text, input); form.append(row); };
      const unit = document.createElement("select"); for (const [value, text] of [["celsius", "°C"], ["fahrenheit", "°F"]]) { const option = document.createElement("option"); option.value = value; option.textContent = text; unit.append(option); } unit.value = s.unit; field(zh ? "温度单位" : "Temperature unit", unit);
      const interval = document.createElement("input"); interval.type = "number"; interval.min = "5"; interval.max = "1440"; interval.value = String(s.intervalMinutes); field(zh ? "更新间隔（分钟）" : "Refresh interval (minutes)", interval);
      const endpoint = document.createElement("input"); endpoint.type = "url"; endpoint.value = s.endpoint; field(zh ? "自定义地址（Open-Meteo 格式）" : "Custom endpoint (Open-Meteo format)", endpoint);
      const key = document.createElement("input"); key.type = "password"; key.autocomplete = "off"; key.value = ctx.localStorage.get("apiKey") || ""; field(zh ? "API 密钥（仅保存到此设备）" : "API key (stored on this device only)", key);
      const status = document.createElement("p"); status.setAttribute("aria-live", "polite");
      const save = document.createElement("button"); save.type = "submit"; save.textContent = zh ? "保存并更新" : "Save and refresh"; form.append(save, status);
      form.onsubmit = async (event) => { event.preventDefault(); const current = settings(); if ((!selected && city.value !== current.city) || (selected && city.value !== selected.city)) { status.textContent = zh ? "请先搜索并选择城市" : "Search and select a city first"; return; } try { new URL(endpoint.value); ctx.localStorage.set("apiKey", key.value); const location = selected ? { city: selected.city, cityShort: selected.cityShort, latitude: selected.latitude, longitude: selected.longitude } : { cityShort: weatherCityName(current) }; await ctx.settings.save({ ...location, unit: unit.value, intervalMinutes: Math.max(5, Math.min(1440, Number(interval.value) || 30)), endpoint: endpoint.value }); await refresh(true); status.textContent = error || (zh ? "已更新" : "Updated"); } catch (cause: any) { status.textContent = cause.message; } };
      const entry = { panel, dispose: () => { searchVersion++; searchRequest?.abort(); nodes.delete(entry); panel.remove(); form.remove(); } };
      nodes.add(entry); container.append(panel, form); render();
      return entry.dispose;
    });
    ctx.interval(() => { const s = settings(); if (!cache || cache.unit !== s.unit || cache.latitude !== s.latitude || cache.longitude !== s.longitude || Date.now() - cache.timestamp >= Math.max(5, Number(s.intervalMinutes) || 30) * 60000) void refresh(); }, 60000);
    ctx.on(window, "online", () => { void refresh(); });
    ctx.events.on(`config:${ctx.id}`, () => { error = ""; void refresh(true); });
    ctx.register(() => { stopped = true; requests.forEach((_, request) => request.abort()); for (const entry of nodes) entry.dispose(); nodes.clear(); });
    void refresh();
  },
};
