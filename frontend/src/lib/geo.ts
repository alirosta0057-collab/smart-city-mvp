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
 * Ask ipapi.co (CORS-enabled, no key required for low volume). If ipapi.co
 * is unreachable, tries ip-api.com as a secondary source. Returns `null` on
 * complete failure — callers must handle that instead of falling back to a
 * hard-coded location, so we never show the user a wrong city.
 */
export async function askIpLocation(): Promise<GeoResult | null> {
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
    /* fall through to secondary */
  }

  try {
    const res = await fetch(
      "https://ip-api.com/json/?fields=status,lat,lon,city,country",
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        lat?: number;
        lon?: number;
        city?: string;
        country?: string;
      };
      if (
        data.status === "success" &&
        typeof data.lat === "number" &&
        typeof data.lon === "number"
      ) {
        return {
          lat: data.lat,
          lng: data.lon,
          source: "ip",
          city: data.city ?? null,
          country: data.country ?? null,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
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
  if (ip) {
    cacheWrite(ip);
    return ip;
  }
  throw new Error(
    "Could not determine your location. Please enable location access in your browser and try again.",
  );
}
