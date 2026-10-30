import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, audit, canWrite, workspaceFor } from '@/lib/auth/session';
import { RESOURCES, isResource } from '@/lib/resources';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string; resource: string; rowId: string }> };

async function prepare(request: Request, ctx: Ctx) {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id, resource, rowId } = await ctx.params;
  if (!isResource(resource)) throw new ApiError(404, 'Unknown table');
  await workspaceFor(user, id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[RESOURCES[resource].delegate];
  const found = await delegate.findFirst({ where: { id: rowId, workspaceId: id }, select: { id: true } });
  if (!found) throw new ApiError(404, 'Not found');
  return { user, id, resource, rowId, delegate };
}

/** Editing a row also clears its "new" marker. */
export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const { user, resource, rowId, delegate } = await prepare(request, ctx);
  const data = await readBody(request, RESOURCES[resource as keyof typeof RESOURCES].create.partial());
  const extra = resource === 'predictions' && 'status' in data ? { resolvedAt: (data as { status?: string }).status === 'Open' ? null : new Date() } : {};
  const hasNew = ['services', 'risks', 'signals', 'actions', 'predictions', 'metrics'].includes(resource);
  await delegate.update({ where: { id: rowId }, data: { ...data, ...extra, ...(hasNew ? { isNew: false } : {}) } });
  await audit(user.id, `${resource}.update`, rowId);
  return json({ ok: true });
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  const { user, resource, rowId, delegate } = await prepare(request, ctx);
  await delegate.delete({ where: { id: rowId } });
  await audit(user.id, `${resource}.delete`, rowId);
  return json({ ok: true });
});
