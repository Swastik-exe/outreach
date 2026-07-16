import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify email',
  description: 'Verify your email address to activate your Outreach account.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
