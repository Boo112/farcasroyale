// src/components/GameContent.tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const MapComponent = dynamic(() => import('./MapComponent'), {
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
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [playersCount, setPlayersCount] = useState(0);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);

  // ← НИКАКИХ async В useEffect — ЭТО ГЛАВНОЕ!
  useEffect(() => {
    // Загружаем текущий раунд
    const loadRound = async () => {
      try {
        const { data: cur } = await supabase.from('current_round').select('round_id').single();
        if (cur?.round_id) {
          const { data: r } = await supabase.from('rounds').select('*').eq('id', cur.round_id).single();
          if (r) {
            setRound(r);
            setPlayersCount(r.players?.length || 0);

            if (r.status === 'playing') {
              setGameStatus('playing');
              setRoundStartTime(Date.now());
            }
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки раунда:', err);
      }
    };

    loadRound();

    // Подписка на изменения
    const channel = supabase
      .channel('rounds')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds' },
        (payload: any) => {
          const r = payload.new;
          setRound(r);
          setPlayersCount(r.players?.length || 0);

          if (r.status === 'playing' && gameStatus !== 'playing') {
            setGameStatus('playing');
            setRoundStartTime(Date.now());
            setTimeLeft(60);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // ← ПУСТОЙ МАССИВ — ВСЁ ЧИСТО

  // Идеальный клиентский таймер
  useEffect(() => {
    if (gameStatus !== 'playing' || roundStartTime === null) {
      return;
    }

    const endTime = roundStartTime + 60000;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(left);

      if (left <= 0) {
        setGameStatus('finished');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [gameStatus, roundStartTime]);

  return (
    <div className="w-full max-w-lg text-center space-y-8">
      <h1 className="text-8xl font-black">FarCast Royale</h1>
      <p className="text-5xl">Раунд #{round?.round_number || '?'}</p>
      <div className="text-9xl font-mono font-bold text-yellow-400">{timeLeft}</div>
      <p className="text-4xl">{playersCount} игроков</p>

      <div className="mt-12">
        <MapComponent
          fid={fid}
          round={round}
          status={gameStatus}
          myPosition={myPosition}
          setMyPosition={setMyPosition}
        />
      </div>

      <div className="text-6xl font-bold mt-12">
        {gameStatus === 'waiting' && <p className="animate-pulse">Ожидание игроков...</p>}
        {gameStatus === 'playing' && <p className="text-green-400 animate-bounce">КЛИКАЙ НА КАРТУ!</p>}
        {gameStatus === 'finished' && <p className="text-yellow-400">ВЫЖИЛ!</p>}
      </div>
    </div>
  );
}