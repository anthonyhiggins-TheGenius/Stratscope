import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { DUMMY_HASH_PROMISE, verifyPassword } from '@/lib/auth/password';
import { clearFailures, isLocked, recordFailure } from '@/lib/auth/tokens';
import { audit, createSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
const Body = z.object({ username: z.string().min(1).max(150), password: z.string().min(1).max(300) });

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { username, password } = await readBody(request, Body);
  const name = username.trim().toLowerCase();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const key = `${ip}:${name}`;
  if (isLocked(key)) throw new ApiError(429, 'Too many attempts. Try again in 15 minutes');
  const user = await prisma.user.findUnique({ where: { username: name } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH_PROMISE));
  if (!user || !ok || !user.isActive) {
    recordFailure(key);
    throw new ApiError(401, 'Invalid username or password');
  }
  clearFailures(key);
  await createSession(user.id);
  await audit(user.id, 'login');
  return json({ ok: true });
});
