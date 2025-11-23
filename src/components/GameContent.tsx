'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

// Карта без SSR
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-900 rounded-3xl flex items-center justify-center text-white text-3xl">
      Загрузка карты...
    </div>
  ),
});

interface Props {
  fid: number;
}

export default function GameContent({ fid }: Props) {
  const [round, setRound] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [playersCount, setPlayersCount] = useState(0);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');

  // Загрузка раунда + подписка
  useEffect(() => {
    // Инициализация — загрузка текущего раунда
    const init = async () => {
      try {
        const { data: cur } = await supabase
          .from('current_round')
          .select('round_id')
          .single();

        if (cur?.round_id) {
          const { data: r } = await supabase
            .from('rounds')
            .select('*')
            .eq('id', cur.round_id)
            .single();

          if (r) {
            setRound(r);
            setStatus(r.status || 'waiting');
            setPlayersCount(r.players?.length || 0);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки раунда:', err);
      }
    };

    init();

    // Подписка на изменения в реальном времени
    const channel = supabase
      .channel('rounds')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds' },
        (payload: any) => {
          const updated = payload.new;
          if (!round || updated.id === round.id) {
            setRound(updated);
            setStatus(updated.status || 'waiting');
            setPlayersCount(updated.players?.length || 0);
          }
        }
      )
      .subscribe();

    // Отписываемся при размонтировании
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // ← пустой массив зависимостей = один раз при монтировании

  // Таймер
  useEffect(() => {
    if (status !== 'playing' || !round?.started_at) return;

    const start = new Date(round.started_at).getTime();
    const timer = setInterval(() => {
      const left = Math.max(0, 60 - Math.floor((Date.now() - start) / 1000));
      setTimeLeft(left);
      if (left === 0) setStatus('finished');
    }, 500);

    return () => clearInterval(timer);
  }, [status, round?.started_at]);

  return (
    <div className="w-full max-w-lg text-center space-y-8">
      <h1 className="text-8xl font-black">FarCast Royale</h1>
      <p className="text-5xl">Раунд #{round?.round_number || '?'}</p>
      <div className="text-9xl font-mono font-bold text-yellow-400">{timeLeft}</div>
      <p className="text-4xl">{playersCount} игроков</p>

      <div className="mt-12">
        <MapComponent fid={fid} round={round} status={status} />
      </div>

      <div className="text-6xl font-bold mt-12">
        {status === 'waiting' && <p className="animate-pulse">Ожидание игроков...</p>}
        {status === 'playing' && <p className="text-green-400 animate-bounce">КЛИКАЙ НА КАРТУ!</p>}
        {status === 'finished' && <p className="text-yellow-400">ВЫЖИЛ!</p>}
      </div>
    </div>
  );
}