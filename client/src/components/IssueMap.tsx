import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import type { Issue, Priority } from '../lib/types';

/** Default view: Coimbatore. */
const DEFAULT_CENTER: [number, number] = [11.0168, 76.9858];

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: '#e03131',
  high: '#f0700f',
  medium: '#e0a100',
  low: '#1f9d5c',
};

interface Point {
  lat: number;
  lng: number;
}

function Recenter({ point }: { point: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lng], Math.max(map.getZoom(), 15));
  }, [map, point]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

interface Props {
  issues?: Issue[];
  /** Picker mode: currently selected point and a callback when the user clicks the map. */
  value?: Point | null;
  onPick?: (p: Point) => void;
  className?: string;
  label: string;
}

/** Leaflet + OpenStreetMap (free, no API key). Loaded lazily so it never blocks first paint. */
export default function IssueMap({
  issues = [],
  value = null,
  onPick,
  className = 'map',
  label,
}: Props) {
  const located = issues.filter((i) => i.location.lat !== null && i.location.lng !== null);
  const center: [number, number] = value
    ? [value.lat, value.lng]
    : located[0]
      ? [located[0].location.lat!, located[0].location.lng!]
      : DEFAULT_CENTER;

  return (
    <div className={className} role="region" aria-label={label}>
      <MapContainer
        center={center}
        zoom={value ? 15 : 12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {located.map((issue) => (
          <CircleMarker
            key={issue.id}
            center={[issue.location.lat!, issue.location.lng!]}
            radius={issue.priority === 'critical' ? 11 : issue.priority === 'high' ? 9 : 7}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: PRIORITY_COLOR[issue.priority],
              fillOpacity: issue.status === 'resolved' || issue.status === 'rejected' ? 0.35 : 0.9,
            }}
          >
            <Popup>
              <strong>{issue.title}</strong>
              <br />
              {PRIORITY_LABEL[issue.priority]} priority · {STATUS_LABEL[issue.status]}
              <br />
              <Link to={`/track/${issue.code}`}>View {issue.code} →</Link>
            </Popup>
          </CircleMarker>
        ))}
        {value && (
          <CircleMarker
            center={[value.lat, value.lng]}
            radius={10}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2458e6', fillOpacity: 1 }}
          />
        )}
        {onPick && <ClickToPick onPick={onPick} />}
        <Recenter point={value} />
      </MapContainer>
    </div>
  );
}
