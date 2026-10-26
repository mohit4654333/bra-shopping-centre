import { useState, type ImgHTMLAttributes } from "react";
import { imgSrc } from "@/lib/img";
import { cn } from "@/lib/utils";

/** Image through the relay. Missing src shows a quiet skeleton; a failed load renders nothing and calls onFail. */
export function SafeImg({ src, className, alt, onFail, ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | undefined; onFail?: ((src: string) => void) | undefined }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src) return <div aria-hidden className={cn("animate-pulse bg-muted", className)} />;
  if (failed === src) return null;
  return <img src={imgSrc(src)} alt={alt ?? ""} className={className} onError={() => { setFailed(src); onFail?.(src); }} loading="lazy" {...rest} />;
}
