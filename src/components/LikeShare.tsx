import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart, Share2 } from "lucide-react";

const KEY = "gb_liked";
const EVT = "gb-liked";
export const readLiked = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; }
};
export function writeLiked(list: string[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

/** Liked product ids, kept in sync across every button on the page. */
export function useLiked(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readLiked());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return ids;
}

export function LikeButton({ id, className = "" }: { id: string; className?: string }) {
  const liked = useLiked().includes(id);
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const list = readLiked().filter((x) => x !== id);
    if (!liked) list.push(id);
    writeLiked(list);
    toast.success(liked ? "Like hata diya" : "Pasand kiya ❤️");
  };
  return (
    <button type="button" onClick={toggle} aria-label={liked ? "Unlike" : "Like"} aria-pressed={liked}
      className={`grid h-9 w-9 place-items-center rounded-full bg-card/90 shadow ${className}`}>
      <Heart className={`h-5 w-5 ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
    </button>
  );
}

export function ShareButtons({ name, price }: { name: string; price: string }) {
  const text = () => `${name} – sirf ${price}`;
  const copy = async () => {
    const u = window.location.href;
    try { await navigator.clipboard.writeText(u); }
    catch {
      const t = document.createElement("textarea"); t.value = u; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      t.remove();
    }
    toast.success("Link copy ho gaya!");
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: name, text: text(), url: window.location.href }); return; }
      catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    await copy();
  };
  const wa = () => `https://wa.me/?text=${encodeURIComponent(`${text()} ${typeof window !== "undefined" ? window.location.href : ""}`)}`;
  return (
    <div className="flex gap-2">
      <button type="button" onClick={share} className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium hover:border-primary">
        <Share2 className="h-4 w-4" />Share
      </button>
      <a href="#" onClick={(e) => { e.preventDefault(); window.open(wa(), "_blank", "noopener"); }}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium hover:border-primary">
        WhatsApp
      </a>
    </div>
  );
}
