import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, canWrite, workspaceFor } from '@/lib/auth/session';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ areas: z.array(z.enum(['analyses', 'actions', 'risks', 'services', 'signals', 'metrics', 'predictions'])).min(1) });

/** Clear the "new" markers on everything in the chosen areas. */
export const POST = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id } = await ctx.params;
  await workspaceFor(user, id);
  const { areas } = await readBody(request, Body);
  const where = { workspaceId: id, isNew: true };
  const data = { isNew: false };
  let n = 0;
  for (const a of areas) {
    const r =
      a === 'analyses' ? await prisma.analysis.updateMany({ where, data })
      : a === 'actions' ? await prisma.action.updateMany({ where, data })
      : a === 'risks' ? await prisma.risk.updateMany({ where, data })
      : a === 'services' ? await prisma.service.updateMany({ where, data })
      : a === 'signals' ? await prisma.signal.updateMany({ where, data })
      : a === 'metrics' ? await prisma.metric.updateMany({ where, data })
      : await prisma.prediction.updateMany({ where, data });
    n += r.count;
  }
  return json({ count: n });
});
