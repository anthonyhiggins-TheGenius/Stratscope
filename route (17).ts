import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, canWrite } from '@/lib/auth/session';
import { analysisFor } from '@/lib/analysis/access';
import { asList, type Rec } from '@/lib/domain/util';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ key: z.string().regex(/^(r\d+|o\d+\.\d+)$/), verdict: z.enum(['accepted', 'rejected']), note: z.string().max(300).default('') });

/** The text a review key refers to: r3 is the fourth recommendation, o1.0 the first objective of the second outcome. */
function textFor(payload: Rec, key: string): string {
  if (key.startsWith('r')) return String(asList(payload.recommendations)[Number(key.slice(1))]?.action ?? '');
  const [oi, ji] = key.slice(1).split('.').map(Number);
  return String(asList(asList(payload.outcomes)[oi as number]?.objectives)[ji as number]?.objective ?? '');
}

export const POST = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id } = await ctx.params;
  const a = await analysisFor(user, id);
  const { key, verdict, note } = await readBody(request, Body);
  const text = textFor((a.payload ?? {}) as Rec, key);
  if (!text) throw new ApiError(400, 'Nothing to review there');
  const reviews = { ...((a.reviews ?? {}) as Record<string, string>), [key]: verdict };
  await prisma.analysis.update({ where: { id }, data: { reviews, isNew: false } });
  const kind = key.startsWith('r') ? 'recommendation' : 'objective';
  const fbKey = `${id}:${key}`;
  await prisma.feedback.upsert({
    where: { workspaceId_key: { workspaceId: a.workspaceId, key: fbKey } },
    create: { workspaceId: a.workspaceId, key: fbKey, kind, text: text.slice(0, 300), verdict, note, analysisId: id },
    update: { verdict, note, text: text.slice(0, 300) },
  });
  return json({ ok: true });
});
