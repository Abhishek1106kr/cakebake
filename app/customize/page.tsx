import type { Metadata } from 'next';
import { CustomizeClient } from './customize-client';

export const metadata: Metadata = {
  title: 'Cake Playground · Tresor',
  description: 'Design your own Tresor cake: size, sponge, filling, frosting, toppings, a message and an edible photo print. See it as you build it.',
};

export default function CustomizePage() {
  return <CustomizeClient />;
}
