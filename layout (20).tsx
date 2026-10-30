import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { HeaderActions } from '@/components/HeaderActions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <Link href="/workspaces" className="brand" style={{ textDecoration: 'none' }}>
            <svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true">
              <rect y="0" width="24" height="4" rx="1" fill="#9db2c0" />
              <rect y="7" width="17" height="4" rx="1" fill="#6bb7d4" />
              <rect y="14" width="10" height="4" rx="1" fill="#f2b400" />
            </svg>
            <span>StratScope</span>
          </Link>
          <HeaderActions username={user.username} role={user.role} />
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
