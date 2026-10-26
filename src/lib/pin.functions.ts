import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pinSchema = z.object({ pin: z.string().regex(/^\d{4}$/) });
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

async function hashPin(pin: string, salt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomHex(n = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function adminDb() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Tells the sign-in page whether a PIN exists, and whether the store has no admin yet (first-time setup). */
export const pinStatus = createServerFn({ method: "GET" }).handler(async () => {
  const db = await adminDb();
  const { data: pin } = await db.from("admin_pin").select("id").eq("id", 1).maybeSingle();
  const { count } = await db.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
  return { hasPin: !!pin, hasAdmin: (count ?? 0) > 0 };
});

/** First-time setup on a fresh store: creates the admin account behind the scenes and saves the PIN. Only works while no admin exists. */
export const setupPin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { count } = await db.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Admin already exists. Sign in with email, then set the PIN in Settings.");
    const email = `admin-${randomHex(6)}@glamour-admin.local`;
    const { data: created, error } = await db.auth.admin.createUser({ email, password: randomHex(24), email_confirm: true });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create admin");
    // The signup trigger makes the first account admin; ensure it in case the trigger is missing.
    await db.from("user_roles").upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    const salt = randomHex();
    await db.from("admin_pin").upsert({ id: 1, user_id: created.user.id, salt, pin_hash: await hashPin(data.pin, salt), fails: 0, locked_until: null });
    return magicToken(db, email);
  });

/** Signed-in admin sets or changes the PIN. */
export const setPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Only the store admin can set the PIN");
    const db = await adminDb();
    const salt = randomHex();
    const { error } = await db.from("admin_pin").upsert({ id: 1, user_id: context.userId, salt, pin_hash: await hashPin(data.pin, salt), fails: 0, locked_until: null, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Verifies the PIN (locks after 5 wrong tries for 15 min) and returns a one-time sign-in token. */
export const pinLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { data: row } = await db.from("admin_pin").select("*").eq("id", 1).maybeSingle();
    if (!row) throw new Error("No PIN set yet");
    if (row.locked_until && new Date(row.locked_until) > new Date()) throw new Error(`Too many wrong tries. Try again after ${LOCK_MINUTES} minutes.`);
    if ((await hashPin(data.pin, row.salt)) !== row.pin_hash) {
      const fails = row.fails + 1;
      await db.from("admin_pin").update(fails >= MAX_FAILS
        ? { fails: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() }
        : { fails }).eq("id", 1);
      throw new Error(fails >= MAX_FAILS ? `Too many wrong tries. Locked for ${LOCK_MINUTES} minutes.` : `Wrong PIN (${MAX_FAILS - fails} tries left)`);
    }
    await db.from("admin_pin").update({ fails: 0, locked_until: null }).eq("id", 1);
    if (!row.user_id) throw new Error("Admin account not found");
    const { data: u, error } = await db.auth.admin.getUserById(row.user_id);
    if (error || !u.user?.email) throw new Error("Admin account not found");
    return magicToken(db, u.user.email);
  });

async function magicToken(db: Awaited<ReturnType<typeof adminDb>>, email: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? "Could not sign in");
  return { token_hash: data.properties.hashed_token };
}
