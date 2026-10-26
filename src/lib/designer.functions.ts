import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DESIGN_COLORS, colorsFor, sellPrice, sizesFor } from "./designer";
import { STORE_BRAND } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Only the store admin can do this");
}

const GW = "https://ai.gateway.lovable.dev/v1";

export type Design = {
  name: string; cut: string; fabric: string; description: string; highlights: string[];
  mrp: number; discount: number; colors: string[]; photo_prompt: string;
};

function aiError(status: number, body: string): Error {
  if (status === 402) return new Error("AI credits are used up — add credits in your workspace to keep designing.");
  if (status === 429) return new Error("AI is busy — wait a minute and press again.");
  let msg = "";
  try { msg = JSON.parse(body)?.error?.message ?? ""; } catch { /* plain */ }
  return new Error(msg || `AI failed (${status})`);
}

/** Step 1: the AI invents `count` unique designs (text only) for a category and style. */
export const designIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { category: string; style: string; count: number }) => ({
    category: String(i.category || "bra"), style: String(i.style || "Mix of all styles").slice(0, 80), count: Math.max(1, Math.min(25, Math.floor(i.count || 25))),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not set up");
    const str = { type: "string" };
    const schema = {
      type: "object", additionalProperties: false, required: ["designs"],
      properties: { designs: { type: "array", items: { type: "object", additionalProperties: false,
        required: ["name", "cut", "fabric", "description", "highlights", "mrp", "discount", "colors", "photo_prompt"],
        properties: { name: str, cut: str, fabric: str, description: str, highlights: { type: "array", items: str },
          mrp: { type: "integer" }, discount: { type: "integer" }, colors: { type: "array", items: str }, photo_prompt: str } } } },
    };
    const prompt = `You are an innerwear designer for an Indian online store. Designs must be the kind that sell in India (Zivame, Clovia, Jockey, Enamor style) — include popular classic styles already in the Indian market as well as fresh ones. Invent ${data.count} completely different, original product designs.
Category: ${data.category === "teen" ? "teen & beginner innerwear (starter/training bras, cotton slips, camisoles, full-coverage cotton panties — modest, comfortable, non-padded or lightly padded, no lace or sexy styling)" : data.category}. Style direction: ${data.style}.
Every design must differ in cut, neckline/coverage, fabric, pattern, trims and details — no two alike, no brand names.
- name: catchy product name (3-7 words, no brand).
- cut: e.g. Balconette, Plunge, Bralette, Demi-cup, Hipster, Bikini, High-waist, Babydoll, Slip, Bodysuit.
- fabric: realistic composition.
- description: 2-3 sentences. highlights: 4 short bullet features.
- mrp: INR between 699 and 3499. discount: 20-60.
- colors: 4-6 names chosen ONLY from: ${DESIGN_COLORS.map((c) => c.name).join(", ")}.
- photo_prompt: one sentence describing the garment itself (shape, fabric, lace/pattern, trims) in the first colour, for a studio product photo.`;
    const res = await fetch(`${GW}/responses`, {
      method: "POST",
      headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", input: [{ role: "user", content: prompt }], reasoning: { effort: "low" }, store: false, stream: true,
        text: { format: { type: "json_schema", name: "designs", strict: true, schema } } }),
    });
    if (!res.ok || !res.body) throw aiError(res.status, await res.text());
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          else if (ev.type === "response.output_text.done" && ev.text) text = ev.text;
          else if (ev.type === "response.failed" || ev.type === "error") throw new Error("AI could not create designs — please try again.");
        } catch (e) { if (e instanceof Error && e.message.startsWith("AI")) throw e; }
      }
    }
    if (!text) throw new Error("AI returned no designs — please try again.");
    return { designs: (JSON.parse(text) as { designs: Design[] }).designs.slice(0, data.count) };
  });

async function gwImage(key: string, prompt: string, ref?: Blob): Promise<Uint8Array> {
  let res: Response;
  if (ref) {
    const form = new FormData();
    form.append("model", "openai/gpt-image-2.5-sunburst");
    form.append("prompt", prompt);
    form.append("quality", "low");
    form.append("size", "1024x1536");
    form.append("image", ref, "model.png");
    res = await fetch(`${GW}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  } else {
    res = await fetch(`${GW}/images/generations`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", quality: "low", size: "1024x1536", prompt }),
    });
  }
  if (!res.ok) throw aiError(res.status, await res.text());
  const j = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI made no photo for this design");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Step 2: make a product photo + an all-colours photo for one design and save it with every size and 4–6 colours. */
export const createDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { category: string; design: Design; seed: number}) => ({
    category: String(i.category || "bra"), design: i.design, seed: Number(i.seed) || 0,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not set up");
    const d = data.design;
    const colors = colorsFor(d.colors ?? [], data.seed);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const garment = `${d.cut} ${data.category === "teen" ? "teen beginner innerwear" : "innerwear"} in ${colors[0]!.name}: ${d.photo_prompt}`;
    const mainPrompt = `Professional Indian e-commerce product photo of ${garment}. ${data.category === "teen" ? "Neatly laid flat on a soft pastel background" : "Shown on a headless dress form"}, full garment visible, soft studio lighting, sharp fabric detail, no person, no text, no logo.`;
    const linePrompt = `Professional e-commerce photo of the same ${d.cut} design shown in ${colors.length} colours side by side (${colors.map((c) => c.name).join(", ")}): ${d.photo_prompt}. Laid flat in a neat row on a clean light background, every colour fully visible, no person, no text, no logo.`;
    const [main, line] = await Promise.all([gwImage(key, mainPrompt), gwImage(key, linePrompt)]);
    const save = async (bytes: Uint8Array) => {
      const path = `${data.category}/${crypto.randomUUID()}.png`;
      const up = await supabaseAdmin.storage.from("ai-designs").upload(path, bytes, { contentType: "image/png" });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabaseAdmin.storage.from("ai-designs").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (!signed.data?.signedUrl) throw new Error("Could not save the photo");
      return { path, url: signed.data.signedUrl };
    };
    const [a, b] = await Promise.all([save(main), save(line)]);
    const imgs = [a.url, b.url];
    const mrp = Math.max(299, Math.round(d.mrp || 1299));
    const { error } = await context.supabase.from("products").insert({
      name: d.name, brand: STORE_BRAND, category: data.category, price: sellPrice(mrp, d.discount), old_price: mrp,
      description: d.description, highlights: d.highlights ?? [], specs: { Fabric: d.fabric, Style: d.cut, "Wash care": "Hand wash cold, dry in shade" },
      sizes: sizesFor(data.category), colors: colors.map((c) => ({ ...c, images: imgs })), images: imgs,
      source_url: `ai-design:${a.path}`, featured: true, badge: "New",
    });
    if (error) throw new Error(error.message);
    return { name: d.name, image: a.url };
  });
