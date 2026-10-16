import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationLog } from '@/types';

// Fix default icon paths for bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

interface RouteMapProps {
  logs: LocationLog[];
  currentPosition: { lat: number; lng: number } | null;
}

export default function RouteMap({ logs, currentPosition }: RouteMapProps) {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const routePoints: [number, number][] = sorted.map((l) => [l.latitude, l.longitude]);
  const allPoints = [...routePoints];
  if (currentPosition) allPoints.push([currentPosition.lat, currentPosition.lng]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-700/50">
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        className="w-full h-full"
        style={{ background: '#1e293b' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={allPoints} />

        {routePoints.length >= 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: '#14b8a6', weight: 4, opacity: 0.8, dashArray: '8, 6' }}
          />
        )}

        {sorted.map((log, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1 && sorted.length > 1;
          const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#0d9488';
          return (
            <CircleMarker
              key={log.id}
              center={[log.latitude, log.longitude]}
              radius={isFirst || isLast ? 8 : 5}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
            >
              <Tooltip>
                <div className="text-xs">
                  <div className="font-medium">{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="text-slate-500">
                    {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {currentPosition && (
          <CircleMarker
            center={[currentPosition.lat, currentPosition.lng]}
            radius={10}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.5,
              weight: 3,
            }}
          >
            <Tooltip permanent>
              <div className="text-xs font-medium">You are here</div>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
