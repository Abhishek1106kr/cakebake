import { ReactNode } from 'react';
import Link from 'next/link';
import { BarChart3, Boxes, ClipboardList, ChefHat, LayoutDashboard, PackageSearch, Settings, Users } from 'lucide-react';
import '../globals.css';

const nav = [
 { href:'/admin', label:'Overview', icon:LayoutDashboard },
 { href:'/admin/orders', label:'Orders', icon:ClipboardList },
 { href:'/admin/kitchen', label:'Kitchen', icon:ChefHat },
 { href:'/admin/products', label:'Products', icon:PackageSearch },
 { href:'/admin/inventory', label:'Inventory', icon:Boxes },
 { href:'/admin', label:'Customers', icon:Users },
 { href:'/admin', label:'Analytics', icon:BarChart3 },
 { href:'/admin', label:'Settings', icon:Settings },
];
export default function AdminLayout({children}:{children:ReactNode}){return <div className="admin-shell"><aside className="admin-side"><div className="admin-brand">Tresor</div><nav className="admin-nav">{nav.map(n=>{const I=n.icon;return <Link href={n.href} key={n.label}><I size={17}/><span>{n.label}</span></Link>})}</nav></aside><main className="admin-main">{children}</main></div>}
