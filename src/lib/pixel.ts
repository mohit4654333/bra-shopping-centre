type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[] };

export function track(event: string, params: Record<string, unknown> = {}, eventID?: string) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (!fbq) return;
  try {
    fbq("track", event, { currency: "INR", ...params }, { eventID: eventID ?? `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  } catch { /* ignore */ }
}
