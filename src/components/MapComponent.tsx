// src/components/MapComponent.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import L from 'leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });

// ОТДЕЛЬНЫЙ КОМПОНЕНТ — ВОТ ГЛАВНОЕ!
const MapEvents = ({ fid, round, status, setMyPosition, setIsAlive }: any) => {
  const { useMapEvents } = require('react-leaflet');

  useMapEvents({
    click(e: any) {
      if (status !== 'playing' || !round) return;

      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      const centerLat = round.zone_center_lat;
      const centerLng = round.zone_center_lng;
      const radiusKm = round.zone_radius_km || 6000;

      // Расстояние в км (гаверсинус)
      const R = 6371;
      const dLat = (clickedLat - centerLat) * Math.PI / 180;
      const dLon = (clickedLng - centerLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(centerLat * Math.PI / 180) * Math.cos(clickedLat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      const isAlive = distance <= radiusKm;

      setMyPosition([clickedLat, clickedLng]);
      setIsAlive(isAlive);

      const updated = (round.players || []).filter((p: any) => p.fid !== fid);
      updated.push({ fid, lat: clickedLat, lng: clickedLng, alive: isAlive });

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

  const center: [number, number] = round?.zone_center_lat && round?.zone_center_lng
    ? [round.zone_center_lat, round.zone_center_lng]
    : [0, 0];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Фиксим иконки Leaflet
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  if (!MapContainer) {
    return <div className="h-96 bg-gray-900 rounded-3xl flex items-center justify-center text-white text-3xl">Загрузка карты...</div>;
  }

  return (
    <>
      <MapContainer
        center={center}
        zoom={2}
        className="h-96 rounded-3xl border-8 border-white shadow-2xl"
        style={{ cursor: 'crosshair' }}
      >
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

        {myPosition && (
          <Marker
            position={myPosition}
            icon={L.divIcon({
              className: '',
              html: isAlive === true
                ? '<div style="font-size:50px;color:lime">Checkmark</div>'
                : isAlive === false
                ? '<div style="font-size:50px;color:red">Cross</div>'
                : '<div style="font-size:40px;color:yellow">Circle</div>',
              iconSize: [50, 50],
              iconAnchor: [25, 25],
            })}
          />
        )}

        <MapEvents fid={fid} round={round} status={status} setMyPosition={setMyPosition} setIsAlive={setIsAlive} />
      </MapContainer>

      {status === 'finished' && isAlive !== null && (
        <div className="mt-12 text-7xl font-black animate-pulse">
          {isAlive ? (
            <p className="text-lime-400">ВЫЖИЛ!</p>
          ) : (
            <p className="text-red-500">УМЕР</p>
          )}
        </div>
      )}
    </>
  );
}