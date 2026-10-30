import { prisma } from '@/lib/db/prisma';
import { assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, audit, requireRole, workspaceFor } from '@/lib/auth/session';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  requireRole(user, 'admin');
  const { id } = await ctx.params;
  await workspaceFor(user, id);
  await prisma.workspace.delete({ where: { id } });
  await audit(user.id, 'workspace.delete', id);
  return json({ ok: true });
});
