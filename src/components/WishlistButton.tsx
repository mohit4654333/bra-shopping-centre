import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listProducts } from "@/lib/products.functions";
import { coverImage, type Product } from "@/lib/types";
import { rupees } from "@/lib/cart";
import { SafeImg } from "./SafeImg";
import { readLiked, useLiked, writeLiked } from "./LikeShare";

export function WishlistButton({ className }: { className: string }) {
  const ids = useLiked();
  const [open, setOpen] = useState(false);
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled: open });
  const liked = (products as Product[]).filter((p) => ids.includes(p.id));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Liked" className={className}>
        <Heart className="h-5 w-5" />
        {ids.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{ids.length}</span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto">
          <SheetHeader><SheetTitle>Pasand kiye ❤️</SheetTitle></SheetHeader>
          {ids.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">Abhi koi product like nahi kiya. Product par ❤️ dabayein.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {liked.map((p) => (
                <div key={p.id} className="flex gap-3 rounded-lg border bg-card p-2">
                  <Link to="/product/$id" params={{ id: p.id }} search={{ color: undefined }} onClick={() => setOpen(false)} className="flex min-w-0 flex-1 gap-3">
                    <SafeImg src={coverImage(p)} alt={p.name} className="h-24 w-16 shrink-0 rounded bg-muted object-contain" />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm">{p.name}</p>
                      <p className="mt-1 text-sm font-bold">{rupees(p.price)}</p>
                    </div>
                  </Link>
                  <button type="button" aria-label="Remove" onClick={() => writeLiked(readLiked().filter((x) => x !== p.id))} className="self-start p-1 text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
