import Link from 'next/link';
import { ArtDrawing } from '@/components/media/product-art';

export default function NotFound() {
  return (
    <main className="status-page wrap">
      <div className="status-art tone-cream"><ArtDrawing art="teacup" /></div>
      <div className="eyebrow">404</div>
      <h1 className="page-title display">This page wandered off for a coffee.</h1>
      <div className="empty-actions">
        <Link href="/" className="btn btn-primary">Back home</Link>
        <Link href="/menu" className="btn btn-secondary">See the menu</Link>
      </div>
    </main>
  );
}
