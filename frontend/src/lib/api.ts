// When NEXT_PUBLIC_API_URL is empty, the frontend is served by the same
// origin as the API (single-container Fly deploy) and we use relative paths.
// For split deployments set NEXT_PUBLIC_API_URL to the backend's absolute URL.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function defaultWsUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

export function wsBase(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  return defaultWsUrl();
}

export type UserRole = "admin" | "citizen" | "agent";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  lat: number | null;
  lng: number | null;
  city: string | null;
  country: string | null;
  is_online: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
}

export interface Business {
  id: number;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  lat: number;
  lng: number;
  category: Category;
  distance_km: number;
}

export type TicketStatus =
  | "open"
  | "queued"
  | "in_progress"
  | "resolved"
  | "cancelled";
export type TicketPriority = "low" | "normal" | "high" | "sos";

export interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  lat: number | null;
  lng: number | null;
  citizen: User;
  agent: User | null;
  category: Category | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  ticket_id: number;
  sender_kind: "citizen" | "bot" | "agent" | "system";
  sender_name: string;
  sender_user_id: number | null;
  body: string;
  created_at: string;
}

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("sc_token");
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function wsUrl(path: string): string {
  const token = getToken() ?? "";
  const sep = path.includes("?") ? "&" : "?";
  return `${wsBase()}${path}${sep}token=${encodeURIComponent(token)}`;
}
