'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isPlatformAdmin } from '@/lib/jwt';
import { tokenStore } from '@/lib/api';
import type { AdminFeedbackItem, AdminStatsResponse, SpringPage } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = tokenStore.get();
    if (!isPlatformAdmin(token)) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setAllowed(true);

    (async () => {
      const statsRes = await api.get<AdminStatsResponse>('/admin/stats');
      if (!statsRes.success) {
        setError(statsRes.error ?? 'Failed to load stats');
        setLoading(false);
        return;
      }
      setStats(statsRes.data ?? null);

      const fbRes = await api.get<SpringPage<AdminFeedbackItem>>('/admin/feedback?page=0&size=50');
      if (fbRes.success && fbRes.data?.content) {
        setFeedback(fbRes.data.content);
      }
      setLoading(false);
    })();
  }, []);

  const suspend = async (userId: string) => {
    if (!confirm('Suspend this user?')) return;
    const res = await api.post(`/admin/users/${userId}/suspend`, {});
    if (res.success) {
      setActionMsg(`User ${userId.slice(0, 8)}… suspended`);
    } else {
      setActionMsg(res.error ?? 'Suspend failed');
    }
  };

  if (allowed === false) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold text-[#F4F5F7] mb-2">Access denied</h1>
        <p className="text-[#8B8FA8] mb-6">Platform admin role required.</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="min-h-[44px] px-4 rounded-lg bg-indigo-600 text-white focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-[#8B8FA8] py-8" role="status">Loading admin dashboard…</p>;
  }

  if (error) {
    return <p className="text-red-400 py-8" role="alert">{error}</p>;
  }

  const cards = stats
    ? [
        { label: 'AI cost today', value: `$${Number(stats.aiCostToday).toFixed(4)}` },
        { label: 'Active users today', value: String(stats.activeUsersToday) },
        { label: 'Revenue this month', value: `₹${stats.revenueThisMonthInr}` },
        { label: 'Failed jobs', value: String(stats.failedJobs) },
        { label: 'System status', value: stats.systemStatus },
      ]
    : [];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-[#F4F5F7]">Admin</h1>
        <p className="text-sm text-[#8B8FA8] mt-1">Platform metrics and feedback inbox</p>
      </div>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Platform stats</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {cards.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-[#2A2D36] bg-[#111318] p-4 min-w-0"
            >
              <p className="text-xs text-[#8B8FA8] truncate">{label}</p>
              <p className="text-lg sm:text-xl font-semibold text-[#F4F5F7] mt-1 truncate font-mono">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {actionMsg && (
        <p className="text-sm text-indigo-400" role="status">{actionMsg}</p>
      )}

      <section aria-labelledby="feedback-heading">
        <h2 id="feedback-heading" className="text-lg font-semibold text-[#F4F5F7] mb-3">
          Feedback inbox
        </h2>
        {feedback.length === 0 ? (
          <p className="text-[#8B8FA8] text-sm">No feedback yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#2A2D36]">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-[#1A1D24] text-[#8B8FA8] text-left">
                <tr>
                  <th className="p-3 font-medium">When</th>
                  <th className="p-3 font-medium">User</th>
                  <th className="p-3 font-medium">Screen</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Message</th>
                  <th className="p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D36]">
                {feedback.map((fb) => (
                  <tr key={fb.id} className="bg-[#111318]">
                    <td className="p-3 text-[#8B8FA8] whitespace-nowrap">
                      {new Date(fb.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-[#F4F5F7] max-w-[120px] truncate">
                      {fb.userEmail ?? '—'}
                    </td>
                    <td className="p-3 font-mono text-xs text-[#8B8FA8] max-w-[100px] truncate">
                      {fb.screen ?? '—'}
                    </td>
                    <td className="p-3 capitalize">{fb.type}</td>
                    <td className="p-3 text-[#F4F5F7] max-w-[200px] truncate" title={fb.message}>
                      {fb.message}
                    </td>
                    <td className="p-3">
                      {fb.userId && (
                        <button
                          type="button"
                          onClick={() => suspend(fb.userId!)}
                          className={cn(
                            'min-h-[44px] px-3 rounded-md text-xs font-medium',
                            'bg-red-900/40 text-red-300 hover:bg-red-900/60',
                            'focus-visible:ring-2 focus-visible:ring-red-500',
                          )}
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
