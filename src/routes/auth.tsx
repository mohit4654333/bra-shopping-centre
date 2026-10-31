import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in – Glamour Boutique" },
      { name: "description", content: "Sign in to manage the Glamour Boutique store." },
      { property: "og:title", content: "Sign in – Glamour Boutique" },
      { property: "og:description", content: "Store admin sign in." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const mode = "in" as "in" | "up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let done = false;
    const go = () => { if (!done) { done = true; navigate({ to: "/admin", replace: true }); } };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
      else setTimeout(() => setChecking(false), window.location.hash.includes("access_token") ? 3000 : 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (checking) {
    return <div className="py-24 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-3 animate-spin" />Admin khul raha hai…</div>;
  }


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/admin" });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ to: "/admin" });
      else toast.success("Check your email to confirm your account, then sign in.");
    }
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) { toast.error(String(r.error.message ?? r.error)); return; }
    if (r.redirected) return;
    navigate({ to: "/admin" });
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center text-3xl font-semibold">{mode === "in" ? "Admin sign in" : "Create account"}</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">Only the store owner can open admin. Sign in with your Google or email account.</p>
      <Button variant="outline" className="mt-8 w-full" onClick={google}>Continue with Google</Button>
      <div className="my-4 text-center text-xs text-muted-foreground">or</div>
      {/* name + autocomplete let the browser offer to save and auto-fill the admin's own login — nothing is pre-filled by the app. */}
      <form onSubmit={submit} className="space-y-3" method="post" action="#">
        <Input type="email" name="email" autoComplete={mode === "in" ? "username" : "email"} required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" name="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
      </form>
    </main>
  );
}
