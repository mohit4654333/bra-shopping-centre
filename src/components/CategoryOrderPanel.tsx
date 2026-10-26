import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { refreshCategories } from "@/components/AddCategoryButton";

type Cat = { id: string; label: string };

/** Moves one item from index `from` to index `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x as T);
  return out;
}

/** Drag (or tap arrows) to set the order categories show on the home page. */
export function CategoryOrderPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-cat-order"],
    queryFn: async (): Promise<Cat[]> => (await supabase.from("categories").select("id,label").order("sort").order("created_at")).data ?? [],
  });
  const [list, setList] = useState<Cat[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (q.data) setList(q.data); }, [q.data]);

  const save = async () => {
    setSaving(true);
    const res = await Promise.all(list.map((c, i) => supabase.from("categories").update({ sort: i + 1 }).eq("id", c.id)));
    setSaving(false);
    const err = res.find((r) => r.error)?.error;
    if (err) { toast.error(err.message); return; }
    toast.success("Category order saved");
    await refreshCategories(qc);
    qc.invalidateQueries();
  };

  if (!list.length) return null;
  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">↕️ Home page category order</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pakad ke upar-neeche kheenchein ya ▲▼ dabayein, phir Save karein.</p>
      <ul className="mt-3 divide-y rounded-lg border">
        {list.map((c, i) => (
          <li key={c.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag !== null) setList((l) => moveItem(l, drag, i)); setDrag(null); }}
            className={`flex items-center gap-2 p-2 ${drag === i ? "opacity-50" : ""}`}>
            <GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" />
            <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
            <span className="flex-1 text-sm font-medium">{c.label}</span>
            <Button size="icon" variant="ghost" aria-label={`Move ${c.label} up`} disabled={i === 0} onClick={() => setList((l) => moveItem(l, i, i - 1))}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={`Move ${c.label} down`} disabled={i === list.length - 1} onClick={() => setList((l) => moveItem(l, i, i + 1))}><ArrowDown className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={i === 0} onClick={() => setList((l) => moveItem(l, i, 0))}>First</Button>
            <Button size="sm" variant="outline" disabled={i === list.length - 1} onClick={() => setList((l) => moveItem(l, i, l.length - 1))}>Last</Button>
          </li>
        ))}
      </ul>
      <Button className="mt-3" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save order"}</Button>
    </section>
  );
}
