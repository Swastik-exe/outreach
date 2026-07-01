'use client';

/**
 * Minimal branded loader — a pulsing Outreach "O" ring.
 * Replace with the real VortexLoader asset once available.
 */
export function VortexLoader({ size = 48, label = 'Loading…' }: { size?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col items-center justify-center gap-3"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="animate-spin"
        style={{ animationDuration: '1.4s' }}
      >
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="#2A2D36"
          strokeWidth="4"
          fill="none"
        />
        <path
          d="M24 4 a20 20 0 0 1 20 20"
          stroke="#6366F1"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="text-sm text-[#8B8FA8] font-medium">{label}</span>
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen bg-[#0A0B0E] flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-bold text-white tracking-tight mb-6">
          out<span className="text-indigo-400">reach</span>
        </div>
        <VortexLoader label="Loading your dashboard…" />
      </div>
    </div>
  );
}
