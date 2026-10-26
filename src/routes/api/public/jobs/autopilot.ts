import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Called every minute by the scheduler. Each switched-on channel does one step (import 1 product or scan for 10 more),
// all channels at the same time, so importing continues even when the admin's browser is closed.
export const Route = createFileRoute("/api/public/jobs/autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const work = (async () => {
          const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
          const { firecrawlKey, pilotTick } = await import("@/lib/autopilot.server");
          const { data: list } = await sb.from("import_channels").select("*").eq("autopilot", true);
          if (!list?.length) return;
          const key = await firecrawlKey(sb);
          const fresh = Date.now() - 50_000;
          const due = list.filter((c) => c.pending_urls.length > 0 || !c.last_run || new Date(c.last_run).getTime() < fresh);
          await Promise.all(due.map((c) => pilotTick(sb, c, key).catch((e) => console.error("autopilot", c.label, e))));
        })();
        const wu = (globalThis as { __waitUntil?: (p: Promise<unknown>) => void }).__waitUntil;
        if (wu) wu(work); else work.catch((e) => console.error(e));
        return Response.json({ ok: true });
      },
    },
  },
});
