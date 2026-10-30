import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { assertSameOrigin, handle, json, readBody, ApiError } from '@/lib/http';
import { apiUser, canWrite, workspaceFor } from '@/lib/auth/session';
import { startJob } from '@/lib/analysis/service';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  mode: z.enum(['quick', 'full', 'step']),
  kind: z.string().max(60).optional(),
  planId: z.string().nullable().optional(),
  notes: z.string().max(10000).default(''),
  referenceIds: z.array(z.string()).nullable().default(null),
  useLearning: z.boolean().default(true),
  audience: z.string().max(60).default('Executive team'),
  templateId: z.string().nullable().default(null),
});

export const POST = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id } = await ctx.params;
  await workspaceFor(user, id);
  const b = await readBody(request, Body);
  const out = await startJob(user.id, id, { mode: b.mode, kind: b.kind, options: { planId: b.planId ?? null, notes: b.notes, referenceIds: b.referenceIds, useLearning: b.useLearning, audience: b.audience, templateId: b.templateId } });
  return json(out, { status: 202 });
});

/** The most recent job, so the page can pick up progress after a reload. */
export const GET = handle(async (_request: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  await workspaceFor(user, id);
  const job = await prisma.analysisJob.findFirst({ where: { workspaceId: id }, orderBy: { createdAt: 'desc' } });
  return json({ job });
});
