import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, audit, requireRole } from '@/lib/auth/session';
import { hashPassword, validatePassword } from '@/lib/auth/password';

export const runtime = 'nodejs';
const Body = z.object({ username: z.string().trim().min(1).max(150), password: z.string().max(300), role: z.enum(['admin', 'user', 'viewer']).default('user') });

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const user = await apiUser();
  requireRole(user, 'admin');
  const b = await readBody(request, Body);
  const bad = validatePassword(b.password);
  if (bad) throw new ApiError(400, bad);
  const username = b.username.toLowerCase();
  if (await prisma.user.findUnique({ where: { username } })) throw new ApiError(409, 'Username already exists');
  const row = await prisma.user.create({ data: { username, passwordHash: await hashPassword(b.password), role: b.role } });
  await audit(user.id, 'user.create', row.id);
  return json({ id: row.id }, { status: 201 });
});
