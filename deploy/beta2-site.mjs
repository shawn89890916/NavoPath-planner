const prefix = "/beta2";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
      return new Response("Not found", { status: 404 });
    }
    if (url.pathname === prefix || url.pathname === `${prefix}/`) {
      url.pathname = `${prefix}/beta2.html`;
      url.search = "";
    }
    const asset = await env.ASSETS.fetch(new Request(url, request));
    const response = new Response(asset.body, asset);
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  },
};
