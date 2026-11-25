"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let storedTheme: string | null = null;
    try { storedTheme = window.localStorage.getItem("theme"); }
    catch { /* Storage can be disabled; keep the page and game usable. */ }
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const nextTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : preferredTheme;
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem("theme", nextTheme); }
    catch { /* Apply the theme for this visit even when it cannot be saved. */ }
    setTheme(nextTheme);
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "切换到浅色模式" : "切换到深色模式";

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={label} title={label}>
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
    </button>
  );
}
