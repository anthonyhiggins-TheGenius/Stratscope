import { NextResponse } from 'next/server';
import { ApiError, handle } from '@/lib/http';
import { apiUser } from '@/lib/auth/session';
import { analysisFor, evidenceSourcesFor } from '@/lib/analysis/access';
import { prisma } from '@/lib/db/prisma';
import { evidenceReport } from '@/lib/domain/evidence';
import { planXlsx } from '@/lib/export/xlsx';
import { markdownDocx, planDocx } from '@/lib/export/docx';
import type { Rec } from '@/lib/domain/util';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const safeName = (s: string) => (s.replace(/\.[^.]+$/, '').replace(/[^\w .-]/g, '').trim() || 'strategic plan');

function file(body: Uint8Array | Buffer, name: string, type: string) {
  return new NextResponse(body as unknown as BodyInit, { headers: { 'content-type': type, 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
}

export const GET = handle(async (request: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const a = await analysisFor(user, id);
  const format = new URL(request.url).searchParams.get('format') ?? '';
  const d = (a.payload ?? {}) as Rec;
  const base = safeName(String(d.title || a.planName));

  if (a.kind === 'plantable' && format === 'xlsx') {
    const recAnalysis = await prisma.analysis.findFirst({ where: { workspaceId: a.workspaceId, planId: a.planId, kind: 'recommend' }, orderBy: { createdAt: 'desc' } });
    const recs = (((recAnalysis?.payload ?? {}) as Rec).recommendations ?? []) as Rec[];
    const evidence = evidenceReport(await evidenceSourcesFor(a), d);
    return file(planXlsx(d, recs, evidence), `${base}.xlsx`, XLSX);
  }
  if (a.kind === 'plantable' && format === 'docx') return file(await planDocx(d), `${base}.docx`, DOCX);
  if ((a.kind === 'report' || a.kind === 'newplan') && format === 'docx') return file(await markdownDocx(a.text ?? ''), `${safeName(a.planName)} - ${a.label}.docx`, DOCX);
  throw new ApiError(400, 'That format is not available for this result');
});
