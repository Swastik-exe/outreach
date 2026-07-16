'use client';

/**
 * Vortex loader — purple outer arc (CW 0.9s) + teal inner arc (CCW 1.5s).
 * Matches design-reference/Vortex.dc.html. Honours prefers-reduced-motion via CSS.
 */
type VortexSize = 'xl' | 'lg' | 'sm' | number;

const SIZE_CFG: Record<'xl' | 'lg' | 'sm', { px: number; swOuter: number; swInner: number; labelSize: string; gap: string }> = {
  xl: { px: 64, swOuter: 3.4, swInner: 3.0, labelSize: '15px', gap: '16px' },
  lg: { px: 44, swOuter: 3.8, swInner: 3.3, labelSize: '13.5px', gap: '13px' },
  sm: { px: 18, swOuter: 5, swInner: 4.4, labelSize: '12px', gap: '8px' },
};

function resolveSize(size: VortexSize) {
  if (typeof size === 'number') {
    return { px: size, swOuter: 3.8, swInner: 3.3, labelSize: '13.5px', gap: '13px' };
  }
  return SIZE_CFG[size] ?? SIZE_CFG.lg;
}

export function VortexLoader({
  size = 'lg',
  label = 'Loading…',
}: {
  size?: VortexSize;
  label?: string;
}) {
  const cfg = resolveSize(size);
  const aria = label || 'Loading';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={aria}
      className="flex flex-col items-center justify-center"
      style={{ gap: cfg.gap }}
    >
      <div className="relative" style={{ width: cfg.px, height: cfg.px }}>
        <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 w-full h-full">
          <circle
            cx="24"
            cy="24"
            r="19"
            fill="none"
            stroke="#22304A"
            strokeWidth={cfg.swOuter}
            opacity={0.55}
          />
        </svg>
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full vortex-spin-cw"
        >
          <circle
            cx="24"
            cy="24"
            r="19"
            fill="none"
            stroke="#7C3AED"
            strokeWidth={cfg.swOuter}
            strokeLinecap="round"
            strokeDasharray="34 85.4"
            transform="rotate(-90 24 24)"
          />
        </svg>
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full vortex-spin-ccw"
        >
          <circle
            cx="24"
            cy="24"
            r="12"
            fill="none"
            stroke="#2DD4BF"
            strokeWidth={cfg.swInner}
            strokeLinecap="round"
            strokeDasharray="17 58.4"
            opacity={0.9}
            transform="rotate(90 24 24)"
          />
        </svg>
      </div>
      {label ? (
        <div
          className="font-medium text-center text-muted tracking-[0.01em]"
          style={{ fontSize: cfg.labelSize }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg flex items-center justify-center">
      <VortexLoader size="lg" label="Loading your dashboard…" />
    </div>
  );
}
