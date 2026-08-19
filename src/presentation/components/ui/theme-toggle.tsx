"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "ankur.theme.v1";

export type ThemeChoice = "light" | "dark";

export function readStoredTheme(): ThemeChoice | undefined {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : undefined;
  } catch {
    return undefined;
  }
}

function systemTheme(): ThemeChoice {
  // `matchMedia` is absent in the component test environment, so appearance
  // resolution must never be the reason a screen fails to render.
  const query = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;
  return query?.matches === true ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice | undefined>(undefined);

  useEffect(() => {
    setTheme(readStoredTheme() ?? systemTheme());
  }, []);

  function choose(next: ThemeChoice) {
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // A blocked storage quota must never break appearance switching.
    }
  }

  // Rendered inert until the client resolves the active theme so the server and
  // first client paint agree.
  const resolved = theme ?? "light";
  const next: ThemeChoice = resolved === "dark" ? "light" : "dark";
  return (
    <button
      aria-label={`Switch to ${next} appearance`}
      className="theme-toggle"
      onClick={() => choose(next)}
      title={`Switch to ${next} appearance`}
      type="button"
    >
      <span aria-hidden="true" className="theme-toggle__icons">
        <Sun size={15} strokeWidth={2} />
        <Moon size={15} strokeWidth={2} />
      </span>
      <span className="visually-hidden">{`Current appearance: ${resolved}`}</span>
    </button>
  );
}
