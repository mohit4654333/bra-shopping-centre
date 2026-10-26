import { useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { slugifyCategory, type Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Refresh every category list in the store (admin dropdowns + storefront tabs). */
export function refreshCategories(qc: QueryClient) {
  return qc.invalidateQueries({
    predicate: (q) => {
      const k = String(q.queryKey[0] ?? "").toLowerCase();
      return k.includes("categor") || k.includes("cats");
    },
  });
}

/** "+ Add Category" with an inline input; saves to the categories table. */
export function AddCategoryButton({ existing = [], onAdded }: { existing?: Category[]; onAdded?: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = label.trim();
    const id = slugifyCategory(name);
    if (!id) { toast.error("Type a category name"); return; }
    const dup = existing.find((c) => c.id === id || c.label.toLowerCase() === name.toLowerCase());
    setSaving(true);
    if (!dup) {
      const { error } = await supabase.from("categories").insert({ id, label: name, slug: id });
      if (error) { setSaving(false); toast.error(error.message); return; }
      toast.success(`Category "${name}" added`);
    } else toast.info(`"${dup.label}" already exists`);
    await refreshCategories(qc);
    setSaving(false);
    setLabel("");
    setOpen(false);
    onAdded?.(dup?.id ?? id);
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />Add Category
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input autoFocus className="h-9 w-44" placeholder="e.g. Bridal Sets" value={label} onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }} />
      <Button type="button" size="sm" onClick={save} disabled={saving}>Save</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}
