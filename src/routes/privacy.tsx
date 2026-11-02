import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/store.functions";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy – Bra Shopping Centre" },
      { name: "description", content: "Bra Shopping Centre aapki personal jaankari kaise collect, use aur surakshit rakhta hai." },
      { property: "og:title", content: "Privacy Policy – Bra Shopping Centre" },
      { property: "og:description", content: "Aapka naam, phone aur address sirf order delivery ke liye use hota hai — kabhi becha nahi jaata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  const { data: st } = useSuspenseQuery(settingsQuery);
  const sections = [
    { t: "1. Hum kya jaankari lete hain", b: "Order ke time aapka naam, phone number, delivery address aur email (agar diya ho). Website use karte waqt basic device jaankari (browser, page visit) bhi aa sakti hai." },
    { t: "2. Jaankari ka use", b: "Sirf aapka order process, deliver aur track karne ke liye, order se jude sawaalon ka jawab dene ke liye, aur website ko behtar banane ke liye." },
    { t: "3. Payment", b: "Payment UPI app ke through hota hai. Hum aapka UPI PIN, card ya bank details kabhi save nahi karte." },
    { t: "4. Jaankari share karna", b: "Aapki jaankari kisi ko bechi nahi jaati. Sirf delivery partner ko utni jaankari di jaati hai jitni parcel pahunchane ke liye zaroori ho." },
    { t: "5. Discreet & surakshit", b: "Saare orders plain packaging me jaate hain. Aapka data secure server par locked rehta hai aur sirf store owner dekh sakta hai." },
    { t: "6. Cookies", b: "Cart, wishlist aur music setting yaad rakhne ke liye aapke phone/browser me chhoti si jaankari save hoti hai. Ise aap browser settings se clear kar sakte hain." },
    { t: "7. Aapke adhikar", b: "Aap kabhi bhi apni jaankari dekhne, badalne ya delete karwane ke liye live chat par humse sampark kar sakte hain." },
    { t: "8. Badlav", b: "Is policy me badlav hone par naya version isi page par update kiya jayega." },
  ];
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">{st.brand_name} aapki privacy ka poora dhyan rakhta hai.</p>
      <div className="mt-6 space-y-4">
        {sections.map((s) => (
          <section key={s.t} className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">{s.t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.b}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
