import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Serves customer review photos from the private "review-photos" bucket (public read policy, images only).
export const Route = createFileRoute("/api/public/review-img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const p = new URL(request.url).searchParams.get("p") ?? "";
        if (!/^[\w.\-]+$/.test(p)) return new Response("Bad path", { status: 400 });
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data, error } = await sb.storage.from("review-photos").download(p);
        if (error || !data) return new Response("Not found", { status: 404 });
        const type = data.type || "image/jpeg";
        if (!type.startsWith("image/") || type.includes("svg")) return new Response("Not an image", { status: 415 });
        return new Response(data, { headers: { "content-type": type, "cache-control": "public, max-age=604800, immutable" } });
      },
    },
  },
});
