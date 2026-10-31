import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Search } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listCategories } from "@/lib/products.functions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { settingsQuery } from "@/lib/store.functions";
import { WishlistButton } from "./WishlistButton";
import { MusicPlayer } from "./MusicPlayer";

const round = "relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-sm hover:bg-accent";

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const { data: st } = useSuspenseQuery(settingsQuery);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data: cats } = useSuspenseQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  return (
    <>
      {st.announcement_bar && st.announcement_text && (
        <div className="relative flex h-8 items-center overflow-hidden bg-primary text-xs text-primary-foreground">
          <MusicPlayer />
          <div className="relative z-10 flex h-full shrink-0 items-center rounded-r-full bg-foreground pl-1 pr-4 font-display font-bold tracking-wide text-background shadow-lg">
            {st.brand_name}
          </div>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="gb-marquee flex w-max whitespace-nowrap">
              <span className="px-8">{st.announcement_text}</span>
              <span className="px-8" aria-hidden>{st.announcement_text}</span>
            </div>
          </div>
        </div>
      )}
      <header className="bg-hero sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3">
          <form
            onSubmit={(e) => { e.preventDefault(); navigate({ to: "/", search: q.trim() ? { q: q.trim() } : {}, hash: "shop" }); }}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-card px-2 shadow-sm"
          >
            <Link to="/" aria-label={st.brand_name} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
              {st.brand_name.charAt(0)}
            </Link>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bras, colours…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button type="submit" aria-label="Search" className="text-muted-foreground"><Search className="h-5 w-5" /></button>
          </form>
          <WishlistButton className={round} />
          <button type="button" onClick={() => setOpen(true)} aria-label="Bag" className={round}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{count}</span>
            )}
          </button>
        </div>
        {cats.length > 0 && (
          <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 pb-2 text-sm">
            <DropdownMenu>
              <DropdownMenuTrigger className="shrink-0 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground">Shop ▾</DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {cats.map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => navigate({ to: "/", search: { cat: c.id }, hash: "shop" })}>{c.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {cats.map((c) => (
              <Link key={c.id} to="/" search={{ cat: c.id }} hash="shop" className="shrink-0 rounded-full px-3 py-1 hover:bg-card">{c.label}</Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
