import Link from 'next/link';

// External links come only from env (CLAUDE.md §41: never invent or guess URLs).
const zomato = process.env.NEXT_PUBLIC_ZOMATO_URL;
const swiggy = process.env.NEXT_PUBLIC_SWIGGY_URL;

export function Footer() {
  const year = new Date().getFullYear();
  return <footer className="footer">
    <div>© {year} Tresor Bakery · Bengaluru</div>
    <div style={{ display: 'flex', gap: 18 }}>
      <Link href="/contact">Visit</Link>
      {zomato && <a href={zomato} target="_blank" rel="noopener noreferrer">Zomato</a>}
      {swiggy && <a href={swiggy} target="_blank" rel="noopener noreferrer">Swiggy</a>}
      <span style={{ opacity: .7 }}>Payments are simulated in this prototype.</span>
    </div>
  </footer>;
}
