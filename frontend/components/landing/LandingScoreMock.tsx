/** Static hero score card — matches design-reference/Landing.dc.html (no ring-draw animation). */
export function LandingScoreMock() {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-[400px] bg-card border border-border rounded-[18px] p-[26px] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-purple.svg" alt="" width={18} height={18} />
        <span className="text-[11px] font-semibold tracking-[0.09em] uppercase text-dim">
          Career Health Score
        </span>
      </div>

      <div className="flex gap-[22px] items-center mt-[18px] flex-wrap">
        <div className="relative w-[140px] h-[140px] shrink-0">
          <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke="#22304A"
              strokeWidth="10"
              opacity="0.55"
            />
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="230.7 377"
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono font-bold text-[36px] leading-none text-primary-lt">612</div>
            <div className="font-mono text-[11px] text-dim mt-1">of 1000</div>
          </div>
        </div>

        <div className="flex-1 min-w-[140px] flex flex-col gap-2.5">
          <span className="self-start inline-flex items-center gap-1.5 px-[11px] py-1 rounded-full whitespace-nowrap bg-primary/[0.12] border border-primary/[0.32] text-xs font-semibold text-primary-lt">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
            Strong
          </span>

          <div className="flex flex-col gap-[7px]">
            {[
              { width: '67%', label: '168' },
              { width: '57%', label: '142' },
              { width: '59%', label: '118' },
            ].map((bar) => (
              <div key={bar.label} className="flex items-center gap-2">
                <span className="flex-1 h-1 rounded-sm bg-inner overflow-hidden">
                  <span
                    className="block h-full bg-primary-hover"
                    style={{ width: bar.width }}
                  />
                </span>
                <span className="font-mono text-[11px] text-muted">{bar.label}</span>
              </div>
            ))}
          </div>

          <div className="text-xs font-semibold text-success-lt">▲ 120 this week</div>
        </div>
      </div>

      <div className="mt-[18px] border-t border-border pt-3.5 flex gap-2.5 items-start">
        <span className="shrink-0 w-[26px] h-[26px] rounded-lg bg-primary/[0.18] flex items-center justify-center">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A78BFA"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13 2 4.5 13.5h6L11 22l8.5-11.5h-6L13 2Z" />
          </svg>
        </span>
        <span className="text-[12.5px] text-muted text-pretty">
          <span className="text-text font-semibold">Next action:</span> add outcomes to two resume
          bullets · est.{' '}
          <span className="font-mono text-success-lt">+22</span>
        </span>
      </div>
    </div>
  );
}
