import { assertSameOrigin, handle, json } from '@/lib/http';
import { destroySession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  await destroySession();
  return json({ ok: true });
});
