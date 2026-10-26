import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Package, RefreshCw, MessageCircle } from "lucide-react";
import { settingsQuery } from "@/lib/store.functions";

export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Discreet Packaging, Exchange & Contact – Glamour Boutique" },
      { name: "description", content: "Plain box mein discreet delivery, 5 din mein easy size exchange, aur hamse sampark kaise karein." },
      { property: "og:title", content: "Packaging, Exchange & Contact – Glamour Boutique" },
      { property: "og:description", content: "Discreet packaging, easy size exchange aur customer support ki jaankari." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Policies,
});

function Policies() {
  const { data: st } = useSuspenseQuery(settingsQuery);
  const blocks = [
    { icon: Package, title: "100% Discreet Packaging", body: "Har order plain box mein jaata hai. Bahar koi product naam ya lingerie label nahi hota — sirf aapka naam aur address." },
    { icon: RefreshCw, title: "5 din mein Easy Size Exchange", body: "Size theek na aaye to delivery ke 5 din ke andar exchange karein. Product unused ho aur tags lage hon. Hygiene ke liye panties exchange nahi hoti." },
    { icon: MessageCircle, title: "Contact & Support", body: "Koi sawaal ho to website ke neeche live chat button dabaiye, ya apne order code ke saath humein message karein. Hum jaldi jawab dete hain." },
  ];
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl">{st.brand_name} ka vaada</h1>
      <div className="mt-6 space-y-4">
        {blocks.map((b) => (
          <section key={b.title} className="flex gap-4 rounded-xl border bg-card p-5">
            <b.icon className="h-6 w-6 shrink-0 text-primary" />
            <div><h2 className="font-semibold">{b.title}</h2><p className="mt-1 text-sm text-muted-foreground">{b.body}</p></div>
          </section>
        ))}
      </div>
    </main>
  );
}
