import { SocialProofToast } from "@/components/SocialProofToast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { CartDrawer } from "@/components/CartDrawer";
import { Toaster } from "@/components/ui/sonner";
import { useSuspenseQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/store.functions";
import { themeCss } from "@/lib/themes";
import { ChatWidget } from "@/components/ChatWidget";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Go home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try again</button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Glamour Boutique – Premium Ladies Innerwear" },
      { name: "description", content: "Shop bras, panties, nightwear and lingerie sets in every colour at Glamour Boutique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fredoka:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <StoreChrome />
      </CartProvider>
    </QueryClientProvider>
  );
}

function StoreChrome() {
  const { data: st } = useSuspenseQuery(settingsQuery);
  return (
    <>
        <style>{themeCss(st.theme)}</style>
        {st.show_bg && st.bg_image && (
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url("${st.bg_image}")`, opacity: Math.min(40, Math.max(2, st.bg_opacity)) / 100 }} />
        )}
        <SiteHeader />
        <div className="relative z-10"><Outlet /></div>
        <CartDrawer />
        {st.live_chat && <ChatWidget brand={st.brand_name} />}
        {st.social_proof_enabled && <SocialProofToast />}
        <Toaster richColors position="top-center" />
        <footer className="mt-16 border-t py-8 text-center text-xs text-muted-foreground">
          © {st.brand_name}
          <div className="mt-2 flex flex-wrap justify-center gap-4"><Link to="/track" className="underline hover:text-foreground">Order track karein</Link><Link to="/policies" className="underline hover:text-foreground">Packaging, Exchange & Contact</Link></div>
          <div className="mt-2"><Link to="/admin" className="underline hover:text-foreground">Store Admin</Link></div>
        </footer>
    </>
  );
}
