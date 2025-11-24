// src/components/MapComponent.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

// Динамическая загрузка — чтобы не падало на сервере
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });

interface Props {
  fid: number;
  round: any;
  status: string;
  myPosition: [number, number] | null;
  setMyPosition: (pos: [number, number] | null) => void;
}

export default function MapComponent({ fid, round, status, myPosition, setMyPosition }: Props) {
  const [isAlive, setIsAlive] = useState<boolean | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const center: [number, number] = round?.zone_center_lat && round?.zone_center_lng
    ? [round.zone_center_lat, round.zone_center_lng]
    : [0, 0];

  // Один раз подключаем Leaflet + CSS
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeaflet = async () => {
      // CSS — только один раз!
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-sA+ZJOvH1q0b1i9p2dW9q8F8k0WvL3J6Z8kYJ8+Z4U=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;

      // Фиксим иконки
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      setMapReady(true);
    };

    loadLeaflet();
  }, []);

  // Клик по карте
  const handleClick = (e: any) => {
    if (status !== 'playing' || !round) return;
    const { lat, lng } = e.latlng;
    const pos: [number, number] = [lat, lng];
    setMyPosition(pos);

    const updated = (round.players || []).filter((p: any) => p.fid !== fid);
    updated.push({ fid, lat, lng });
    supabase.from('rounds').update({ players: updated }).eq('id', round.id);
  };

  // Расчёт выживания
  useEffect(() => {
    if (!round?.revealed || !myPosition) {
      setIsAlive(null);
      return;
    }

    const R = 6371;
    const dLat = (myPosition[0] - round.zone_center_lat) * (Math.PI / 180);
    const dLon = (myPosition[1] - round.zone_center_lng) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(round.zone_center_lat * Math.PI / 180) *
              Math.cos(myPosition[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setIsAlive(distance > (round.zone_radius_km || 6000));
  }, [round?.revealed, myPosition, round?.zone_center_lat, round?.zone_center_lng, round?.zone_radius_km]);

  // Пока карта грузится
  if (!mapReady) {
    return (
      <div className="h-96 bg-gradient-to-br from-purple-900 to-black rounded-3xl flex items-center justify-center">
        <p className="text-4xl text-white animate-pulse">Загрузка карты мира...</p>
      </div>
    );
  }

  return (
    <>
      <MapContainer
        center={center}
        zoom={2}
        className="h-96 rounded-3xl shadow-2xl"
        style={{ background: '#000' }}
        scrollWheelZoom={false}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ЗОНА СМЕРТИ — ПОЯВЛЯЕТСЯ ПОСЛЕ 60 СЕК */}
        {round?.revealed && (
          <Circle
            center={center}
            radius={(round.zone_radius_km || 6000) * 1000}
            pathOptions={{
              fillColor: '#ff0044',
              fillOpacity: 0.7,
              color: '#ff0066',
              weight: 12,
              dashArray: '20, 20',
            }}
          />
        )}

        {/* ТВОЙ УКАЗАТЕЛЬ */}
        {myPosition && (
          <Marker
            position={myPosition}
            eventHandlers={{ click: () => {} }}
            icon={L.divIcon({
              className: 'my-custom-pin',
              html: round?.revealed
                ? isAlive
                  ? '<div style="font-size:100px;color:lime;filter:drop-shadow(0 0 20px lime)">Checkmark</div>'
                  : '<div style="font-size:100px;color:red;filter:drop-shadow(0 0 20px red)">Cross</div>'
                : `
                  <div style="position:relative;">
                    <div style="position:absolute;top:-90px;left:-60px;background:#00ff88;color:black;font-weight:900;padding:10px 20px;border-radius:16px;border:6px solid white;box-shadow:0 0 30px #00ff88;font-size:20px;">ТЫ ЗДЕСЬ</div>
                    <div style="width:50px;height:50px;background:#00ff88;border:8px solid white;border-radius:50%;box-shadow:0 0 40px #00ff88;"></div>
                    <div style="position:absolute;top:50px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:25px solid transparent;border-right:25px solid transparent;border-top:50px solid #00ff88;"></div>
                  </div>
                `,
              iconSize: [100, 150],
              iconAnchor: [50, 150],
            })}
          />
        )}

        {/* Клик */}
        {status === 'playing' && (
          <div className="leaflet-container" onClick={handleClick} style={{ cursor: 'crosshair' }} />
        )}
      </MapContainer>

      {/* РЕЗУЛЬТАТ */}
      {round?.revealed && isAlive !== null && (
        <div className="mt-16 text-9xl font-black animate-bounce">
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