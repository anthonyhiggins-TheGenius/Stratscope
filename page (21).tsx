import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { redirect } from 'next/navigation';
import { UsersAdmin } from '@/components/UsersAdmin';

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/workspaces');
  const [users, workspaces] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' }, include: { memberships: { select: { workspaceId: true } } } }),
    prisma.workspace.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <div className="page-title"><h1>Users</h1></div>
      <UsersAdmin
        me={user.id}
        workspaces={workspaces}
        users={users.map((u) => ({ id: u.id, username: u.username, role: u.role, isActive: u.isActive, workspaceIds: u.memberships.map((m) => m.workspaceId) }))}
      />
    </>
  );
}
