'use client';

import { useSearchParams } from 'next/navigation';
import GameContent from '@/components/GameContent';

export default function ClientGame() {
  const searchParams = useSearchParams();
  const fid = Number(searchParams.get('fid') || 3);

  return <GameContent fid={fid} />;
}