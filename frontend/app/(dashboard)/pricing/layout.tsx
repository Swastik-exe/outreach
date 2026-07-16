import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free to start. Upgrade only if the score keeps earning it.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
