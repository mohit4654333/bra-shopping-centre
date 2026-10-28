import { useEffect, type RefObject } from "react";

/** Gently scrolls a scroll-snap row forward every `ms`, looping; pauses while touched or off-screen. */
export function useAutoSlide(ref: RefObject<HTMLElement | null>, ms = 3500, full = false) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let hold = false;
    let visible = true;
    const stop = () => { hold = true; };
    const go = () => { hold = false; };
    el.addEventListener("pointerdown", stop);
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("pointerup", go);
    el.addEventListener("touchend", go);
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    io.observe(el);
    const id = window.setInterval(() => {
      if (hold || !visible || document.hidden) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      const first = el.firstElementChild as HTMLElement | null;
      const step = full ? el.clientWidth : (first?.offsetWidth ?? 160) + 12;
      const next = el.scrollLeft + step >= max + 4 ? 0 : el.scrollLeft + step;
      el.scrollTo({ left: next, behavior: "smooth" });
    }, ms);
    return () => {
      window.clearInterval(id);
      io.disconnect();
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("pointerup", go);
      el.removeEventListener("touchend", go);
    };
  }, [ref, ms, full]);
}
