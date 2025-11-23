'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';

// Фиксим иконки Leaflet (один раз)
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export default function Home() {
  const searchParams = useSearchParams();
  const fid = Number(searchParams.get('fid') || 3);

  const [round, setRound] = useState<any>(null);
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [playersCount, setPlayersCount] = useState(0);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');

  // Получаем текущий раунд
  useEffect(() => {
    const fetchCurrentRound = async () => {
      const { data: current } = await supabase.from('current_round').select('round_id').single();
      if (!current?.round_id) return;

      const { data: r } = await supabase.from('rounds').select('*').eq('id', current.round_id).single();
      if (r) {
        setRound(r);
        setStatus(r.status || 'waiting');
        setPlayersCount(r.players?.length || 0);
      }
    };

    fetchCurrentRound();

    // Подписка на изменения
    const channel = supabase
      .channel('rounds_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, (payload: any) => {
        const updated = payload.new;
        if (round?.id === updated.id || !round) {
          setRound(updated);
          setStatus(updated.status);
          setPlayersCount(updated.players?.length || 0);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Таймер
  useEffect(() => {
    if (status !== 'playing' || !round?.started_at) return;

    const startTime = new Date(round.started_at).getTime();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = Math.max(0, 60 - elapsed);
      setTimeLeft(left);

      if (left === 0) {
        setStatus('finished');
      }
    }, 500);

    return () => clearInterval(timer);
  }, [status, round?.started_at]);

  // Обработчик клика по карте
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        if (status !== 'playing') return;

        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        setMyPosition([lat, lng]);

        if (round) {
          const newPlayers = (round.players || []).filter((p: any) => p.fid !== fid);
          newPlayers.push({ fid, lat, lng, alive: true });
          supabase.from('rounds').update({ players: newPlayers }).eq('id', round.id);
        }
      },
    });
    return null;
  }

  const center: [number, number] = round?.zone_center_lat && round?.zone_center_lng
    ? [round.zone_center_lat, round.zone_center_lng]
    : [0, 0];

  // Если нет окна — показываем заглушку (SSR)
  if (typeof window === 'undefined') {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center text-4xl">Загрузка...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-800 via-purple-900 to-black text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full text-center space-y-6">
        <h1 className="text-7xl font-black">FarCast Royale</h1>
        <p className="text-4xl">Раунд #{round?.round_number || '?'}</p>
        <div className="text-8xl font-mono font-bold text-yellow-400">{timeLeft}</div>
        <p className="text-3xl">{playersCount} игроков</p>

        <div className="mt-8">
          <MapContainer center={center} zoom={2} className="h-96 rounded-3xl border-8 border-white shadow-2xl">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {round && (
              <Circle
                center={center}
                radius={(round.zone_radius_km || 6000) * 1000}
                fillColor="#ff0066"
                color="#ffffff"
                weight={8}
                opacity={0.9}
                fillOpacity={0.4}
              />
            )}
            {myPosition && <Marker position={myPosition} />}
            <MapClickHandler />
          </MapContainer>
        </div>

        <div className="text-5xl font-bold mt-8">
          {status === 'waiting' && <p className="animate-pulse">Ожидание игроков...</p>}
          {status === 'playing' && <p className="text-green-400 animate-bounce">КЛИКНИ НА КАРТУ!</p>}
          {status === 'finished' && <p className="text-yellow-400">Раунд окончен!</p>}
        </div>
      </div>
    </div>
  );
}