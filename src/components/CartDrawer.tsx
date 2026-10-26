import { useState } from "react";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { rupees, upiLink, useCart } from "@/lib/cart";
import { placeOrder, settingsQuery } from "@/lib/store.functions";
import { SafeImg } from "./SafeImg";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().trim().min(2, "Name likhiye").max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "10 digit mobile number likhiye"),
  address: z.string().trim().min(10, "Pura address likhiye").max(300),
  pincode: z.string().trim().regex(/^\d{6}$/, "6 digit pincode likhiye"),
});
type Form = z.infer<typeof schema>;

export function CartDrawer() {
  const { items, open, setOpen, setQty, total, clear, step, setStep } = useCart();
  const { data: st } = useSuspenseQuery(settingsQuery);
  const save = useServerFn(placeOrder);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<{ link: string; total: number; code: string } | null>(null);
  const [form, setForm] = useState<Form>({ name: "", phone: "", address: "", pincode: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  const pay = async () => {
    const r = schema.safeParse(form);
    if (!r.success) {
      const e: Partial<Record<keyof Form, string>> = {};
      for (const i of r.error.issues) e[i.path[0] as keyof Form] = i.message;
      setErrors(e);
      return;
    }
    setErrors({});
    const d = r.data;
    setBusy(true);
    let order: { id: string; total: number };
    try {
      // Save the order first, then open the customer's UPI app.
      order = await save({ data: { ...d, items: items.map((i) => ({ id: i.id, qty: i.qty, color: i.color, size: i.size })) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Order save nahi hua, dobara try karein");
      setBusy(false);
      return;
    }
    setBusy(false);
    const link = upiLink(order.total, `Order ${order.id.slice(0, 8)} ${d.phone}`, st.upi_id, st.upi_name || st.brand_name);
    setPaid({ link, total: order.total, code: order.id.slice(0, 8) });
    clear();
    setStep("bag");
    setOpen(false);
    // Phones open the UPI app directly; computers scan the QR code instead.
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) window.location.href = link;
  };

  const field = (k: keyof Form, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {k === "address" ? (
        <Textarea value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={3} />
      ) : (
        <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...props} />
      )}
      {errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <>
    <Dialog open={!!paid} onOpenChange={(o) => !o && setPaid(null)}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader><DialogTitle className="font-display">Order mil gaya! Ab {paid && rupees(paid.total)} pay karein</DialogTitle></DialogHeader>
        {paid && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg bg-card p-3"><QRCodeSVG value={paid.link} size={200} /></div>
            <p className="text-sm text-muted-foreground">Mobile ke GPay / PhonePe / Paytm se yeh QR scan karein</p>
            <Button asChild className="w-full"><a href={paid.link}>UPI app kholein</a></Button>
            <p className="text-xs text-muted-foreground">Order code: <b>{paid.code}</b> — isse "Order track karein" page par status dekhein</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setStep("bag"); }}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            {step === "details" && (
              <button type="button" aria-label="Back" onClick={() => setStep("bag")} className="grid h-9 w-9 place-items-center rounded-full border bg-card shadow-sm transition hover:-translate-x-0.5 hover:border-primary hover:text-primary"><ArrowLeft className="h-4 w-4" /></button>
            )}
            {step === "bag" ? "My Bag" : "Delivery Details"}
          </SheetTitle>
        </SheetHeader>
        {step === "bag" ? (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto py-4">
              {items.length === 0 && <p className="py-16 text-center text-muted-foreground">Your bag is empty</p>}
              {items.map((i) => (
                <div key={i.key} className="flex gap-3">
                  <SafeImg src={i.image} className="h-24 w-20 rounded-md object-cover" />
                  <div className="flex-1 text-sm">
                    <p className="line-clamp-2 font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{[i.color, i.size && `Size ${i.size}`].filter(Boolean).join(" · ")}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" aria-label="Less" onClick={() => setQty(i.key, i.qty - 1)} className="rounded border p-1"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center">{i.qty}</span>
                      <button type="button" aria-label="More" onClick={() => setQty(i.key, i.qty + 1)} className="rounded border p-1"><Plus className="h-3 w-3" /></button>
                      <span className="ml-auto font-semibold">{rupees(i.price * i.qty)}</span>
                      <button type="button" aria-label="Remove" onClick={() => setQty(i.key, 0)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {items.length > 0 && (
              <div className="border-t pt-4">
                <div className="mb-3 flex justify-between text-base font-semibold"><span>Total</span><span>{rupees(total)}</span></div>
                <Button className="w-full" size="lg" onClick={() => setStep("details")}>Buy Now</Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {field("name", "Full name", { autoComplete: "name" })}
              {field("phone", "Mobile number", { inputMode: "numeric", maxLength: 10, autoComplete: "tel" })}
              {field("address", "Address (house, street, city)")}
              {field("pincode", "Pincode", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
            </div>
            <div className="border-t pt-4">
              <div className="mb-1 flex justify-between text-base font-semibold"><span>To pay</span><span>{rupees(total)}</span></div>
              <p className="mb-3 text-xs text-muted-foreground">GPay, PhonePe, Paytm ya kisi bhi UPI app se pay karein · UPI: {st.upi_id}</p>
              <Button className="w-full" size="lg" onClick={pay} disabled={busy}>{busy ? "Saving order…" : <>Pay {rupees(total)} with UPI</>}</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}
