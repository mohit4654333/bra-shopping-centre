import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackButton({ label = "Back" }: { label?: string }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-4 text-sm font-semibold shadow-sm transition hover:border-primary hover:shadow-md">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:-translate-x-0.5">
        <ArrowLeft className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}
