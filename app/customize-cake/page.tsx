import { redirect } from 'next/navigation';

// The placeholder became the Cake Playground at /customize.
export default function CustomizeCakePage() {
  redirect('/customize');
}
