"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-cream hover:bg-navy/90 shadow-soft",
  secondary: "bg-paper text-navy border border-line hover:border-navy/25 hover:bg-white shadow-soft",
  ghost: "text-navy-soft hover:text-navy hover:bg-cream-deep",
  danger: "bg-paper text-rose-deep border border-rose hover:bg-rose/40",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lavender/70";

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; loading?: boolean }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-3xl border border-line/80 bg-paper shadow-soft ${className}`} {...props} />;
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const tones = {
  neutral: "bg-cream-deep text-navy-soft",
  sage: "bg-sage text-sage-deep",
  lavender: "bg-lavender text-lavender-deep",
  peach: "bg-peach text-peach-deep",
  sky: "bg-sky text-sky-deep",
  rose: "bg-rose text-rose-deep",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function statusTone(label: string): keyof typeof tones {
  switch (label) {
    case "Approved":
    case "complete":
      return "sage";
    case "Generating":
    case "Planning":
    case "generating":
    case "queued":
      return "sky";
    case "Needs attention":
    case "failed":
      return "rose";
    case "In review":
      return "lavender";
    case "Plan ready":
      return "peach";
    default:
      return "neutral";
  }
}

export function ErrorNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div role="alert" className={`rounded-2xl border border-rose bg-rose/30 px-4 py-3 text-sm text-rose-deep ${className}`}>
      {children}
    </div>
  );
}

export function Notice({ children, tone = "peach", className = "" }: { children: ReactNode; tone?: "peach" | "sky" | "sage"; className?: string }) {
  const map = {
    peach: "border-peach bg-peach/35 text-peach-deep",
    sky: "border-sky bg-sky/40 text-sky-deep",
    sage: "border-sage bg-sage/40 text-sage-deep",
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${map[tone]} ${className}`}>{children}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-full bg-lavender/60">
        <svg viewBox="0 0 24 24" className="size-6 text-lavender-deep" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 21c-4-3-7-6.2-7-10a7 7 0 0 1 14 0c0 3.8-3 7-7 10Z" />
          <path d="M12 7v6M9 10h6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-xl text-navy">{title}</h3>
      {children && <p className="mt-2 max-w-md text-sm leading-relaxed text-navy-soft">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-mist">{eyebrow}</div>}
        <h1 className="text-3xl text-navy sm:text-4xl">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-navy-soft">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/30 p-4 backdrop-blur-sm sm:p-8" onMouseDown={onClose}>
      <div
        className={`relative w-full ${wide ? "max-w-6xl" : "max-w-lg"} rounded-3xl border border-line bg-paper p-6 shadow-lift`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-mist hover:bg-cream-deep hover:text-navy" aria-label="Close">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
