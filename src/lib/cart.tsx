import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  key: string; id: string; name: string; price: number; image: string; color: string; size: string; qty: number;
};

type Cart = {
  items: CartItem[]; open: boolean; setOpen: (v: boolean) => void;
  add: (i: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void; clear: () => void; total: number; count: number;
  step: "bag" | "details"; setStep: (s: "bag" | "details") => void;
};

const Ctx = createContext<Cart | null>(null);
const KEY = "gb_cart_v5";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"bag" | "details">("bag");
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* empty */ }
  }, []);
  const save = (next: CartItem[]) => { setItems(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const value: Cart = {
    items, open, setOpen, step, setStep,
    add: (i, qty = 1) => {
      const key = `${i.id}|${i.color}|${i.size}`;
      const ex = items.find((x) => x.key === key);
      save(ex ? items.map((x) => (x.key === key ? { ...x, qty: x.qty + qty } : x)) : [...items, { ...i, key, qty }]);
      setOpen(true);
    },
    setQty: (key, qty) => save(qty <= 0 ? items.filter((x) => x.key !== key) : items.map((x) => (x.key === key ? { ...x, qty } : x))),
    clear: () => save([]),
    total: items.reduce((s, x) => s + x.price * x.qty, 0),
    count: items.reduce((s, x) => s + x.qty, 0),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("CartProvider missing");
  return c;
}

export const STORE_UPI = "paytmqr5fd3tr@ptys";
export const STORE_UPI_NAME = "Glamour Boutique";

export const upiLink = (amount: number, note: string, upi = STORE_UPI, name = STORE_UPI_NAME) =>
  `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note.slice(0, 50))}`;

export const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
