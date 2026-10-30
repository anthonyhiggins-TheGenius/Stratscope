import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, audit, canWrite } from '@/lib/auth/session';
import { analysisFor } from '@/lib/analysis/access';
import { PrismaStore } from '@/lib/db/store';
import { normEv } from '@/lib/domain/evidence';
import type { Rec } from '@/lib/domain/util';
import {
  actionsFromDiagnostic, actionsFromInterviews, actionsFromPlan, actionsFromRecommendations, dedupe, indicatorsFromPlan, metricsFromExtract, predictionsFromHorizon,
  risksFromExtract, servicesFromExtract, signalsFromExtract, signalsFromHorizon,
} from '@/lib/analysis/derive';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ action: z.enum(['services', 'risks', 'signals', 'metrics', 'predictions', 'actions', 'watch', 'service-feedback']) });

/** Copy findings from an analysis into the registers. Rows that already exist are skipped. */
export const POST = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id } = await ctx.params;
  const a = await analysisFor(user, id);
  const { action } = await readBody(request, Body);
  const d = (a.payload ?? {}) as Rec;
  const ws = a.workspaceId;
  const store = new PrismaStore(prisma);
  let count = 0;

  if (action === 'services') {
    const have = (await prisma.service.findMany({ where: { workspaceId: ws }, select: { name: true } })).map((x) => x.name);
    count = await store.addServices(ws, dedupe(servicesFromExtract(d), have, (x) => x.name));
  } else if (action === 'risks') {
    const have = (await prisma.risk.findMany({ where: { workspaceId: ws }, select: { title: true } })).map((x) => x.title);
    count = await store.addRisks(ws, dedupe(risksFromExtract(d), have, (x) => x.title));
  } else if (action === 'signals') {
    const have = (await prisma.signal.findMany({ where: { workspaceId: ws }, select: { title: true } })).map((x) => x.title);
    const rows = a.kind === 'extract' ? signalsFromExtract(d) : signalsFromHorizon(d);
    count = await store.addSignals(ws, dedupe(rows, have, (x) => x.title));
  } else if (action === 'metrics') {
    count = await store.upsertMetrics(ws, metricsFromExtract(d));
  } else if (action === 'predictions') {
    const have = (await prisma.prediction.findMany({ where: { workspaceId: ws }, select: { text: true } })).map((x) => x.text);
    count = await store.addPredictions(ws, dedupe(predictionsFromHorizon(d), have, (x) => x.text));
  } else if (action === 'actions') {
    const rows = a.kind === 'recommend' ? actionsFromRecommendations(d) : a.kind === 'interviews' ? actionsFromInterviews(d) : a.kind === 'diagnostic' ? actionsFromDiagnostic(d) : a.kind === 'plantable' ? actionsFromPlan(d) : [];
    const have = (await prisma.action.findMany({ where: { workspaceId: ws }, select: { action: true } })).map((x) => x.action);
    count = await store.addActions(ws, dedupe(rows, have, (x) => x.action));
  } else if (action === 'watch') {
    const have = (await prisma.watchItem.findMany({ where: { workspaceId: ws }, select: { indicator: true } })).map((x) => x.indicator);
    const rows = dedupe(indicatorsFromPlan(d), have, (x) => x.indicator);
    if (rows.length) await prisma.watchItem.createMany({ data: rows.map((r) => ({ ...r, workspaceId: ws })) });
    count = rows.length;
  } else {
    const services = await prisma.service.findMany({ where: { workspaceId: ws } });
    for (const f of (d.service_feedback ?? []) as Rec[]) {
      const nn = normEv(f.service);
      if (!nn) continue;
      const data = { stage: 'Feedback collected', feedback: String(f.feedback ?? '').slice(0, 600), sentiment: ['Positive', 'Neutral', 'Negative', 'Mixed'].includes(f.sentiment) ? f.sentiment : 'Neutral' };
      const ex = services.find((s) => { const sn = normEv(s.name); return sn && (sn === nn || sn.includes(nn) || nn.includes(sn)); });
      if (ex) await prisma.service.update({ where: { id: ex.id }, data: { ...data, isNew: false } });
      else await prisma.service.create({ data: { ...data, name: String(f.service).slice(0, 200), workspaceId: ws, isNew: true } });
      count++;
    }
  }
  await audit(user.id, `apply.${action}`, id);
  return json({ count });
});
