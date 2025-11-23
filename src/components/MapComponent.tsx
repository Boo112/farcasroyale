'use client';

import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';

// Фиксим иконки
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  fid: number;
  round: any;
  status: string;
}

export default function MapComponent({ fid, round, status }: Props) {
  const center: [number, number] = round?.zone_center_lat && round?.zone_center_lng
    ? [round.zone_center_lat, round.zone_center_lng]
    : [0, 0];

  function ClickHandler() {
    useMapEvents({
      click(e) {
        if (status !== 'playing' || !round) return;

        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        const updatedPlayers = (round.players || []).filter((p: any) => p.fid !== fid);
        updatedPlayers.push({ fid, lat, lng, alive: true });

        supabase.from('rounds').update({ players: updatedPlayers }).eq('id', round.id);
      },
    });
    return null;
  }

  return (
    <MapContainer center={center} zoom={2} className="h-96 rounded-3xl border-8 border-white shadow-2xl">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {round && (
        <Circle
          center={center}
          radius={(round.zone_radius_km || 6000) * 1000}
          fillColor="#ff0066"
          color="#fff"
          weight={8}
          fillOpacity={0.4}
        />
      )}
      <ClickHandler />
    </MapContainer>
  );
}