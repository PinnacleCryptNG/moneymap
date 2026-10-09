import { Monitor, Moon, Sun } from "../icons";
import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "moneymap:theme";

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Light or dark follows the device unless the person picks one; the choice is remembered on this device. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  const dark = choice === "dark" || (choice === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#050c19" : "#071226");
}

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeChoice, string> = { system: "Theme: matches your device", light: "Theme: light", dark: "Theme: dark" };

export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  useEffect(() => {
    applyTheme(choice);
    try {
      if (choice === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      /* remembering is a convenience only */
    }
  }, [choice]);
  const Icon = choice === "dark" ? Moon : choice === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => setChoice(NEXT[choice])}
      aria-label={`${LABEL[choice]}. Change theme`}
      title={LABEL[choice]}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${onDark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-2 hover:bg-ink/[.06]"}`}
    >
      <Icon size={19} aria-hidden />
    </button>
  );
}
