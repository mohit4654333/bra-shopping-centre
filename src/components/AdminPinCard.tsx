import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPin } from "@/lib/pin.functions";

/** Lets the signed-in admin set or change the 4-digit quick sign-in PIN. */
export function AdminPinCard() {
  const [pin, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await setPin({ data: { pin } }); toast.success("Admin PIN saved"); setVal(""); }
    catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="flex-1 min-w-48">
        <p className="text-sm font-medium">Admin quick PIN</p>
        <p className="text-xs text-muted-foreground">Sign in to admin with just this 4-digit PIN.</p>
      </div>
      <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} placeholder="New PIN" className="w-32 text-center tracking-[0.4em]" value={pin} onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      <Button type="submit" disabled={busy || pin.length !== 4}>{busy ? "Saving…" : "Save PIN"}</Button>
    </form>
  );
}
