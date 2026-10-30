import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, audit, requireRole } from '@/lib/auth/session';
import { hashPassword, validatePassword } from '@/lib/auth/password';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().max(300).optional(),
  workspaceIds: z.array(z.string()).optional(),
});

async function activeAdmins() {
  return prisma.user.count({ where: { role: 'admin', isActive: true } });
}

/** Change a person's role, switch their account on or off, reset their password or set which workspaces they can open. */
export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  requireRole(user, 'admin');
  const { id } = await ctx.params;
  const b = await readBody(request, Body);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, 'User not found');
  const losesAdmin = target.role === 'admin' && target.isActive && ((b.role && b.role !== 'admin') || b.isActive === false);
  if (losesAdmin && (await activeAdmins()) <= 1) throw new ApiError(400, 'At least one active admin is required');
  if (b.isActive === false && target.id === user.id) throw new ApiError(400, 'You cannot deactivate your own account');
  const data: Record<string, unknown> = {};
  if (b.role) data.role = b.role;
  if (b.isActive !== undefined) data.isActive = b.isActive;
  if (b.password !== undefined) {
    const bad = validatePassword(b.password);
    if (bad) throw new ApiError(400, bad);
    data.passwordHash = await hashPassword(b.password);
  }
  if (Object.keys(data).length) await prisma.user.update({ where: { id }, data });
  if (b.isActive === false || b.password !== undefined) await prisma.session.deleteMany({ where: { userId: id } });
  if (b.workspaceIds) {
    await prisma.membership.deleteMany({ where: { userId: id } });
    if (b.workspaceIds.length) await prisma.membership.createMany({ data: b.workspaceIds.map((workspaceId) => ({ userId: id, workspaceId })) });
  }
  await audit(user.id, 'user.update', id);
  return json({ ok: true });
});
