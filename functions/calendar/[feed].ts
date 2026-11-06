type CalendarFeedEnv = { CALENDAR_FEED: { fetch(request: Request): Promise<Response> } };

export async function onRequest({ request, env }: { request: Request; env: CalendarFeedEnv }) {
  const { pathname } = new URL(request.url);
  if (!/^\/calendar\/nvc_[a-f0-9]{64}\.ics$/.test(pathname)) {
    return new Response("Calendar subscription not found", { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  const headers = new Headers();
  const etag = request.headers.get("if-none-match");
  if (etag) headers.set("if-none-match", etag);

  return env.CALENDAR_FEED.fetch(new Request(new URL(pathname, request.url), {
    method: request.method,
    headers,
  }));
}
