import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, audit, canWrite, workspaceFor } from '@/lib/auth/session';
import { extractText, FileError } from '@/lib/files/extract';
import { parseMetricsText } from '@/lib/domain/metrics-import';
import { PrismaStore } from '@/lib/db/store';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

/** Import metric series from a CSV or Excel file, or from pasted text. */
export const POST = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id } = await ctx.params;
  await workspaceFor(user, id);
  const form = await request.formData();
  const file = form.get('file');
  let text = String(form.get('text') ?? '');
  let label = 'Pasted';
  if (file instanceof File && file.size > 0) {
    try {
      text = (await extractText(file.name, new Uint8Array(await file.arrayBuffer()))).text;
      label = file.name;
    } catch (e) {
      if (e instanceof FileError) throw new ApiError(400, e.message, e.code);
      throw e;
    }
  }
  const series = parseMetricsText(text, label.replace(/\.[^.]+$/, ''));
  if (!series.length) throw new ApiError(400, 'No metric series found. Use columns Metric, Period, Value or periods across the top');
  const count = await new PrismaStore(prisma).upsertMetrics(id, series.map((m) => ({ ...m, source: label })));
  await audit(user.id, 'figures.import', id);
  return json({ count });
});
