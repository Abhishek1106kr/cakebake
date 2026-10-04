'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CakeStudio } from '@/components/cake-studio/studio';
import { useStore } from '@/components/store-provider';

function Inner() {
  const params = useSearchParams();
  const { mounted } = useStore();
  // Wait for the bag to load so "edit this cake" can find its line.
  if (!mounted) return <main className="page"><div className="container page-loader" /></main>;
  return <main className="page studio-page"><CakeStudio initialCode={params.get('design')} editLineId={params.get('line')} /></main>;
}

export function CustomizeClient() {
  return <Suspense fallback={<main className="page"><div className="container page-loader" /></main>}><Inner /></Suspense>;
}
