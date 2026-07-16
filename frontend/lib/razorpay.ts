declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export interface RazorpayOpenOptions {
  key: string;
  amountInr: number;
  currency: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  email?: string;
  name?: string;
  onSuccess: () => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(opts: RazorpayOpenOptions): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay not available');

  const options: Record<string, unknown> = {
    key: opts.key,
    amount: opts.amountInr * 100,
    currency: opts.currency,
    name: 'Outreach',
    description: 'Career platform subscription',
    prefill: { email: opts.email, name: opts.name ?? 'Outreach User' },
    theme: { color: '#7C3AED' },
    handler: () => opts.onSuccess(),
    modal: { ondismiss: () => opts.onDismiss?.() },
  };

  if (opts.orderId) options.order_id = opts.orderId;
  if (opts.subscriptionId) options.subscription_id = opts.subscriptionId;

  new window.Razorpay(options).open();
}
