'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { pageContent } from '@/lib/page';
import type { HistoryEntry, SpringPage } from '@/lib/types';
import { getBandMeta } from '@/lib/types';
import { VortexLoader } from '@/components/VortexLoader';

interface ChartPoint {
  date: string;       // display label
  score: number;
  band: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const { score, band } = payload[0].payload as ChartPoint;
  const meta = getBandMeta(band);
  return (
    <div className="bg-[#1A1D24] border border-[#2A2D36] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#8B8FA8] mb-1">{label}</p>
      <p className="font-mono font-bold" style={{ color: meta.accent }}>{score}</p>
      <p className={meta.color}>{band}</p>
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<SpringPage<HistoryEntry>>('/career-score/history?page=0&size=100')
      .then((res) => {
        if (res.success && res.data) setEntries(pageContent(res.data));
        else setError(res.error ?? 'Failed to load history');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <VortexLoader label="Loading history…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/dashboard" className="text-indigo-400 text-sm">← Back</Link>
      </div>
    );
  }

  const chartData: ChartPoint[] = entries.map((e) => ({
    date: formatDate(e.recordedDate),
    score: e.overallScore,
    band: e.band,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Score History</h1>
        <p className="text-[#8B8FA8] text-sm mt-1">Last 90 days of readiness snapshots</p>
      </div>

      {chartData.length === 0 ? (
        <div className="bg-[#111318] border border-[#2A2D36] rounded-2xl p-12 text-center">
          <p className="text-3xl mb-3">📈</p>
          <p className="text-[#F4F5F7] font-medium">No history yet</p>
          <p className="text-[#8B8FA8] text-sm mt-1">
            The nightly job (02:00 IST) snapshots your score daily.
            Check back tomorrow for your first data point.
          </p>
        </div>
      ) : (
        <div className="bg-[#111318] border border-[#2A2D36] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-[#8B8FA8] mb-6">Score over time (0–1000)</h2>
          <div
            role="img"
            aria-label={`Line chart of career readiness scores from ${chartData[0]?.date} to ${chartData[chartData.length - 1]?.date}`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2D36" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8B8FA8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2D36' }}
                />
                <YAxis
                  domain={[0, 1000]}
                  tick={{ fill: '#8B8FA8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2D36' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#6366F1', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#818CF8', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Table for screen readers */}
          <div className="sr-only">
            <table>
              <caption>Career readiness score history</caption>
              <thead>
                <tr><th>Date</th><th>Score</th><th>Band</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.recordedDate}>
                    <td>{e.recordedDate}</td>
                    <td>{e.overallScore}</td>
                    <td>{e.band}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
