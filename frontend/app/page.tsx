import { redirect } from 'next/navigation';

// Root → redirect to dashboard; the dashboard layout handles auth guard
export default function Home() {
  redirect('/dashboard');
}
