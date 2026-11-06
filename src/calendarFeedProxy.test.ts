import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../functions/calendar/[feed]";

const path = `/calendar/nvc_${"0".repeat(64)}.ics`;

afterEach(() => vi.unstubAllGlobals());

describe("calendar subscription proxy", () => {
  it("forwards the feed over HTTPS without browser credentials or query parameters", async () => {
    const upstream = new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
      headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" },
    });
    const fetchFeed = vi.fn<typeof fetch>().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchFeed);

    const result = await onRequest({ request: new Request(`https://navopath.com${path}?ignored=1`, {
      headers: { cookie: "session=secret", authorization: "Bearer secret" },
    }) });

    const [url, init] = fetchFeed.mock.calls[0];
    expect(String(url)).toBe(`https://navopath-mcp.shawn89890916.workers.dev${path}`);
    expect([...new Headers(init?.headers)]).toEqual([]);
    expect(init).toMatchObject({ method: "GET", redirect: "error" });
    expect(result).toBe(upstream);
  });

  it("preserves HEAD, conditional validation and upstream statuses", async () => {
    const fetchFeed = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal("fetch", fetchFeed);

    const result = await onRequest({ request: new Request(`https://navopath.com${path}`, {
      method: "HEAD",
      headers: { "if-none-match": '"revision-1"' },
    }) });

    expect(fetchFeed.mock.calls[0][1]?.method).toBe("HEAD");
    expect(new Headers(fetchFeed.mock.calls[0][1]?.headers).get("if-none-match")).toBe('"revision-1"');
    expect(result.status).toBe(304);
  });

  it("rejects unsupported methods and invalid paths before contacting the Worker", async () => {
    const fetchFeed = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchFeed);

    const invalid = await onRequest({ request: new Request("https://navopath.com/calendar/invalid.ics") });
    const post = await onRequest({ request: new Request(`https://navopath.com${path}`, { method: "POST" }) });

    expect(invalid.status).toBe(404);
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
    expect(fetchFeed).not.toHaveBeenCalled();
  });
});
