import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, audit, canWrite } from '@/lib/auth/session';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ docId: string }> };

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { docId } = await ctx.params;
  await prisma.libraryDoc.delete({ where: { id: docId } }).catch(() => { throw new ApiError(404, 'Not found'); });
  await audit(user.id, 'library.delete', docId);
  return json({ ok: true });
});
