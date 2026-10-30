import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, audit, canWrite, requireRole } from '@/lib/auth/session';

export const runtime = 'nodejs';
const Body = z.object({ name: z.string().trim().min(1).max(150), tier: z.enum(['Enterprise', 'Standard', 'Trial']).default('Standard') });

export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) requireRole(user, 'admin', 'user');
  const body = await readBody(request, Body);
  const ws = await prisma.workspace.create({ data: { name: body.name, tier: body.tier, ...(user.role === 'admin' ? {} : { memberships: { create: { userId: user.id } } }) } });
  await audit(user.id, 'workspace.create', ws.id);
  return json({ id: ws.id }, { status: 201 });
});
