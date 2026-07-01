/** Fallback pricing if API unavailable (must match backend PlanConfig defaults). */
export const DEFAULT_PRICING = {
  seasonPass: { amountInr: 499, label: 'Season Pass', oneTime: true, months: 6 },
  monthly: { amountInr: 199, label: 'Premium Monthly', oneTime: false },
  annual: { amountInr: 1499, label: 'Premium Annual', oneTime: false, perMonthInr: 125 },
} as const;

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Charm pricing display: ₹499 → "₹499" with optional strikethrough anchor */
export function charmPrice(amount: number): string {
  return formatInr(amount);
}

export function planLabel(tier: string): string {
  switch (tier) {
    case 'pass_holder': return 'Season Pass';
    case 'premium': return 'Premium';
    case 'admin': return 'Admin';
    default: return 'Free';
  }
}
