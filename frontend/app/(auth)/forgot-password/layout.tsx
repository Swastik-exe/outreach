import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Request a password reset link for your Outreach account.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
