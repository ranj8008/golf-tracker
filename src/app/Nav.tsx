"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/Editing";

// Simple line icons, drawn on a 24px grid in the current text colour.
const icons: Record<string, React.ReactNode> = {
  home: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  add: <path d="M12 5v14M5 12h14" />,
  rounds: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  courses: <path d="M7 21V3l10 4-10 4M4 21h12" />,
  flag: <path d="M7 21V3l10 4-10 4" />,
};

type Page = { href: string; label: string; icon: string };

// Stats and Honours join these as they're built.
const main: Page[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/rounds", label: "Rounds", icon: "rounds" },
  { href: "/rounds/new", label: "Add round", icon: "add" },
  { href: "/courses", label: "Courses", icon: "courses" },
];

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

// The site name at the top of every page. On phones the pages are in a tab bar fixed
// to the bottom of the screen; wider screens have them as links at the top.
export default function Nav() {
  const pathname = usePathname();
  const { user } = useAuth();
  // Rounds covers a round's own pages, but not Add round (/rounds/new).
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/rounds"
        ? pathname.startsWith("/rounds") && !pathname.startsWith("/rounds/new")
        : pathname.startsWith(href);

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
          </div>
        )}
      </nav>

      {/* Phones: tab bar, clear of the iPhone home indicator. */}
      {user && (
        <nav
          aria-label="Pages"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
          </div>
        </nav>
      )}
    </>
  );
}
