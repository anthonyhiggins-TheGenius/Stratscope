import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, audit, canWrite, workspaceFor } from '@/lib/auth/session';
import { extractText, FileError, MAX_TEXT_CHARS } from '@/lib/files/extract';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
const IV_KINDS = ['Interview', 'Focus group', 'Survey', 'Staff session', 'Customer feedback'];

/** Add a plan or an interview, from an uploaded file or pasted text. */
export const POST = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id } = await ctx.params;
  await workspaceFor(user, id);
  const form = await request.formData();
  const kind = String(form.get('kind') ?? 'plan');
  if (kind !== 'plan' && kind !== 'interview') throw new ApiError(400, 'Unknown document type');
  const file = form.get('file');
  let name = String(form.get('name') ?? '').trim().slice(0, 200);
  let text = String(form.get('text') ?? '');
  if (file instanceof File && file.size > 0) {
    try {
      const out = await extractText(file.name, new Uint8Array(await file.arrayBuffer()));
      text = out.text;
      name = name || file.name;
    } catch (e) {
      if (e instanceof FileError) throw new ApiError(400, e.message, e.code);
      throw e;
    }
  }
  if (!name) throw new ApiError(400, 'Give the document a name');
  if (text.trim().length < 20) throw new ApiError(400, 'No text found. Paste the text instead');
  const chars = text.length;
  const body = text.slice(0, MAX_TEXT_CHARS);
  if (kind === 'plan') {
    const row = await prisma.plan.create({ data: { workspaceId: id, name, text: body, chars, truncated: chars > MAX_TEXT_CHARS } });
    await audit(user.id, 'plan.add', row.id);
    return json({ id: row.id, kind }, { status: 201 });
  }
  const ik = String(form.get('interviewKind') ?? 'Interview');
  const row = await prisma.interview.create({ data: { workspaceId: id, name, kind: IV_KINDS.includes(ik) ? ik : 'Interview', text: body, chars } });
  await audit(user.id, 'interview.add', row.id);
  return json({ id: row.id, kind }, { status: 201 });
});
