"use client";

export interface GeoResult {
  lat: number;
  lng: number;
  source: "browser" | "ip";
  city?: string | null;
  country?: string | null;
}

const GEO_CACHE_KEY = "sc_geo";

function cacheRead(): GeoResult | null {
  try {
    const raw = window.localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoResult & { ts: number };
    if (Date.now() - parsed.ts > 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cacheWrite(g: GeoResult) {
  try {
    window.localStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({ ...g, ts: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

/** Ask the browser; timeout after 6s; resolves null on denial or timeout. */
export function askBrowserLocation(timeoutMs = 6000): Promise<GeoResult | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "browser",
        });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 300000 },
    );
  });
}

/**
 * Ask ipapi.co (CORS-enabled, no key required for low volume).
 * Falls back to Tehran if the service is unreachable, so the demo still works
 * offline / behind restrictive networks.
 */
export async function askIpLocation(): Promise<GeoResult> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        latitude?: number;
        longitude?: number;
        city?: string;
        country_name?: string;
      };
      if (
        typeof data.latitude === "number" &&
        typeof data.longitude === "number"
      ) {
        return {
          lat: data.latitude,
          lng: data.longitude,
          source: "ip",
          city: data.city ?? null,
          country: data.country_name ?? null,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    lat: 35.6892,
    lng: 51.389,
    source: "ip",
    city: "Tehran",
    country: "Iran",
  };
}

/**
 * Best-effort location: cached → browser → ip. `preferFresh` skips cache.
 */
export async function resolveLocation(opts?: {
  preferFresh?: boolean;
  allowBrowser?: boolean;
}): Promise<GeoResult> {
  const preferFresh = opts?.preferFresh ?? false;
  const allowBrowser = opts?.allowBrowser ?? true;
  if (!preferFresh) {
    const cached = cacheRead();
    if (cached) return cached;
  }
  if (allowBrowser) {
    const b = await askBrowserLocation();
    if (b) {
      cacheWrite(b);
      return b;
    }
  }
  const ip = await askIpLocation();
  cacheWrite(ip);
  return ip;
}
