import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, audit, canWrite, workspaceFor } from '@/lib/auth/session';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string; docId: string }> };

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id, docId } = await ctx.params;
  await workspaceFor(user, id);
  const a = await prisma.plan.deleteMany({ where: { id: docId, workspaceId: id } });
  const b = a.count ? { count: 0 } : await prisma.interview.deleteMany({ where: { id: docId, workspaceId: id } });
  if (!a.count && !b.count) throw new ApiError(404, 'Not found');
  await audit(user.id, 'document.delete', docId);
  return json({ ok: true });
});
