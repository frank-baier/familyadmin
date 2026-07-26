'use client';

import { useEffect, useRef, useState } from 'react';
import type { TransportLeg } from '@/lib/travel-transport';
import type { TripKeyInfo } from '@/lib/travel';

// ─── Airport database ─────────────────────────────────────────────────────────

const AIRPORTS: Record<string, [number, number]> = {
  ZRH: [47.4647,   8.5492],
  DOH: [25.2737,  51.6082],
  BNE: [-27.3842, 153.1175],
  CNS: [-16.8858, 145.7544],
  SYD: [-33.9399, 151.1753],
  AUH: [24.4330,  54.6511],
  MEL: [-37.6733, 144.8431],
  PER: [-31.9403, 115.9670],
  ADL: [-34.9455, 138.5310],
  DXB: [25.2532,  55.3657],
  LHR: [51.4775,  -0.4614],
  FRA: [50.0379,   8.5622],
  MUC: [48.3538,  11.7861],
  VIE: [48.1103,  16.5697],
  CDG: [49.0097,   2.5479],
  AMS: [52.3086,   4.7639],
  IST: [41.2753,  28.7519],
  DUS: [51.2895,   6.7668],
  HAM: [53.6304,   9.9882],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractIata(location: string): string | null {
  const m = location.match(/\(([A-Z]{3})\)/);
  return m ? m[1] : null;
}

function parseCoords(location: string): [number, number] | null {
  const iata = extractIata(location);
  if (iata && AIRPORTS[iata]) return AIRPORTS[iata];
  return null;
}

async function geocode(query: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    // silently fail
  }
  return null;
}

const SKIP_LINE_RE = /^(check-in|check-out|buchung|ref:|storno|abholung|rückgabe|arrival|departure|powered site|nacht:|staying|arriving|departing|price|additional|your group)/i;

// Joins all non-noise lines from a key-info value into a rich geocoding query
function buildGeoQuery(label: string, value: string): string {
  const lines = value.split('\n').map(l => l.trim()).filter(l => l && !SKIP_LINE_RE.test(l));
  return lines.length > 0 ? `${label} ${lines.join(', ')}` : label;
}

function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// ─── Map stop types ───────────────────────────────────────────────────────────

interface MapStop {
  label: string;
  coords: [number, number];
  type: 'flight' | 'car' | 'accommodation';
  detail: string;
  googleMapsQuery: string;
}

// ─── Map styles ───────────────────────────────────────────────────────────────

const ICON_SVG: Record<MapStop['type'], string> = {
  flight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
  </svg>`,
  car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
  </svg>`,
  accommodation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>`,
};

const ICON_COLOR: Record<MapStop['type'], string> = {
  flight: '#4f46e5',
  car: '#f97316',
  accommodation: '#10b981',
};

// ─── Inner Leaflet component (never SSR'd) ────────────────────────────────────

interface TripMapInnerProps {
  tripId: string;
  legs: TransportLeg[];
  keyInfos: TripKeyInfo[];
  destination: string;
}

function TripMapInner({ legs, keyInfos, destination }: TripMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !containerRef.current) return;

      // Fix Leaflet default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // ── Collect stops ────────────────────────────────────────────────────

      const stops: MapStop[] = [];

      // 1. Transport legs → flight / car stops
      for (const leg of [...legs].sort((a, b) => a.position - b.position)) {
        const fromCoords = parseCoords(leg.fromLocation);
        const toCoords   = parseCoords(leg.toLocation);

        if (fromCoords) {
          stops.push({
            label: leg.fromLocation,
            coords: fromCoords,
            type: leg.type === 'CAR' ? 'car' : 'flight',
            detail: leg.carrier ? `${leg.carrier}${leg.flightNumber ? ' ' + leg.flightNumber : ''}` : '',
            googleMapsQuery: leg.fromLocation,
          });
        }
        if (toCoords) {
          stops.push({
            label: leg.toLocation,
            coords: toCoords,
            type: leg.type === 'CAR' ? 'car' : 'flight',
            detail: leg.carrier ?? '',
            googleMapsQuery: leg.toLocation,
          });
        }

        // Geocode unknown locations
        if (!fromCoords) {
          const c = await geocode(leg.fromLocation);
          if (c && !cancelled) stops.push({ label: leg.fromLocation, coords: c, type: leg.type === 'CAR' ? 'car' : 'flight', detail: '', googleMapsQuery: leg.fromLocation });
        }
        if (!toCoords) {
          const c = await geocode(leg.toLocation);
          if (c && !cancelled) stops.push({ label: leg.toLocation, coords: c, type: leg.type === 'CAR' ? 'car' : 'flight', detail: '', googleMapsQuery: leg.toLocation });
        }
      }

      // 2. Accommodations from keyInfos — exclude car rental, include everything else
      for (const ki of keyInfos) {
        const isAccom = !ki.label.toLowerCase().includes('mietwagen');

        console.log('[TripMap] keyInfo:', ki.label, '| isAccom:', isAccom);
        if (!isAccom) continue;

        const mapsQuery = buildGeoQuery(ki.label, ki.value);
        console.log('[TripMap] geocoding query:', mapsQuery);
        const geocoded = await geocode(mapsQuery);
        console.log('[TripMap] geocoded result:', geocoded);
        if (geocoded && !cancelled) {
          stops.push({
            label: ki.label,
            coords: geocoded,
            type: 'accommodation',
            detail: ki.value,
            googleMapsQuery: mapsQuery,
          });
        }
      }

      if (cancelled || !containerRef.current || stops.length === 0) {
        setStatus('empty');
        return;
      }

      // ── Build map ────────────────────────────────────────────────────────

      const map = L.map(containerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      // ── Deduplicate stops (same coords) ──────────────────────────────────
      const seen = new Set<string>();
      const unique = stops.filter(s => {
        const key = `${s.coords[0].toFixed(3)},${s.coords[1].toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // ── Route polyline ───────────────────────────────────────────────────
      if (unique.length > 1) {
        L.polyline(unique.map(s => s.coords), {
          color: '#6366f1',
          weight: 2.5,
          dashArray: '6,5',
          opacity: 0.7,
        }).addTo(map);
      }

      // ── Markers ──────────────────────────────────────────────────────────
      for (const stop of unique) {
        const color = ICON_COLOR[stop.type];
        const svg = ICON_SVG[stop.type];

        const iconHtml = `
          <div style="
            width:32px;height:32px;border-radius:50% 50% 50% 0;
            background:${color};transform:rotate(-45deg);
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid white;">
            <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;">
              ${svg}
            </div>
          </div>`;

        const icon = L.divIcon({ html: iconHtml, iconSize: [32, 32], iconAnchor: [16, 32], className: '' });

        const infoLines = stop.detail
          ? stop.detail.split('\n').filter(Boolean).map(l => `<span style="color:#64748b;font-size:12px">${l}</span>`).join('<br>')
          : '';

        const popup = L.popup({ maxWidth: 240 }).setContent(`
          <div style="font-family:system-ui,sans-serif;padding:2px 0">
            <strong style="font-size:13px;color:#1e293b">${stop.label}</strong>
            ${infoLines ? `<br><div style="margin-top:4px;line-height:1.5">${infoLines}</div>` : ''}
            <div style="margin-top:8px">
              <a href="${mapsUrl(stop.googleMapsQuery)}" target="_blank" rel="noopener"
                style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#4f46e5;text-decoration:none;font-weight:500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                In Google Maps öffnen
              </a>
            </div>
          </div>`);

        L.marker(stop.coords, { icon }).addTo(map).bindPopup(popup);
      }

      // ── Fit bounds ───────────────────────────────────────────────────────
      map.fitBounds(L.latLngBounds(unique.map(s => s.coords)).pad(0.15));

      setStatus('ready');
    }

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full" style={{ height: 420 }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-2xl z-10">
          <div className="flex flex-col items-center gap-2">
            <svg className="w-6 h-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-xs text-slate-400">Karte wird geladen…</span>
          </div>
        </div>
      )}
      {status === 'empty' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-2xl z-10">
          <p className="text-sm text-slate-400">Keine Standortdaten verfügbar.</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 mt-3 px-1">
      {([
        { type: 'flight',        label: 'Flug' },
        { type: 'car',           label: 'Mietwagen' },
        { type: 'accommodation', label: 'Unterkunft' },
      ] as const).map(({ type, label }) => (
        <div key={type} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: ICON_COLOR[type] }}
          />
          <span className="text-xs text-slate-500">{label}</span>
        </div>
      ))}
      <span className="text-xs text-slate-400 ml-auto">
        Marker anklicken für Details
      </span>
    </div>
  );
}

// ─── Public export (lazy-loaded by page) ─────────────────────────────────────

export interface TripMapProps {
  tripId: string;
  legs: TransportLeg[];
  keyInfos: TripKeyInfo[];
  destination: string;
}

export function TripMap({ tripId, legs, keyInfos, destination }: TripMapProps) {
  return (
    <div>
      <TripMapInner tripId={tripId} legs={legs} keyInfos={keyInfos} destination={destination} />
      <MapLegend />
    </div>
  );
}
