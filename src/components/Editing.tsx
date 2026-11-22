"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { configured, supabase } from "@/lib/supabase";

// Shared pieces, as in Shankaholics: form styles, the bottom sheet forms open in,
// and the sign-in. Everything in this app is private, so the whole site sits behind
// <SignedIn>; the sign-in is kept on this phone until you sign out.

export const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-background px-3 text-base";
export const primaryClass =
  "min-h-11 flex-1 rounded-lg bg-accent px-4 text-base font-semibold text-on-accent disabled:opacity-50";
export const secondaryClass =
  "min-h-11 rounded-lg bg-surface px-4 text-base font-medium text-foreground disabled:opacity-50";
export const dangerClass =
  "min-h-11 rounded-lg px-4 text-base font-medium text-down disabled:opacity-50";
export const labelClass = "mb-1 block text-xs font-medium text-muted";
export const cardClass = "rounded-xl border border-line bg-card";

type Auth = { user: User | null; ready: boolean };
const AuthContext = createContext<Auth>({ user: null, ready: false });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth>({ user: null, ready: false });
  useEffect(() => {
    if (!configured) return setAuth({ user: null, ready: true });
    supabase()
      .auth.getSession()
      .then(({ data }) =>
        setAuth({ user: data.session?.user ?? null, ready: true }),
      );
    const { data: sub } = supabase().auth.onAuthStateChange((_e, session) =>
      setAuth({ user: session?.user ?? null, ready: true }),
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// Shows the page only when signed in; otherwise the sign-in form.
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!configured) return <NotSetUp />;
  if (!ready) return null;
  if (!user) return <SignIn />;
  return <>{children}</>;
}

function NotSetUp() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className={`${cardClass} p-4 text-sm`}>
        <h1 className="mb-2 text-lg font-bold">Almost there</h1>
        <p className="text-muted">
          The site doesn&apos;t know which Supabase project to use yet. Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in
          Vercel (Settings → Environment variables), then redeploy.
        </p>
      </div>
    </main>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | string>("idle");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    const { error } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error)
      setState(
        error.message.includes("Invalid login")
          ? "That email and password didn't work."
          : error.message,
      );
  };
  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <form onSubmit={send} className={`${cardClass} space-y-3 p-4`}>
        <h1 className="text-lg font-bold">Sign in</h1>
        <p className="text-sm text-muted">
          Your rounds are private: sign in to see them.
        </p>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {state !== "idle" && state !== "busy" && (
          <p role="alert" className="text-sm text-down">
            {state}
          </p>
        )}
        <div className="flex">
          <button
            type="submit"
            disabled={state === "busy"}
            className={primaryClass}
          >
            {state === "busy" ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}

export function SignOut() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <p className="mt-8 text-center text-xs text-muted">
      Signed in as {user.email} ·{" "}
      <button
        type="button"
        className="min-h-11 font-medium underline"
        onClick={() => supabase().auth.signOut()}
      >
        Sign out
      </button>
    </p>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-left text-base text-foreground shadow-xl sm:rounded-2xl"
      >
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// A labelled dropdown in the house style.
export function Dropdown<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={inputClass}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PageTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{children}</h1>
      {action}
    </div>
  );
}

export function Problem({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-down">
      {children}
    </p>
  );
}
