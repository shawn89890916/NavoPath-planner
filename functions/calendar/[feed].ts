type CalendarFeedEnv = { CALENDAR_FEED: { fetch(request: Request): Promise<Response> } };

export async function onRequest({ request, env }: { request: Request; env: CalendarFeedEnv }) {
  const { pathname } = new URL(request.url);
  // The authenticated capability endpoint is separate from public feed fetches.
  if (pathname === "/calendar/history-link") {
    if (request.method !== "POST" && request.method !== "OPTIONS") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "POST, OPTIONS" } });
    }
    const headers = new Headers();
    for (const name of ["authorization", "origin", "access-control-request-method", "access-control-request-headers"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    return env.CALENDAR_FEED.fetch(new Request(new URL(pathname, request.url), { method: request.method, headers }));
  }
  if (!/^\/calendar\/(?:nvc_[a-f0-9]{64}(?:-history)?|nvh_[0-9a-f-]{36}_[0-9a-f]{64}-history)\.ics$/.test(pathname)) {
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
