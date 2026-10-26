import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Camera, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MAX_PHOTO_BYTES, MAX_REVIEW_PHOTOS, ratingSummary, reviewPhotoUrl, reviewSchema, timeAgo, type Review } from "@/lib/reviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} width={size} height={size} className={i <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40"} />
      ))}
    </span>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const { data: reviews = [], refetch } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase.from("reviews").select("*").eq("product_id", productId).eq("status", "approved").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as Review[];
    },
  });
  const sum = ratingSummary(reviews);
  const [open, setOpen] = useState(true);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-semibold">Customer Reviews</h2>
          {sum.count > 0 ? (
            <p className="mt-1 flex items-center gap-2 text-sm"><Stars value={sum.average} /> <b>{sum.average}</b> · {sum.count} review{sum.count > 1 ? "s" : ""}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Abhi tak koi customer review nahi — pehla review aap likhiye!</p>
          )}
        </div>
        <Button onClick={() => setOpen((o) => !o)} variant={open ? "outline" : "default"}>{open ? "Cancel" : "Write a review"}</Button>
      </div>
      {open && <ReviewForm productId={productId} onDone={() => { setOpen(false); refetch(); }} />}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating} size={14} />
              <span className="text-sm font-semibold">{r.customer_name}</span>
              {r.city && <span className="text-xs text-muted-foreground">· {r.city}</span>}
              {r.verified && <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success"><BadgeCheck className="h-3 w-3" />Verified Buyer</span>}
              {r.is_sample && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Sample review</span>}
              <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
            {r.photos.length > 0 && (
              <div className="mt-3 flex gap-2">
                {r.photos.map((p) => <a key={p} href={reviewPhotoUrl(p)} target="_blank" rel="noreferrer"><img src={reviewPhotoUrl(p)} alt="Customer photo" className="h-20 w-20 rounded-md object-cover" loading="lazy" /></a>)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const addFiles = (list: FileList | null) => {
    const ok = Array.from(list ?? []).filter((f) => {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast.error(`${f.name}: sirf JPG/PNG/WEBP photo`); return false; }
      if (f.size > MAX_PHOTO_BYTES) { toast.error(`${f.name}: 5MB se chhoti photo chunein`); return false; }
      return true;
    });
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_REVIEW_PHOTOS));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = reviewSchema.safeParse({ customer_name: name, city, rating, body });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Form check karein"); return; }
    setBusy(true);
    try {
      const photos: string[] = [];
      for (const f of files) {
        const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("review-photos").upload(path, f, { contentType: f.type });
        if (error) throw error;
        photos.push(path);
      }
      const { error } = await supabase.from("reviews").insert({ ...parsed.data, product_id: productId, photos });
      if (error) throw error;
      toast.success("Shukriya! Aapka review mil gaya.");
      onDone();
    } catch (err) {
      toast.error((err as Error).message || "Review save nahi hua");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-xl border bg-card p-5">
      <div>
        <p className="mb-1 text-sm font-semibold">Aapki rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" aria-label={`${i} star`} onClick={() => setRating(i)}>
              <Star className={`h-8 w-8 ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Aapka naam" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Shehar (optional)" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} />
      </div>
      <Textarea placeholder="Product kaisa laga? Fit, fabric, comfort…" value={body} maxLength={1000} rows={4} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f, i) => (
          <div key={i} className="relative">
            <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-md object-cover" />
            <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 rounded-full bg-foreground p-0.5 text-background"><X className="h-3 w-3" /></button>
          </div>
        ))}
        {files.length < MAX_REVIEW_PHOTOS && (
          <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
            <Camera className="h-5 w-5" />Photo
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit review"}</Button>
    </form>
  );
}
