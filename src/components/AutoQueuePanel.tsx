import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Play, Square, Trash2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importAndSave, scanChannel } from "@/lib/autoqueue.functions";
import { IMPORT_CONCURRENCY, PILOT_BATCH, parseCommand, pool } from "@/lib/autoqueue";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AddCategoryButton } from "@/components/AddCategoryButton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type Channel = { id: string; label: string; category: string; url: string; last_scanned_page: number; last_sync_timestamp: string | null; imported_count: number; autopilot: boolean; pending_urls: string[]; last_error: string | null; last_run: string | null };
type Run = { label: string; phase: "scanning" | "importing" | "done"; total: number; index: number; current: string; added: number; skipped: number; failed: number; log: string[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AutoQueuePanel({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const scan = useServerFn(scanChannel);
  const importOne = useServerFn(importAndSave);
  const channels = useQuery({
    queryKey: ["import-channels"],
    queryFn: async () => ((await supabase.from("import_channels").select("*").order("created_at")).data ?? []) as Channel[],
    refetchInterval: (q) => ((q.state.data as Channel[] | undefined)?.some((c) => c.autopilot) ? 4000 : false),
  });
  const pilotOn = (channels.data ?? []).filter((c) => c.autopilot);
  const [form, setForm] = useState({ label: "", category: categories[0]?.id ?? "bra", url: "" });
  const [cmd, setCmd] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const stop = useRef(false);
  const busy = !!run && run.phase !== "done";

  // Live loop while this tab is open: every switched-on channel keeps fetching the next 10 as soon as the last 10 finish,
  // all channels in parallel, until Auto-Pilot is stopped. The server keeps going on its own when the tab is closed.
  const [live, setLive] = useState<Record<string, { added: number; batch: number; status: string }>>({});
  const active = useRef<Set<string>>(new Set());
  const running = useRef<Set<string>>(new Set());
  const pilotKey = pilotOn.map((c) => c.id).join(",");
  useEffect(() => {
    const on = new Set(pilotOn.map((c) => c.id));
    active.current = on;
    const bump = (id: string, patch: Partial<{ added: number; batch: number; status: string }>) =>
      setLive((m) => ({ ...m, [id]: { added: 0, batch: 0, status: "", ...m[id], ...patch } }));
    for (const c of pilotOn) {
      if (running.current.has(c.id)) continue;
      running.current.add(c.id);
      (async () => {
        let added = 0, batch = 0, empty = 0;
        while (active.current.has(c.id)) {
          batch++;
          bump(c.id, { batch, status: "Scanning next pages…" });
          let urls: string[] = [];
          try { urls = (await scan({ data: { channelId: c.id, count: PILOT_BATCH } })).urls; }
          catch (e) { bump(c.id, { status: e instanceof Error ? e.message : "Scan failed" }); await sleep(5000); continue; }
          if (!urls.length) { empty++; bump(c.id, { status: "No new products — checking again from page 1" }); await sleep(Math.min(30000, 3000 * empty)); continue; }
          empty = 0;
          let doneN = 0;
          await pool(urls, IMPORT_CONCURRENCY, async (url) => {
            try { const r = await importOne({ data: { url, category: c.category, channelId: c.id } }); if (r.status === "added") { added++; bump(c.id, { added }); } }
            finally { doneN++; bump(c.id, { status: `Batch ${batch}: ${doneN} of ${urls.length} done (${IMPORT_CONCURRENCY} at once)` }); }
          }, () => active.current.has(c.id));
          qc.invalidateQueries({ queryKey: ["admin-products"] });
        }
        running.current.delete(c.id);
        bump(c.id, { status: "Stopped" });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilotKey]);
  useEffect(() => () => { active.current = new Set(); }, []);

  const addChannel = async () => {
    if (!form.label.trim() || !/^https?:\/\//.test(form.url.trim())) { toast.error("Add a name and a category link"); return; }
    const { error } = await supabase.from("import_channels").insert({ label: form.label.trim(), category: form.category, url: form.url.trim() });
    if (error) { toast.error(error.message); return; }
    setForm({ ...form, label: "", url: "" });
    channels.refetch();
  };
  const removeChannel = async (c: Channel) => {
    if (!confirm(`Remove channel "${c.label}"?`)) return;
    await supabase.from("import_channels").delete().eq("id", c.id);
    channels.refetch();
  };
  const resetPage = async (c: Channel) => {
    await supabase.from("import_channels").update({ last_scanned_page: 0 }).eq("id", c.id);
    channels.refetch();
  };

  const start = async (c: Channel, count: number, silent = false): Promise<{ found: number; added: number }> => {
    if (!silent) stop.current = false;
    const r: Run = { label: c.label, phase: "scanning", total: count, index: 0, current: "", added: 0, skipped: 0, failed: 0, log: [] };
    setRun({ ...r });
    try {
      const s = await scan({ data: { channelId: c.id, count } });
      r.skipped = s.skipped;
      r.total = s.urls.length;
      r.log.push(`Scanned up to page ${s.page}: ${s.urls.length} new, ${s.skipped} already in store`);
      if (!s.urls.length) { r.phase = "done"; setRun({ ...r }); if (!silent) toast.info("No new products found on the next pages"); return { found: 0, added: 0 }; }
      r.phase = "importing";
      await pool(s.urls, IMPORT_CONCURRENCY, async (url) => {
        const label = decodeURIComponent(url.split("/").pop() ?? "").replace(/[-_]/g, " ").replace(/\.html$/, "").slice(0, 60);
        try {
          const res = await importOne({ data: { url, category: c.category, channelId: c.id } });
          if (res.status === "added") { r.added++; r.current = res.name; r.log.push(`✓ ${res.name}`); }
          else { r.skipped++; r.log.push(`↷ already in store`); }
        } catch (e) {
          r.failed++;
          r.log.push(`✗ ${label}: ${e instanceof Error ? e.message : "failed"}`);
        }
        r.index++;
        setRun({ ...r });
      }, () => !stop.current);
      if (stop.current) r.log.push("Stopped by you");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
      r.log.push(`Scan failed: ${e instanceof Error ? e.message : ""}`);
    }
    r.phase = "done";
    setRun({ ...r });
    channels.refetch();
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    if (!silent) toast.success(`${r.added} added · ${r.skipped} skipped · ${r.failed} failed`);
    return { found: r.total, added: r.added };
  };

  // Background Auto-Pilot: the server imports for every switched-on channel every minute, even with this tab closed.
  const setPilotAll = async (on: boolean) => {
    const list = channels.data ?? [];
    if (!list.length) { toast.error("Save at least one channel first"); return; }
    const { error } = await supabase.from("import_channels").update(on ? { autopilot: true, dry_scans: 0, last_error: null } : { autopilot: false, pending_urls: [] }).in("id", list.map((c) => c.id));
    if (error) { toast.error(error.message); return; }
    toast.success(on ? "Auto-Pilot ON — sab categories background mein import ho rahi hain. Browser band kar sakti hain." : "Auto-Pilot band kar diya");
    channels.refetch();
  };
  const togglePilot = async (c: Channel) => {
    const { error } = await supabase.from("import_channels").update(c.autopilot ? { autopilot: false, pending_urls: [] } : { autopilot: true, dry_scans: 0, last_error: null }).eq("id", c.id);
    if (error) toast.error(error.message); else channels.refetch();
  };

  const runCommand = () => {
    const p = parseCommand(cmd);
    if (!p) { toast.error('Try: "Add next 15 products from Sets"'); return; }
    const list = channels.data ?? [];
    const c = list.find((x) => x.label.toLowerCase() === p.channel)
      ?? list.find((x) => x.label.toLowerCase().includes(p.channel) || p.channel.includes(x.label.toLowerCase()))
      ?? list.find((x) => x.category === p.channel || categories.find((k) => k.id === x.category)?.label.toLowerCase().includes(p.channel));
    if (!c) { toast.error(`No saved channel matches "${p.channel}"`); return; }
    setCmd("");
    start(c, p.count);
  };

  const pct = run && run.total ? Math.round(((run.phase === "done" ? run.total : run.index - 1) / run.total) * 100) : 0;

  return (
    <section className="mt-8 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Import Channels & Presets</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Save a category page once. Start Non-Stop once and it keeps adding new products by itself — already imported ones are skipped instantly, and the next run continues from the next page.</p>

      {run && (
        <div className="mt-4 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {run.phase === "scanning" && `Scanning ${run.label} for new products…`}
            {run.phase === "importing" && `Processing ${run.index} of ${run.total}: ${run.current}…`}
            {run.phase === "done" && `Done — ${run.label}`}
            {busy && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { stop.current = true; }}><Square className="mr-1 h-3 w-3" />Stop</Button>}
          </div>
          <Progress value={pct} className="mt-3" />
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>{pct}%</span><span>Added: <b className="text-foreground">{run.added}</b></span><span>Skipped: {run.skipped}</span><span>Failed: {run.failed}</span>
          </div>
          {run.log.length > 0 && (
            <div className="mt-3 max-h-40 overflow-auto rounded bg-background p-2 font-mono text-xs">
              {run.log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
        {pilotOn.length ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Auto-Pilot chal raha hai (background) · {pilotOn.map((c) => c.label).join(", ")} · total {pilotOn.reduce((n, c) => n + c.imported_count, 0)} imported</span>
            <Button size="sm" variant="destructive" className="ml-auto" onClick={() => setPilotAll(false)}><Square className="mr-1 h-3 w-3" />Stop Auto-Pilot</Button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">Ek click — saari categories non-stop, page-by-page jab tak category khatam na ho. Browser band karne par bhi chalta rahega.</span>
            <Button className="ml-auto" onClick={() => setPilotAll(true)}><Play className="mr-1 h-4 w-4" />Start Auto-Pilot</Button>
          </>
        )}
      </div>

      {pilotOn.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pilotOn.map((c) => {
            const waiting = c.pending_urls.length;
            const lanePct = waiting ? Math.round(((PILOT_BATCH - Math.min(waiting, PILOT_BATCH)) / PILOT_BATCH) * 100) : 0;
            const ago = c.last_run ? Math.round((Date.now() - new Date(c.last_run).getTime()) / 1000) : null;
            return (
              <div key={c.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="truncate">{c.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.imported_count} added</span>
                </div>
                <Progress value={waiting ? lanePct : 100} className="mt-2" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {waiting ? `Importing batch · ${waiting} waiting` : `Scanning page ${c.last_scanned_page + 1}…`}
                  {ago !== null && ` · ${ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`} ago`}
                </p>
                {live[c.id] && <p className="mt-1 text-xs text-primary">Live (this tab): {live[c.id]!.status} · {live[c.id]!.added} added</p>}
                {c.last_error && <p className="mt-1 line-clamp-2 text-xs text-destructive">{c.last_error}</p>}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Input placeholder='Command: "Add next 15 products from Sets"' value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && runCommand()} disabled={busy} />
        <Button onClick={runCommand} disabled={busy}>Run</Button>
      </div>

      <div className="mt-4 divide-y rounded-lg border">
        {(channels.data ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{c.label} <span className="text-xs text-muted-foreground">→ {categories.find((k) => k.id === c.category)?.label ?? c.category}</span></p>
              <p className="truncate text-xs text-muted-foreground">{c.url}</p>
              <p className="text-xs text-muted-foreground">Pages scanned: {c.last_scanned_page} · Imported: {c.imported_count} · Waiting: {c.pending_urls.length} · Last sync: {c.last_sync_timestamp ? new Date(c.last_sync_timestamp).toLocaleString() : "never"}</p>
              {c.autopilot && c.last_error && <p className="text-xs text-destructive">{c.last_error}</p>}
            </div>
            <Button size="sm" variant={c.autopilot ? "destructive" : "secondary"} onClick={() => togglePilot(c)}>{c.autopilot ? "Non-stop ON — Stop" : "▶ Start Non-Stop"}</Button>
            <Button size="sm" variant="ghost" onClick={() => resetPage(c)} disabled={busy}>Restart from page 1</Button>
            <Button size="icon" variant="ghost" aria-label="Remove channel" onClick={() => removeChannel(c)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {!channels.data?.length && <p className="p-3 text-sm text-muted-foreground">No channels yet — add your first category link below.</p>}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_10rem_2fr_auto]">
        <Input placeholder="Name (e.g. Bras)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {categories.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <Input placeholder="https://www.zivame.com/bras.html" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <Button variant="outline" onClick={addChannel}>Save channel</Button>
      </div>
      <div className="mt-2">
        <AddCategoryButton existing={categories} onAdded={(id) => setForm((f) => ({ ...f, category: id }))} />
      </div>
    </section>
  );
}
