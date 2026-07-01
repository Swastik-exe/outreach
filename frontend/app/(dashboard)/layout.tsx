'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { NavBar } from '@/components/NavBar';
import { FeedbackFab } from '@/components/FeedbackFab';
import { FullPageLoader } from '@/components/VortexLoader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <FullPageLoader />;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0A0B0E] flex flex-col">
      <NavBar />
      <main
        className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingBottom: 'max(6rem, calc(env(safe-area-inset-bottom) + 4rem))',
        }}
      >
        {children}
      </main>
      <FeedbackFab />
    </div>
  );
}
