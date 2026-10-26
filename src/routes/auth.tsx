import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pinLogin, pinStatus, setupPin } from "@/lib/pin.functions";

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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPinVal] = useState("");
  const [status, setStatus] = useState<{ hasPin: boolean; hasAdmin: boolean } | null>(null);
  useEffect(() => { pinStatus().then(setStatus).catch(() => setStatus({ hasPin: true, hasAdmin: true })); }, []);

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
  const pinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // status can still be loading when the form is submitted — resolve it here so
      // an existing admin never hits the first-time setup path by accident.
      const st = status ?? await pinStatus().catch(() => ({ hasPin: true, hasAdmin: true }));
      const fn = st.hasPin ? pinLogin : setupPin;
      const { token_hash } = await fn({ data: { pin } });
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
      if (error) throw error;
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setPinVal("");
    } finally { setBusy(false); }
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
      <p className="mt-2 text-center text-sm text-muted-foreground">The first account created becomes the store admin. You stay signed in on this device until you press Sign out.</p>
      {(!status || status.hasPin || !status.hasAdmin) && (
        <form onSubmit={pinSubmit} className="mt-8 space-y-3 rounded-lg border p-4">
          <p className="text-center text-sm font-medium">{(status?.hasPin ?? true) ? "Enter your 4-digit admin PIN" : "First time? Create a 4-digit admin PIN"}</p>
          <Input type="password" inputMode="numeric" autoComplete="off" pattern="\d{4}" maxLength={4} required placeholder="••••" className="text-center text-2xl tracking-[0.5em]" value={pin} onChange={(e) => setPinVal(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          <Button type="submit" className="w-full" disabled={busy || pin.length !== 4}>{busy ? "Please wait…" : (status?.hasPin ?? true) ? "Unlock admin" : "Create PIN & open admin"}</Button>
        </form>
      )}
      <Button variant="outline" className="mt-8 w-full" onClick={google}>Continue with Google</Button>
      <div className="my-4 text-center text-xs text-muted-foreground">or</div>
      {/* name + autocomplete let the browser offer to save and auto-fill the admin's own login — nothing is pre-filled by the app. */}
      <form onSubmit={submit} className="space-y-3" method="post" action="#">
        <Input type="email" name="email" autoComplete={mode === "in" ? "username" : "email"} required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" name="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
      </form>
      <button type="button" className="mt-4 w-full text-center text-sm text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
