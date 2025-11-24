// src/components/MapComponent.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });

const MapEvents = ({ fid, round, status, setMyPosition }: any) => {
  const { useMapEvents } = require('react-leaflet');

  useMapEvents({
    click(e: any) {
      if (status !== 'playing' || !round) return;

      const pos: [number, number] = [e.latlng.lat, e.latlng.lng];
      setMyPosition(pos);

      const updated = (round.players || []).filter((p: any) => p.fid !== fid);
      updated.push({ fid, lat: pos[0], lng: pos[1] });

      supabase.from('rounds').update({ players: updated }).eq('id', round.id);
    },
  });
  return null;
};

interface Props {
  fid: number;
  round: any;
  status: string;
  myPosition: [number, number] | null;
  setMyPosition: (pos: [number, number] | null) => void;
}

export default function MapComponent({ fid, round, status, myPosition, setMyPosition }: Props) {
  const [isAlive, setIsAlive] = useState<boolean | null>(null);
  const [L, setL] = useState<any>(null);

  const center: [number, number] = round?.zone_center_lat && round?.zone_center_lng
    ? [round.zone_center_lat, round.zone_center_lng]
    : [0, 0];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default);

        // Фиксим иконки
        delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
        leaflet.default.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      });

      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
    }
  }, []);

  // Расчёт выживания — ТОЛЬКО КОГДА ЗОНА РАСКРЫТА
  useEffect(() => {
    if (!round?.revealed || !myPosition || !L) return;

    const R = 6371;
    const dLat = (myPosition[0] - round.zone_center_lat) * Math.PI / 180;
    const dLon = (myPosition[1] - round.zone_center_lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(round.zone_center_lat * Math.PI / 180) * Math.cos(myPosition[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const alive = distance > (round.zone_radius_km || 6000);
    setIsAlive(alive);
  }, [round?.revealed, myPosition, round?.zone_center_lat, round?.zone_center_lng, round?.zone_radius_km, L]);

  if (!MapContainer || !L) {
    return <div className="h-96 bg-gray-900 rounded-3xl flex items-center justify-center text-white text-3xl">Загрузка карты...</div>;
  }

  return (
    <>
      <MapContainer center={center} zoom={2} className="h-96 rounded-3xl border-8 border-white shadow-2xl" style={{ cursor: status === 'playing' ? 'crosshair' : 'default' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* ЗОНА ПОЯВЛЯЕТСЯ ТОЛЬКО ПОСЛЕ 60 СЕК */}
        {round?.revealed && (
          <Circle
            center={center}
            radius={(round.zone_radius_km || 6000) * 1000}
            fillColor="#ff0044"
            color="#ff0066"
            weight={12}
            fillOpacity={0.6}
            dashArray="10, 10"
          />
        )}

        {/* ТВОЙ МАРКЕР — УКАЗАТЕЛЬ + КРУЖОК */}
        {myPosition && (
          <Marker
            position={myPosition}
            icon={L.divIcon({
              className: 'custom-marker',
              html: round?.revealed
                ? isAlive
                  ? `<div style="font-size:80px;color:lime;filter:drop-shadow(0 0 10px lime)">Checkmark</div>`
                  : `<div style="font-size:80px;color:red;filter:drop-shadow(0 0 10px red)">Cross</div>`
                : `
                  <div style="width:30px;height:30px;background:#00ff00;border:4px solid white;border-radius:50%;box-shadow:0 0 20px #00ff00;"></div>
                  <div style="position:absolute;top:-60px;left:-25px;width:50px;text-align:center;color:white;font-weight:bold;font-size:18px;background:rgba(0,0,0,0.7);padding:5px;border-radius:8px;">ТЫ</div>
                  <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:15px solid transparent;border-right:15px solid transparent;border-top:30px solid #00ff00;"></div>
                `,
              iconSize: [60, 80],
              iconAnchor: [30, 80],
            })}
          />
        )}

        <MapEvents fid={fid} round={round} status={status} setMyPosition={setMyPosition} />
      </MapContainer>

      {round?.revealed && isAlive !== null && (
        <div className="mt-12 text-8xl font-black animate-bounce">
          {isAlive ? (
            <p className="text-lime-400 drop-shadow-2xl">ВЫЖИЛ!</p>
          ) : (
            <p className="text-red-500 drop-shadow-2xl">УМЕР</p>
          )}
        </div>
      )}
    </>
  );
}