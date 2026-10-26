export const ORDER_STATUSES = ["pending", "dispatched", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderLine = { id: string; name: string; color: string; size: string; qty: number; price: number };

/** Total uses store prices (not what the browser sent); unknown products are dropped. */
export function computeOrder(lines: { id: string; qty: number; color: string; size: string }[], prices: Record<string, { name: string; price: number }>) {
  const items: OrderLine[] = [];
  for (const l of lines) {
    const p = prices[l.id];
    const qty = Math.max(1, Math.min(50, Math.floor(l.qty)));
    if (!p) continue;
    items.push({ id: l.id, name: p.name, color: l.color, size: l.size, qty, price: p.price });
  }
  return { items, total: items.reduce((s, i) => s + i.price * i.qty, 0) };
}

export function orderStats(orders: { total: number; status: string }[]) {
  const live = orders.filter((o) => o.status !== "cancelled");
  return {
    totalOrders: orders.length,
    revenue: live.reduce((s, o) => s + Number(o.total), 0),
    pending: orders.filter((o) => o.status === "pending" || o.status === "dispatched").length,
  };
}
