'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { SideNav } from '@/components/SideNav';
import { TabBar } from '@/components/TabBar';
import { MobileHeader } from '@/components/MobileHeader';
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
    <div className="min-h-screen min-h-[100dvh] bg-bg text-text flex">
      <div className="hidden shell:block flex-none w-[232px] sticky top-0 h-screen z-20">
        <SideNav />
      </div>

      <main className="flex-1 min-w-0 flex flex-col">
        <MobileHeader />
        <div
          className="w-full max-w-content mx-auto flex-1 flex flex-col gap-4"
          style={{
            padding: '22px clamp(16px, 4vw, 36px) 40px',
            paddingLeft: 'max(clamp(16px, 4vw, 36px), env(safe-area-inset-left))',
            paddingRight: 'max(clamp(16px, 4vw, 36px), env(safe-area-inset-right))',
          }}
        >
          {children}
        </div>
        {/* Mobile tab-bar spacer */}
        <div className="shell:hidden h-[74px]" aria-hidden="true" />
      </main>

      <TabBar />
      <FeedbackFab />
    </div>
  );
}
