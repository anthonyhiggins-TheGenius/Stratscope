import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, canWrite, workspaceFor } from '@/lib/auth/session';
import { cancelJob } from '@/lib/analysis/service';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string; jobId: string }> };

export const GET = handle(async (_request: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id, jobId } = await ctx.params;
  await workspaceFor(user, id);
  const job = await prisma.analysisJob.findFirst({ where: { id: jobId, workspaceId: id } });
  if (!job) throw new ApiError(404, 'Not found');
  return json({ job });
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id, jobId } = await ctx.params;
  await workspaceFor(user, id);
  return json({ cancelled: cancelJob(jobId) });
});
