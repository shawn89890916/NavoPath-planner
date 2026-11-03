import { describe, expect, it } from "vitest";
import { searchWeatherCities, weatherCityName, weatherSearchQueries } from "../../community-plugins/weather/main";

const place = (name: string, latitude: number, longitude: number, extra = {}) => ({ name, latitude, longitude, ...extra });

describe("weather city search", () => {
  it("checks the Chinese administrative spelling without altering English or international input", () => {
    expect(weatherSearchQueries("温州")).toEqual(["温州", "温州市"]);
    expect(weatherSearchQueries("北京市")).toEqual(["北京市", "北京"]);
    expect(weatherSearchQueries("瑞安县")).toEqual(["瑞安县", "瑞安"]);
    expect(weatherSearchQueries("温州， China")).toEqual(["温州, China", "温州市,China"]);
    expect(weatherSearchQueries("New York")).toEqual(["New York"]);
    expect(weatherSearchQueries("São Paulo")).toEqual(["São Paulo"]);
  });

  it("uses provider coordinates, deduplicates variants and ranks the populated city first", async () => {
    const seen: string[] = [];
    const results = await searchWeatherCities("上海市", "zh", async url => {
      if (url.pathname.endsWith("/get")) return {};
      seen.push(url.searchParams.get("name")!);
      expect(url.searchParams.get("language")).toBe("zh");
      return { results: url.searchParams.get("name") === "上海市" ? [place("上海市", 41.05087, -90.4968, { id: 1, population: 100, country: "美国" })] : [place("上海", 31.22222, 121.45806, { id: 2, population: 24874500, admin1: "上海市", country: "中国" }), place("上海", 31.22222, 121.45806, { id: 2, population: 24874500, admin1: "上海市", country: "中国" })] };
    });
    expect(seen).toEqual(["上海市", "上海"]);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ cityShort: "上海", city: "上海, 上海市, 中国", latitude: 31.22222, longitude: 121.45806 });
  });

  it("finds 温州市 from 温州 and retains county-level 瑞安 and English/international places", async () => {
    const cities: Record<string, any> = { 温州市: place("温州市", 27.99942, 120.66682), 瑞安: place("瑞安", 27.77605, 120.65859), London: place("London", 51.50853, -0.12574), 東京: place("東京", 35.6895, 139.69171) };
    for (const [query, expected] of [["温州", "温州市"], ["瑞安", "瑞安"], ["London", "London"], ["東京", "東京"]]) {
      const results = await searchWeatherCities(query, "zh", async url => ({ results: cities[url.searchParams.get("name")!] ? [cities[url.searchParams.get("name")!]] : [] }));
      expect(results[0].cityShort).toBe(expected);
      expect(results[0].latitude).toBe(cities[expected].latitude);
    }
  });

  it("ignores malformed locations, tolerates one failed spelling and reports complete failure", async () => {
    const results = await searchWeatherCities("温州", "zh", async url => {
      if (url.searchParams.get("name") === "温州") throw new Error("offline");
      return { results: [place("温州市", 27.99942, 120.66682), place("Invalid", null as any, 0), place("Invalid", 91, 2), place("Invalid", 3, Infinity), place("", 2, 3)] };
    });
    expect(results).toHaveLength(1);
    await expect(searchWeatherCities("温州", "zh", async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(await searchWeatherCities("missing", "en", async () => ({}))).toEqual([]);
  });

  it("resolves verified Chinese aliases through provider IDs and ranks London above smaller direct matches", async () => {
    const verified: Record<string, any> = {
      "1816670": place("北京", 39.9075, 116.39723, { id: 1816670, population: 18960744 }),
      "5128581": place("紐約市", 40.71427, -74.00597, { id: 5128581, population: 8804190 }),
      "2643743": place("倫敦", 51.50853, -0.12574, { id: 2643743, population: 8961989 }),
    };
    for (const [query, id] of [["北京", "1816670"], ["纽约", "5128581"], ["伦敦", "2643743"]]) {
      const ids: string[] = [];
      const results = await searchWeatherCities(query, "zh", async url => {
        if (url.pathname.endsWith("/get")) { const id = url.searchParams.get("id")!; ids.push(id); return verified[id] || {}; }
        return { results: [place(query, 42.98339, -81.23304, { id: 3, population: 422324 })] };
      });
      expect(ids).toContain(id);
      expect(results[0]).toMatchObject({ id: Number(id), latitude: verified[id].latitude, longitude: verified[id].longitude });
    }
  });

  it("honors explicit administrative/country qualifiers instead of adding unqualified aliases", async () => {
    const paths: string[] = [];
    await searchWeatherCities("伦敦, CA", "zh", async url => { paths.push(url.pathname); return {}; });
    expect(paths.every(path => path.endsWith("/search"))).toBe(true);
  });

  it("migrates legacy composite city labels without discarding their administrative context", () => {
    expect(weatherCityName({ city: "温州市, 浙江, 中国" })).toBe("温州市");
    expect(weatherCityName({ city: "上海，上海市，中国" })).toBe("上海");
    expect(weatherCityName({ city: "Seattle, Washington, United States", cityShort: "Seattle" })).toBe("Seattle");
    expect(weatherCityName({})).toBe("");
  });
});
