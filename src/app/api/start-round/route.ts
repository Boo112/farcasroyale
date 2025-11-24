// src/app/api/start-round/route.ts
import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = supabaseServer;

  // Номер нового раунда
  const { data: last } = await supabase
    .from('rounds')
    .select('round_number')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  const nextNumber = (last?.round_number || 0) + 1;
  const startedAt = new Date().toISOString();

  const newRound = {
    round_number: nextNumber,
    status: 'playing',
    zone_center_lat: (Math.random() - 0.5) * 180,
    zone_center_lng: (Math.random() - 0.5) * 360,
    zone_radius_km: 6000,
    players: [],
    started_at: startedAt,
  };

  const { data: round, error } = await supabase
    .from('rounds')
    .insert(newRound)
    .select()
    .single();

  if (error) {
    console.error('Ошибка создания раунда:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('current_round').upsert({ id: 1, round_id: round.id });

  return NextResponse.json({
    message: 'Раунд запущен!',
    round: round.id,
    number: nextNumber,
    status: 'playing',
    started_at: startedAt,
  });
}