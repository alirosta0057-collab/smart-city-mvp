"use client";

export interface GeoResult {
  lat: number;
  lng: number;
  source: "browser" | "ip";
  city?: string | null;
  country?: string | null;
  /** ISO 3166-1 alpha-2 country code, e.g. "TR" / "IR" / "US". Only set
   *  when at least one geolocation source (typically IP) provided it. */
  country_code?: string | null;
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
        country_code?: string;
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
          country_code: data.country_code?.toUpperCase() ?? null,
        };
      }
    }
  } catch {
    /* fall through to secondary */
  }

  try {
    const res = await fetch(
      "https://ip-api.com/json/?fields=status,lat,lon,city,country,countryCode",
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        lat?: number;
        lon?: number;
        city?: string;
        country?: string;
        countryCode?: string;
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
          country_code: data.countryCode?.toUpperCase() ?? null,
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
 *
 * When browser GPS succeeds we still issue an IP lookup in the background to
 * enrich the result with country/city metadata (the browser Geolocation API
 * returns only raw coordinates, no country name). That lets downstream code
 * auto-select a UI language based on the user's country.
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

  // Fire the IP lookup concurrently with the (potentially slow) browser
  // permission prompt. We await it lazily so we don't delay the happy path.
  const ipPromise = askIpLocation().catch(() => null);

  if (allowBrowser) {
    const b = await askBrowserLocation();
    if (b) {
      const ip = await ipPromise;
      const merged: GeoResult = {
        ...b,
        city: ip?.city ?? b.city ?? null,
        country: ip?.country ?? b.country ?? null,
        country_code: ip?.country_code ?? b.country_code ?? null,
      };
      cacheWrite(merged);
      return merged;
    }
  }
  const ip = await ipPromise;
  if (ip) {
    cacheWrite(ip);
    return ip;
  }
  throw new Error(
    "Could not determine your location. Please enable location access in your browser and try again.",
  );
}
