import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json } from '@/lib/http';
import { apiUser, audit, canWrite } from '@/lib/auth/session';
import { extractText, FileError, MAX_TEXT_CHARS } from '@/lib/files/extract';

export const runtime = 'nodejs';
const KINDS = ['Framework', 'Template', 'Briefing', 'Reference'];

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const form = await request.formData();
  const file = form.get('file');
  let name = String(form.get('name') ?? '').trim().slice(0, 200);
  let text = String(form.get('text') ?? '');
  const kind = String(form.get('kind') ?? 'Framework');
  if (file instanceof File && file.size > 0) {
    try {
      text = (await extractText(file.name, new Uint8Array(await file.arrayBuffer()))).text;
      name = name || file.name;
    } catch (e) {
      if (e instanceof FileError) throw new ApiError(400, e.message, e.code);
      throw e;
    }
  }
  if (!name) throw new ApiError(400, 'Give the document a name');
  if (text.trim().length < 20) throw new ApiError(400, 'No text found. Paste the text instead');
  const row = await prisma.libraryDoc.create({ data: { name, kind: KINDS.includes(kind) ? kind : 'Reference', text: text.slice(0, MAX_TEXT_CHARS), chars: text.length } });
  await audit(user.id, 'library.add', row.id);
  return json({ id: row.id }, { status: 201 });
});
