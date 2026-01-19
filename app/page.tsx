import { redirect } from 'next/navigation';

// Server-side redirect to agents page - the main entry point
export default function Home() {
  redirect('/agents');
}
