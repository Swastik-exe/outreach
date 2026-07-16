import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resume',
  description: 'Upload your resume for an honest, structured analysis.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
