import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Outreach to see your career readiness score.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
