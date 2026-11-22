"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Editing";

// Simple line icons, drawn on a 24px grid in the current text colour.
const icons: Record<string, React.ReactNode> = {
  home: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  add: <path d="M12 5v14M5 12h14" />,
  rounds: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  courses: <path d="M7 21V3l10 4-10 4M4 21h12" />,
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  more: (
    <path
      d="M5 12h.01M12 12h.01M19 12h.01"
      strokeWidth={3.2}
      strokeLinecap="round"
    />
  ),
  flag: <path d="M7 21V3l10 4-10 4" />,
};

type Page = { href: string; label: string; icon: string };

// Four tabs, then More for the rest (as in Shankaholics). Honours joins More.
const main: Page[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/rounds", label: "Rounds", icon: "rounds" },
  { href: "/rounds/new", label: "Add round", icon: "add" },
  { href: "/stats", label: "Stats", icon: "stats" },
];
const more: Page[] = [{ href: "/courses", label: "Courses", icon: "courses" }];

function Icon({ name, active }: { name: string; active?: boolean }) {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}

// The site name at the top of every page. On phones the pages are in a tab
// bar fixed to the bottom of the screen (always in view); wider screens have them as
// links at the top. Either way, less-used pages sit under More.
export default function Nav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  // Rounds covers a round's own pages, but not Add round (/rounds/new).
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/rounds"
        ? pathname.startsWith("/rounds") && !pathname.startsWith("/rounds/new")
        : pathname.startsWith(href);
  const moreActive = more.some((p) => isActive(p.href));

  // Close the More menu when the page changes or on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const menu = (
    <ul className="py-1">
      {more.map((p) => {
        const active = isActive(p.href);
        return (
          <li key={p.href}>
            <Link
              href={p.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 px-4 text-base font-medium active:bg-surface ${
                active ? "text-accent" : "text-foreground"
              }`}
            >
              <Icon name={p.icon} active={active} />
              {p.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <nav
        aria-label="Site"
        className="relative mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 pt-4"
      >
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 text-base font-bold tracking-wider text-accent uppercase"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="flag" active />
          </span>
          Ranj&apos;s Golf
        </Link>

        {user && (
        <div className="hidden gap-1 text-sm md:flex">
          {main.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded-md px-3 py-2 font-medium whitespace-nowrap ${
                isActive(l.href) ? "bg-surface text-foreground" : "text-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            aria-expanded={open}
            aria-controls="more-menu"
            onClick={() => setOpen((o) => !o)}
            className={`rounded-md px-3 py-2 font-medium whitespace-nowrap ${
              moreActive || open ? "bg-surface text-foreground" : "text-muted"
            }`}
          >
            More ▾
          </button>
        </div>
        )}
      </nav>

      {open && (
        <>
          {/* Tapping anywhere outside the menu closes it. */}
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/20 md:bg-transparent"
          />
          <div
            id="more-menu"
            className="fixed inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-xl border border-line bg-card shadow-xl md:absolute md:inset-x-auto md:top-16 md:right-[max(1rem,calc(50%-21rem+1rem))] md:bottom-auto md:w-56"
          >
            {menu}
          </div>
        </>
      )}

      {/* Phones: tab bar, clear of the iPhone home indicator. */}
      {user && (
      <nav
        aria-label="Pages"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-2xl">
          {main.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium whitespace-nowrap ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon name={l.icon} active={active} />
                {l.label}
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={open}
            aria-controls="more-menu"
            onClick={() => setOpen((o) => !o)}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              moreActive || open ? "text-accent" : "text-muted"
            }`}
          >
            <Icon name="more" active={moreActive || open} />
            More
          </button>
        </div>
      </nav>
      )}
    </>
  );
}
