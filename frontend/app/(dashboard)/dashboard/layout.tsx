import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your career readiness score and the next best action.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
