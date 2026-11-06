type CalendarWorker = { fetch(request: Request): Promise<Response> };

export function onRequest({ request, env }: { request: Request; env: { CALENDAR_FEED: CalendarWorker } }) {
  const headers = new Headers();
  for (const name of ["authorization", "content-type", "depth", "if-match", "if-none-match"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return env.CALENDAR_FEED.fetch(new Request(request, { headers }));
}
