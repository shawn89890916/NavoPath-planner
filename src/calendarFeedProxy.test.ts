import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../functions/calendar/[feed]";

const path = `/calendar/nvc_${"0".repeat(64)}.ics`;

describe("calendar subscription proxy", () => {
  it("forwards the feed without browser credentials or query parameters", async () => {
    const upstream = new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
      headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" },
    });
    const fetchFeed = vi.fn<(request: Request) => Promise<Response>>().mockResolvedValue(upstream);
    const env = { CALENDAR_FEED: { fetch: fetchFeed } };

    const result = await onRequest({ env, request: new Request(`https://navopath.com${path}?ignored=1`, {
      headers: { cookie: "session=secret", authorization: "Bearer secret" },
    }) });

    const [request] = fetchFeed.mock.calls[0];
    expect(request.url).toBe(`https://navopath.com${path}`);
    expect([...request.headers]).toEqual([]);
    expect(request.method).toBe("GET");
    expect(result).toBe(upstream);
  });

  it("preserves HEAD, conditional validation and upstream statuses", async () => {
    const fetchFeed = vi.fn<(request: Request) => Promise<Response>>().mockResolvedValue(new Response(null, { status: 304 }));
    const env = { CALENDAR_FEED: { fetch: fetchFeed } };

    const result = await onRequest({ env, request: new Request(`https://navopath.com${path}`, {
      method: "HEAD",
      headers: { "if-none-match": '"revision-1"' },
    }) });

    const [request] = fetchFeed.mock.calls[0];
    expect(request.method).toBe("HEAD");
    expect(request.headers.get("if-none-match")).toBe('"revision-1"');
    expect(result.status).toBe(304);
  });

  it("rejects unsupported methods and invalid paths before contacting the Worker", async () => {
    const fetchFeed = vi.fn<(request: Request) => Promise<Response>>();
    const env = { CALENDAR_FEED: { fetch: fetchFeed } };

    const invalid = await onRequest({ env, request: new Request("https://navopath.com/calendar/invalid.ics") });
    const post = await onRequest({ env, request: new Request(`https://navopath.com${path}`, { method: "POST" }) });

    expect(invalid.status).toBe(404);
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
    expect(fetchFeed).not.toHaveBeenCalled();
  });
});
