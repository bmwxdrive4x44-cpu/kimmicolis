'use client';

import { useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const homeIcon = new L.DivIcon({
  className: 'relay-home-marker',
  html: '<div style="background:#0f766e;color:white;border-radius:9999px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid white;">M</div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const nearestRelayIcon = new L.DivIcon({
  className: 'relay-nearest-marker',
  html: '<div style="background:#059669;color:white;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid white;">★</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function RelaySelectionMap({
  home,
  relays,
  selectedRelayId,
  nearestRelayId,
  onSelectRelay,
}: {
  home: { lat: number; lon: number } | null;
  relays: Array<{ id: string; commerceName: string; address: string; latitude?: number | null; longitude?: number | null }>;
  selectedRelayId: string;
  nearestRelayId?: string | null;
  onSelectRelay: (relayId: string) => void;
}) {
  const points = useMemo(() => {
    const items: Array<{ lat: number; lon: number }> = [];
    if (home) items.push({ lat: home.lat, lon: home.lon });
    for (const relay of relays) {
      if (typeof relay.latitude === 'number' && typeof relay.longitude === 'number') {
        items.push({ lat: relay.latitude, lon: relay.longitude });
      }
    }
    return items;
  }, [home, relays]);

  const center = useMemo(() => {
    if (points.length === 0) return [28.0339, 1.6596] as [number, number];
    const avgLat = points.reduce((sum, item) => sum + item.lat, 0) / points.length;
    const avgLon = points.reduce((sum, item) => sum + item.lon, 0) / points.length;
    return [avgLat, avgLon] as [number, number];
  }, [points]);

  return (
    <div className="h-72 overflow-hidden rounded-xl border">
      <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {home && (
          <Marker position={[home.lat, home.lon]} icon={homeIcon}>
            <Popup>Votre domicile (adresse indiquee)</Popup>
          </Marker>
        )}

        {relays
          .filter((relay) => typeof relay.latitude === 'number' && typeof relay.longitude === 'number')
          .map((relay) => (
            <Marker
              key={relay.id}
              position={[relay.latitude as number, relay.longitude as number]}
              icon={relay.id === nearestRelayId ? nearestRelayIcon : markerIcon}
              eventHandlers={{
                click: () => onSelectRelay(relay.id),
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{relay.commerceName}</p>
                  {relay.id === nearestRelayId ? (
                    <p className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Plus proche</p>
                  ) : null}
                  <p className="text-xs text-slate-600">{relay.address}</p>
                  <button
                    type="button"
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                    onClick={() => onSelectRelay(relay.id)}
                  >
                    {selectedRelayId === relay.id ? 'Relais selectionne' : 'Choisir ce relais'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
