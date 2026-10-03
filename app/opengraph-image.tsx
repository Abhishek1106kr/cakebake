import { ImageResponse } from 'next/og';

export const alt = 'Tresor · Good coffee. Slow moments.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#FFFFFF' }}>
        <div style={{ width: 380, background: '#7E9291', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56, color: '#FFFFFF' }}>
          <div style={{ fontSize: 30, letterSpacing: 12 }}>TRESOR</div>
          <div style={{ fontSize: 18, letterSpacing: 4, opacity: 0.85 }}>WHITEFIELD · BENGALURU</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 72, color: '#202625' }}>
          <div style={{ fontSize: 18, letterSpacing: 5, color: '#657876' }}>THE HOUSE OF TRESOR</div>
          <div style={{ fontSize: 92, lineHeight: 1, marginTop: 24, fontFamily: 'serif' }}>Good coffee.</div>
          <div style={{ fontSize: 92, lineHeight: 1, fontFamily: 'serif' }}>Slow moments.</div>
        </div>
      </div>
    ),
    size,
  );
}
