const sitePage = /^\/beta(?:\/?|\/(?:privacy|features\/(?:workspace|plugins|ai|execute|planning)|product-demo\/(?:workspace|ai|execute|planning)|principles(?:\/(?:jev|feedback|time|control|views|records))?)\/?)$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/beta" && !url.pathname.startsWith("/beta/")) {
      return new Response("Not found", { status: 404 });
    }

    if (sitePage.test(url.pathname)) {
      url.pathname = "/beta/index.html";
      url.search = "";
    }
    const asset = await env.ASSETS.fetch(new Request(url, request));
    const response = new Response(asset.body, asset);
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  },
};
