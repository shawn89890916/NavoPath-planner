const CALENDAR_WORKER_ORIGIN = "https://navopath-mcp.shawn89890916.workers.dev";

export async function onRequest({ request }: { request: Request }) {
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

  return fetch(new URL(pathname, CALENDAR_WORKER_ORIGIN), {
    method: request.method,
    headers,
    redirect: "error",
  });
}
