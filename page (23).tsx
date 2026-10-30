import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { requireUser, canWrite } from '@/lib/auth/session';
import { NewWorkspace } from '@/components/NewWorkspace';

export default async function WorkspacesPage() {
  const user = await requireUser();
  const list = await prisma.workspace.findMany({
    where: user.role === 'admin' ? {} : { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: 'desc' },
  });
  return (
    <>
      <div className="page-title"><h1>Workspaces</h1>{canWrite(user) ? <NewWorkspace /> : null}</div>
      {list.length ? (
        <div className="grid">
          {list.map((w) => (
            <Link key={w.id} href={`/workspaces/${w.id}/overview`} className="card ws-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row spread"><span className="badge info">{w.tier}</span><span className="badge ok">{w.status}</span></div>
              <h3>{w.name}</h3>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">No workspaces{user.role === 'viewer' ? '. Ask an admin to give you access' : ''}</div>
      )}
    </>
  );
}
