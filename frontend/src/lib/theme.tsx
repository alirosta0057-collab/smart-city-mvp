"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type Dir = "ltr" | "rtl";
type Locale = "en" | "fa";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: Dir;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme, locale: Locale) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? readSystem() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [locale, setLocaleState] = React.useState<Locale>("en");
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const t =
      (typeof window !== "undefined" &&
        (window.localStorage.getItem("sc_theme") as Theme | null)) ||
      "system";
    const l =
      (typeof window !== "undefined" &&
        (window.localStorage.getItem("sc_locale") as Locale | null)) ||
      "en";
    setThemeState(t);
    setLocaleState(l);
    applyTheme(t, l);
    setResolved(t === "system" ? readSystem() : t);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") {
        applyTheme("system", l);
        setResolved(readSystem());
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = React.useCallback(
    (t: Theme) => {
      setThemeState(t);
      window.localStorage.setItem("sc_theme", t);
      applyTheme(t, locale);
      setResolved(t === "system" ? readSystem() : t);
    },
    [locale],
  );

  const setLocale = React.useCallback(
    (l: Locale) => {
      setLocaleState(l);
      window.localStorage.setItem("sc_locale", l);
      applyTheme(theme, l);
    },
    [theme],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolved,
      setTheme,
      locale,
      setLocale,
      dir: locale === "fa" ? "rtl" : "ltr",
    }),
    [theme, resolved, setTheme, locale, setLocale],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
