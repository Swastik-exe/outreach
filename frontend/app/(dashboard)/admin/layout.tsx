import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Outreach operations dashboard.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
