"use client";

import * as React from "react";
import type {
  MapContainer as MapContainerType,
  TileLayer as TileLayerType,
  Marker as MarkerType,
  Popup as PopupType,
  Circle as CircleType,
} from "react-leaflet";
import type { LatLngExpression, DivIcon as DivIconType } from "leaflet";

type LeafletMod = typeof import("leaflet");
type RLMod = typeof import("react-leaflet");

interface MarkerPoint {
  id: number | string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  icon?: string;
  accent?: "primary" | "success" | "destructive" | "warning";
}

export interface CityMapProps {
  center: LatLngExpression;
  zoom?: number;
  userPoint?: { lat: number; lng: number; label?: string } | null;
  markers?: MarkerPoint[];
  onMarkerClick?: (id: number | string) => void;
  height?: string;
  rounded?: boolean;
}

function pinIcon(L: LeafletMod, accent: string, emoji: string): DivIconType {
  const color = {
    primary: "#2563eb",
    success: "#16a34a",
    destructive: "#dc2626",
    warning: "#d97706",
  }[accent] ?? "#2563eb";

  return L.divIcon({
    className: "sc-pin",
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    html: `
      <div style="position:relative;width:34px;height:44px;">
        <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 0C7.6 0 0 7.5 0 16.7c0 12.1 15.2 25.7 16.2 26.6a1 1 0 0 0 1.6 0C18.8 42.4 34 28.8 34 16.7 34 7.5 26.4 0 17 0Z" fill="${color}"/>
          <circle cx="17" cy="16.5" r="11" fill="#fff"/>
        </svg>
        <div style="position:absolute;top:3px;left:0;right:0;height:28px;display:flex;align-items:center;justify-content:center;font-size:16px;">${emoji}</div>
      </div>`,
  });
}

function userIcon(L: LeafletMod): DivIconType {
  return L.divIcon({
    className: "sc-user-pin",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `
      <div style="position:relative;width:22px;height:22px;">
        <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,0.25);animation:pulse-ring 1.4s ease-out infinite;"></span>
        <span style="position:absolute;inset:3px;border-radius:9999px;background:#2563eb;box-shadow:0 0 0 3px #fff;"></span>
      </div>`,
  });
}

function Inner({
  RL,
  L,
  center,
  zoom,
  userPoint,
  markers,
  onMarkerClick,
  height,
  rounded,
}: CityMapProps & { RL: RLMod; L: LeafletMod }) {
  const { MapContainer, TileLayer, Marker, Popup, Circle } = RL as {
    MapContainer: typeof MapContainerType;
    TileLayer: typeof TileLayerType;
    Marker: typeof MarkerType;
    Popup: typeof PopupType;
    Circle: typeof CircleType;
  };
  return (
    <div
      className={rounded ? "overflow-hidden rounded-xl border" : undefined}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom ?? 13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userPoint ? (
          <>
            <Marker
              position={[userPoint.lat, userPoint.lng]}
              icon={userIcon(L)}
            >
              <Popup>{userPoint.label ?? "You are here"}</Popup>
            </Marker>
            <Circle
              center={[userPoint.lat, userPoint.lng]}
              radius={400}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#3b82f6",
                fillOpacity: 0.08,
                weight: 1,
              }}
            />
          </>
        ) : null}
        {(markers ?? []).map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={pinIcon(L, m.accent ?? "primary", m.icon ?? "📍")}
            eventHandlers={
              onMarkerClick
                ? { click: () => onMarkerClick(m.id) }
                : undefined
            }
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontWeight: 600 }}>{m.title}</div>
                {m.subtitle ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {m.subtitle}
                  </div>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default function CityMap(props: CityMapProps) {
  const [mods, setMods] = React.useState<{ RL: RLMod; L: LeafletMod } | null>(
    null,
  );

  React.useEffect(() => {
    let mounted = true;
    Promise.all([import("react-leaflet"), import("leaflet")]).then(
      ([RL, L]) => {
        if (mounted) setMods({ RL, L: L as unknown as LeafletMod });
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  if (!mods) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border bg-muted/40 text-sm text-muted-foreground"
        style={{ height: props.height ?? "320px" }}
      >
        Loading map…
      </div>
    );
  }

  return <Inner {...props} RL={mods.RL} L={mods.L} />;
}
