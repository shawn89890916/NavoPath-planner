import homeMetadata from "../src/betaHomeMeta.json";

const sitePage = /^\/beta(?:\/?|\/(?:privacy|features\/(?:workspace|plugins|ai|execute|planning)|product-demo\/(?:workspace|ai|execute|planning)|principles(?:\/(?:jev|feedback|time|control|views|records))?)\/?)$/;

function attribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/beta" && !url.pathname.startsWith("/beta/")) {
      return new Response("Not found", { status: 404 });
    }

    const home = url.pathname === "/beta" || url.pathname === "/beta/";
    const preferredLanguage = request.headers.get("Accept-Language")?.split(",")[0]?.toLowerCase();
    const requestedLanguage = url.searchParams.get("lang");
    const language = requestedLanguage === "zh" || requestedLanguage === "en"
      ? requestedLanguage
      : preferredLanguage?.startsWith("zh") ? "zh" : "en";

    if (sitePage.test(url.pathname)) {
      url.pathname = "/beta/index.html";
      url.search = "";
    }
    const asset = await env.ASSETS.fetch(new Request(url, request));
    const response = new Response(asset.body, asset);
    response.headers.set("X-Robots-Tag", "noindex");
    if (!home || !asset.ok || !asset.headers.get("Content-Type")?.includes("text/html")) return response;

    const metadata = homeMetadata[language];
    response.headers.append("Vary", "Accept-Language");
    return new HTMLRewriter()
      .on("html", { element: element => element.setAttribute("lang", language === "zh" ? "zh-CN" : "en") })
      .on("title", { element: element => element.setInnerContent(metadata.title) })
      .on('meta[name="description"]', { element: element => element.setAttribute("content", metadata.description) })
      .on("head", { element: element => {
        element.append(`<meta property="og:title" content="${attribute(metadata.title)}"><meta property="og:description" content="${attribute(metadata.share)}">`, { html: true });
      } })
      .transform(response);
  },
};
