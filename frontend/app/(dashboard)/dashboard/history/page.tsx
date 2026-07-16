'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { pageContent } from '@/lib/page';
import type { HistoryEntry, SpringPage } from '@/lib/types';
import { bandDisplayName, getBandMeta } from '@/lib/types';
import { VortexLoader } from '@/components/VortexLoader';

interface ChartPoint {
  date: string;
  iso: string;
  score: number;
  band: string;
}

interface ChangeLogItem {
  delta: number;
  score: number;
  band: string;
  prevBand: string;
  date: string;
}

const RANGES = [30, 60, 90] as const;
type RangeDays = (typeof RANGES)[number];

const BAND_LINES = [
  { y: 300, label: 'Building ↑' },
  { y: 500, label: 'Strong ↑' },
  { y: 750, label: 'Ready ↑' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function filterByRange(entries: HistoryEntry[], days: RangeDays): HistoryEntry[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter((e) => e.recordedDate >= cutoffStr);
}

function buildChangeLog(entries: HistoryEntry[]): ChangeLogItem[] {
  const sorted = [...entries].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const changes: ChangeLogItem[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const delta = curr.overallScore - prev.overallScore;
    if (delta === 0 && curr.band === prev.band) continue;
    changes.push({
      delta,
      score: curr.overallScore,
      band: curr.band,
      prevBand: prev.band,
      date: curr.recordedDate,
    });
  }
  return changes.reverse();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const { score, band } = payload[0].payload as ChartPoint;
  const meta = getBandMeta(band);
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-dim mb-1">{label}</p>
      <p className="font-mono font-bold tabular-nums" style={{ color: meta.accent }}>
        {score}
      </p>
      <p style={{ color: meta.text }}>{bandDisplayName(band)}</p>
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<RangeDays>(90);

  useEffect(() => {
    api.get<SpringPage<HistoryEntry>>('/career-score/history?page=0&size=100')
      .then((res) => {
        if (res.success && res.data) setEntries(pageContent(res.data));
        else setError(res.error ?? 'Failed to load history');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => filterByRange(entries, range), [entries, range]);

  const chartData: ChartPoint[] = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
        .map((e) => ({
          date: formatDate(e.recordedDate),
          iso: e.recordedDate,
          score: e.overallScore,
          band: e.band,
        })),
    [filtered],
  );

  const changeLog = useMemo(() => buildChangeLog(filtered), [filtered]);

  const todayScore = chartData.length > 0 ? chartData[chartData.length - 1].score : null;
  const startScore = chartData.length > 0 ? chartData[0].score : null;
  const periodDelta =
    todayScore != null && startScore != null ? todayScore - startScore : null;

  if (loading) {
    return (
      <div className="max-w-score mx-auto w-full flex items-center justify-center min-h-[60vh]">
        <VortexLoader label="Loading history…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-score mx-auto w-full flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-error text-sm">{error}</p>
        <Link href="/dashboard" className="text-primary-lt text-sm">
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-score mx-auto w-full flex flex-col gap-4">
      {/* Header + range tabs */}
      <div className="flex items-end gap-3.5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h1 className="m-0 font-space font-semibold text-[21px]">Score history</h1>
          <div className="text-[13px] text-dim mt-0.5">
            {startScore != null && todayScore != null
              ? `${startScore} → ${todayScore} in ${range} days · every step explained below`
              : `Last ${range} days of readiness snapshots`}
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Range"
          className="flex bg-card border border-border rounded-[10px] p-[3px] gap-[3px]"
        >
          {RANGES.map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={range === n}
              onClick={() => setRange(n)}
              className="h-[34px] px-3.5 rounded-lg border-none font-sans text-[13px] font-semibold cursor-pointer transition-colors duration-200"
              style={{
                background: range === n ? '#7C3AED' : 'transparent',
                color: range === n ? '#FFFFFF' : '#A5B4C3',
              }}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-3xl mb-3" aria-hidden="true">
            📈
          </p>
          <p className="text-text font-medium">No history yet</p>
          <p className="text-muted text-sm mt-1">
            The nightly job (02:00 IST) snapshots your score daily. Check back tomorrow for your
            first data point.
          </p>
        </div>
      ) : (
        <>
          {/* Chart card */}
          <section
            aria-label={`Score over ${range} days`}
            className="bg-card border border-border rounded-2xl px-5 pt-5 pb-3"
          >
            <div className="flex gap-4 items-baseline flex-wrap">
              <div>
                <span className="font-mono font-bold text-[26px] text-primary-lt tabular-nums">
                  {todayScore}
                </span>
                <span className="text-[12.5px] text-dim ml-1.5">today</span>
              </div>
              {periodDelta != null && (
                <div
                  className="text-[13px] font-semibold"
                  style={{ color: periodDelta >= 0 ? '#34D399' : '#A5B4C3' }}
                >
                  {periodDelta >= 0 ? '▲' : '▼'} {Math.abs(periodDelta)} over {range} days
                </div>
              )}
              <div className="ml-auto flex gap-3.5 text-[11.5px] text-dim flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-[3px] rounded-sm bg-primary-hover"
                    aria-hidden="true"
                  />
                  Your score
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-[3px] rounded-sm bg-border" aria-hidden="true" />
                  Band edges
                </span>
              </div>
            </div>

            <div
              className="mt-2.5"
              role="img"
              aria-label={`Line chart of career readiness scores over ${range} days`}
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 5"
                    stroke="#22304A"
                    vertical={false}
                  />
                  {BAND_LINES.map((bl) => (
                    <ReferenceLine
                      key={bl.y}
                      y={bl.y}
                      stroke="#22304A"
                      strokeDasharray="3 5"
                      label={{
                        value: bl.label,
                        position: 'right',
                        fill: '#475569',
                        fontSize: 9.5,
                      }}
                    />
                  ))}
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748B', fontSize: 10.5 }}
                    tickLine={false}
                    axisLine={{ stroke: '#22304A' }}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    domain={[200, 800]}
                    ticks={[200, 300, 500, 750]}
                    tick={{ fill: '#64748B', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="none"
                    fill="url(#histGrad)"
                    fillOpacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    dot={{ r: 4.5, fill: '#0B1220', stroke: '#8B5CF6', strokeWidth: 2.5 }}
                    activeDot={{ r: 6, fill: '#0B1220', stroke: '#A78BFA', strokeWidth: 2.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="sr-only">
              <table>
                <caption>Career readiness score history</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Band</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.recordedDate}>
                      <td>{e.recordedDate}</td>
                      <td>{e.overallScore}</td>
                      <td>{e.band}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Change log */}
          {changeLog.length > 0 && (
            <section
              aria-label="Change log"
              className="bg-card border border-border rounded-[14px] px-5 py-[18px]"
            >
              <h2 className="m-0 font-space font-semibold text-[15px]">What moved the number</h2>
              <div className="flex flex-col mt-1.5">
                {changeLog.map((item, idx) => {
                  const bandChanged = item.band !== item.prevBand;
                  const title = bandChanged
                    ? `Crossed into ${bandDisplayName(item.band)}`
                    : `Score updated to ${item.score}`;
                  const sub = bandChanged
                    ? `${bandDisplayName(item.prevBand)} → ${bandDisplayName(item.band)}`
                    : `Daily snapshot · ${item.score} points`;
                  const deltaStr =
                    item.delta > 0 ? `+${item.delta}` : item.delta < 0 ? `${item.delta}` : '—';
                  const deltaColor =
                    item.delta > 0 ? '#34D399' : item.delta < 0 ? '#A5B4C3' : '#64748B';

                  return (
                    <div
                      key={item.date}
                      className="flex gap-3.5 items-baseline py-3 flex-wrap"
                      style={{ borderTop: idx === 0 ? 'none' : '1px solid #1B2740' }}
                    >
                      <span
                        className="flex-none w-[52px] font-mono text-[13.5px] font-semibold tabular-nums"
                        style={{ color: deltaColor }}
                      >
                        {deltaStr}
                      </span>
                      <span className="flex-1 min-w-[240px]">
                        <span className="block text-[13.5px] text-text">{title}</span>
                        <span className="block text-[12.5px] text-dim">{sub}</span>
                      </span>
                      <span className="flex-none text-xs text-dim">{formatWhen(item.date)}</span>
                    </div>
                  );
                })}
              </div>
              <div
                className="mt-2 pt-3 border-t border-inner text-[12.5px] text-dim"
                style={{ textWrap: 'pretty' }}
              >
                Dips are normal — quiet applications age out of momentum. The line that matters is
                the {range}-day one.
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
