// src/app/api/start-round/route.ts
import { supabaseServer } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  // Проверяем, есть ли активный раунд
  const { data: current } = await supabaseServer
    .from('current_round')
    .select('round_id')
    .single()

  if (current?.round_id) {
    const { data: activeRound } = await supabaseServer
      .from('rounds')
      .select('started_at')
      .eq('id', current.round_id)
      .single()

    if (activeRound && new Date(activeRound.started_at).getTime() + 70 * 1000 > Date.now()) {
      return NextResponse.json({ message: 'Раунд уже идёт', round_id: current.round_id })
    }
  }

  // Создаём новый раунд
  const newRound = {
    round_number: (current?.round_id || 0) + 1,
    status: 'playing' as const,
    zone_center_lat: Math.random() * 180 - 90,
    zone_center_lng: Math.random() * 360 - 180,
    zone_radius_km: 6000,
    players: [],
    started_at: new Date().toISOString(),
  }

  const { data: created } = await supabaseServer
    .from('rounds')
    .insert(newRound)
    .select()
    .single()

  // Обновляем текущий раунд
  await supabaseServer
    .from('current_round')
    .upsert({ id: 1, round_id: created.id }, { onConflict: 'id' })

  return NextResponse.json({ message: 'Новый раунд запущен!', round: created })
}