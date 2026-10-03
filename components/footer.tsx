import Link from 'next/link';
export function Footer() {
  const year = new Date().getFullYear();
  return <footer className="footer">
    <div>© {year} Tresor · Bengaluru</div>
    <div style={{ display: 'flex', gap: 18 }}><Link href="/contact">Visit</Link><a href={process.env.NEXT_PUBLIC_ZOMATO_URL || 'https://www.zomato.com/'} target="_blank" rel="noreferrer">Zomato</a><a href={process.env.NEXT_PUBLIC_SWIGGY_URL || 'https://www.swiggy.com/'} target="_blank" rel="noreferrer">Swiggy</a></div>
  </footer>;
}
