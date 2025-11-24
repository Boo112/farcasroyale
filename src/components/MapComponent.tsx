// src/components/MapComponent.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

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
  const [L, setL] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Правильные имена полей из базы!
  const center: [number, number] = round?.zone_lat != null && round?.zone_lng != null
    ? [round.zone_lat, round.zone_lng]
    : [0, 0];

  // Загрузка Leaflet только в браузере
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const init = async () => {
      const leaflet = await import('leaflet');
      setL(leaflet.default);

      // CSS один раз
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Фиксим иконки
      delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
      leaflet.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      setMapReady(true);
    };

    init();
  }, []); // ← ВСЁ ЗАКРЫТО ПРАВИЛЬНО!

  // Клик по карте
  const handleClick = (e: any) => {
    if (status !== 'playing' || !round || !L) return;

    const { lat, lng } = e.latlng;
    const pos: [number, number] = [lat, lng];
    setMyPosition(pos);

    const currentPlayers = round.players ? JSON.parse(round.players) : [];
    const filtered = currentPlayers.filter((p: any) => p.fid !== fid);
    filtered.push({ fid, lat, lng });

    supabase
      .from('rounds')
      .update({ players: JSON.stringify(filtered) })
      .eq('id', round.id);
  };

  // Расчёт выживания
  useEffect(() => {
    if (!round?.revealed || !myPosition || round?.zone_lat == null) {
      setIsAlive(null);
      return;
    }

    const R = 6371;
    const dLat = (myPosition[0] - round.zone_lat) * (Math.PI / 180);
    const dLon = (myPosition[1] - round.zone_lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(round.zone_lat * Math.PI / 180) *
              Math.cos(myPosition[0] * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    setIsAlive(distance > (round.zone_radius_km || 6000));
  }, [round?.revealed, myPosition, round?.zone_lat, round?.zone_lng, round?.zone_radius_km]);

  if (!mapReady || !L) {
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
        className="h-96 rounded-3xl shadow-2xl border-8 border-purple-600"
        style={{ background: '#000' }}
        scrollWheelZoom={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* ЗОНА СМЕРТИ */}
        {round?.revealed && (
          <Circle
            center={center}
            radius={(round.zone_radius_km || 6000) * 1000}
            pathOptions={{
              fillColor: '#ff0044',
              fillOpacity: 0.7,
              color: '#ff0066',
              weight: 15,
            }}
          />
        )}

        {/* ТВОЙ УКАЗАТЕЛЬ */}
        {myPosition && (
          <Marker
            position={myPosition}
            icon={L.divIcon({
              className: '',
              html: round?.revealed
                ? isAlive
                  ? '<div style="font-size:100px;color:lime;filter:drop-shadow(0 0 20px lime)">Checkmark</div>'
                  : '<div style="font-size:100px;color:red;filter:drop-shadow(0 0 20px red)">Cross</div>'
                : `
                  <div style="position:relative;">
                    <div style="position:absolute;top:-100px;left:-70px;background:#00ff88;color:#000;font-weight:900;padding:12px 24px;border-radius:20px;border:6px solid white;box-shadow:0 0 40px #00ff88;font-size:22px;">ТЫ ЗДЕСЬ</div>
                    <div style="width:60px;height:60px;background:#00ff88;border:8px solid white;border-radius:50%;box-shadow:0 0 50px #00ff88;"></div>
                    <div style="position:absolute;top:60px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:30px solid transparent;border-right:30px solid transparent;border-top:60px solid #00ff88;"></div>
                  </div>
                `,
              iconSize: [120, 180],
              iconAnchor: [60, 180],
            })}
          />
        )}

        {/* Клик по карте */}
        {status === 'playing' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
              cursor: 'crosshair',
            }}
            onClick={handleClick}
          />
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