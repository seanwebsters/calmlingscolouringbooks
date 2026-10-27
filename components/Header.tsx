"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Library" },
  { href: "/characters", label: "Characters" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-lavender via-sky to-sage shadow-soft">
            <svg viewBox="0 0 24 24" className="size-4 text-navy" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 20c-3.5-2.4-6-5.2-6-8.6A6 6 0 0 1 12 5.5a6 6 0 0 1 6 5.9c0 3.4-2.5 6.2-6 8.6Z" />
              <path d="M12 9.5v6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="whitespace-nowrap font-serif text-lg tracking-tight text-navy">
            Calmlings <span className="hidden text-navy-soft sm:inline">Book Studio</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm transition sm:px-3.5 ${active ? "bg-paper text-navy shadow-soft" : "text-navy-soft hover:text-navy"}`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link href="/books/new" className="ml-1 whitespace-nowrap rounded-full bg-navy px-3.5 py-1.5 text-sm font-medium text-cream shadow-soft hover:bg-navy/90">
            New<span className="hidden sm:inline"> book</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
