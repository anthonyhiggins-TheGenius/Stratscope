import Link from 'next/link';
import { requireUser, workspaceFor } from '@/lib/auth/session';
import { ApiError } from '@/lib/http';
import { notFound } from 'next/navigation';
import { WorkspaceNav } from '@/components/WorkspaceNav';
import { DeleteWorkspace } from '@/components/DeleteWorkspace';

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ws = await workspaceFor(user, id).catch((e) => { if (e instanceof ApiError) return null; throw e; });
  if (!ws) notFound();
  return (
    <div className="ws">
      <aside className="rail">
        <Link className="btn link rail-back" href="/workspaces">&larr; Workspaces</Link>
        <div className="rail-head"><h1>{ws.name}</h1><span className="badge">{ws.tier}</span></div>
        <WorkspaceNav id={ws.id} />
        {user.role === 'admin' ? <div><DeleteWorkspace id={ws.id} name={ws.name} /></div> : null}
      </aside>
      <div className="ws-main">{children}</div>
    </div>
  );
}
