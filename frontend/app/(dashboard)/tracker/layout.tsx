import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tracker',
  description: 'Track every application from draft to offer in one place.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
