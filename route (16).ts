import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, audit, canWrite } from '@/lib/auth/session';
import { analysisFor } from '@/lib/analysis/access';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id } = await ctx.params;
  await analysisFor(user, id);
  await prisma.analysis.delete({ where: { id } });
  await audit(user.id, 'analysis.delete', id);
  return json({ ok: true });
});
