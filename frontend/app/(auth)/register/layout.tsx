import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Sign up free with any email — no resume required to begin.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
