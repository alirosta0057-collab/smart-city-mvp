"use client";

import * as React from "react";
import { localeFromCountry, RTL_LOCALES, type Locale } from "./i18n";
import { askIpLocation } from "./geo";

type Theme = "light" | "dark" | "system";
type Dir = "ltr" | "rtl";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  locale: Locale;
  /** Manual locale switch: also marks the choice as user-pinned so the
   *  auto-detect heuristic won't overwrite it on subsequent loads. */
  setLocale: (l: Locale) => void;
  dir: Dir;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const SUPPORTED_LOCALES: ReadonlySet<Locale> = new Set([
  "en",
  "fa",
  "tr",
  "ar",
]);

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
  document.documentElement.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("sc_locale");
  if (!stored) return null;
  return SUPPORTED_LOCALES.has(stored as Locale) ? (stored as Locale) : null;
}

function hasManualLocale(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("sc_locale_manual") === "1";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [locale, setLocaleState] = React.useState<Locale>("en");
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  // Refs track the live theme/locale so async callbacks (e.g. the IP-based
  // locale auto-detect, or the system dark-mode media listener) don't act on
  // stale closure-captured values and revert a user's in-flight toggle.
  const themeRef = React.useRef<Theme>("light");
  const localeRef = React.useRef<Locale>("en");

  React.useEffect(() => {
    const t =
      (typeof window !== "undefined" &&
        (window.localStorage.getItem("sc_theme") as Theme | null)) ||
      "system";
    const stored = readStoredLocale();
    // Initial locale: use stored value if present; otherwise start English
    // and let the async country detection below upgrade it in-place.
    const initialLocale: Locale = stored ?? "en";
    setThemeState(t);
    setLocaleState(initialLocale);
    themeRef.current = t;
    localeRef.current = initialLocale;
    applyTheme(t, initialLocale);
    setResolved(t === "system" ? readSystem() : t);

    // Auto-detect locale from country code (via IP) unless the user has
    // manually pinned one. We intentionally skip the browser Geolocation
    // API here because it would prompt for permission on every page load —
    // IP lookup is silent and accurate to country level, which is all the
    // language picker needs.
    if (!hasManualLocale()) {
      askIpLocation()
        .then((ip) => {
          if (!ip) return;
          const detected = localeFromCountry(ip.country_code);
          // Only switch if we discovered a non-default locale AND the user
          // hasn't toggled during the async gap.
          if (detected === "en") return;
          if (hasManualLocale()) return;
          setLocaleState(detected);
          localeRef.current = detected;
          window.localStorage.setItem("sc_locale", detected);
          // Use the live theme from the ref so a concurrent theme toggle
          // isn't clobbered by a stale mount-time value.
          applyTheme(themeRef.current, detected);
        })
        .catch(() => {
          /* IP detection best-effort; ignore failures. */
        });
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      // Only the "system" theme follows OS dark-mode changes, and we must
      // read the CURRENT theme/locale from refs so we don't overwrite an
      // explicit user selection that happened after mount.
      if (themeRef.current === "system") {
        applyTheme("system", localeRef.current);
        setResolved(readSystem());
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = React.useCallback(
    (t: Theme) => {
      setThemeState(t);
      themeRef.current = t;
      window.localStorage.setItem("sc_theme", t);
      applyTheme(t, localeRef.current);
      setResolved(t === "system" ? readSystem() : t);
    },
    [],
  );

  const setLocale = React.useCallback(
    (l: Locale) => {
      setLocaleState(l);
      localeRef.current = l;
      window.localStorage.setItem("sc_locale", l);
      // Record that the user hand-picked a locale so the country-based
      // auto-detect on the next page load respects their choice.
      window.localStorage.setItem("sc_locale_manual", "1");
      applyTheme(themeRef.current, l);
    },
    [],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolved,
      setTheme,
      locale,
      setLocale,
      dir: RTL_LOCALES.has(locale) ? "rtl" : "ltr",
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
