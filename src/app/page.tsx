import { Suspense } from 'react';
import ClientGame from './ClientGame';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-6xl">Загрузка...</div>}>
        <ClientGame />
      </Suspense>
    </div>
  );
}