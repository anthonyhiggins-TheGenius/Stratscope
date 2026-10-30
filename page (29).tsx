import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await currentUser()) redirect('/workspaces');
  return (
    <main className="login-wrap">
      <div className="card login-card">
        <h1 style={{ marginBottom: 20 }}>Sign in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
