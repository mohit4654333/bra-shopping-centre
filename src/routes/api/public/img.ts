import { createFileRoute } from "@tanstack/react-router";

// Image relay: many shops block photos when shown on another website.
// Fetches the photo server-side and only ever returns image content.
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|.*\.internal$)/i;

export const Route = createFileRoute("/api/public/img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("u") ?? "";
        let target: URL;
        try {
          target = new URL(u);
        } catch {
          return new Response("Bad url", { status: 400 });
        }
        if (!/^https?:$/.test(target.protocol) || PRIVATE_HOST.test(target.hostname)) {
          return new Response("Forbidden", { status: 403 });
        }
        const res = await fetch(target.href, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
            Referer: target.origin + "/",
          },
          signal: AbortSignal.timeout(15000),
        }).catch(() => null);
        if (!res || !res.ok) return new Response("Not found", { status: 404 });
        const type = res.headers.get("content-type") ?? "";
        if (!type.startsWith("image/") || type.includes("svg")) return new Response("Not an image", { status: 415 });
        const len = Number(res.headers.get("content-length") ?? 0);
        if (len > 15_000_000) return new Response("Too large", { status: 413 });
        return new Response(res.body, {
          headers: {
            "content-type": type,
            "cache-control": "public, max-age=604800, immutable",
          },
        });
      },
    },
  },
});
