declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
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

export async function openRazorpayCheckout(checkout: RazorpayOpenOptions): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay not available');

  const razorpayOptions: Record<string, unknown> = {
    key: checkout.key,
    amount: checkout.amountInr * 100,
    currency: checkout.currency,
    name: 'Outreach',
    description: 'Career platform subscription',
    prefill: { email: checkout.email, name: checkout.name ?? 'Outreach User' },
    theme: { color: '#7C3AED' },
    handler: () => checkout.onSuccess(),
    modal: { ondismiss: () => checkout.onDismiss?.() },
  };

  if (checkout.orderId) razorpayOptions.order_id = checkout.orderId;
  if (checkout.subscriptionId) razorpayOptions.subscription_id = checkout.subscriptionId;

  new window.Razorpay(razorpayOptions).open();
}
