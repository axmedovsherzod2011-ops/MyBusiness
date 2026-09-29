interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=UTF-8",
          "cache-control": "no-store",
        },
      });
    }

    let response = await env.ASSETS.fetch(request);

    // Seller is a React SPA. Cloudflare Workers serves assets directly,
    // so browser deep links must fall back to the Vite entry document.
    if (
      response.status === 404 &&
      (request.method === "GET" || request.method === "HEAD") &&
      (request.headers.get("accept") ?? "").includes("text/html")
    ) {
      const indexUrl = new URL("/index.html", url);
      response = await env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-store, no-cache, must-revalidate");
      headers.set("pragma", "no-cache");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },
};
