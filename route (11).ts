import { prisma } from '@/lib/db/prisma';
import { ApiError, assertSameOrigin, handle, json, readBody } from '@/lib/http';
import { apiUser, audit, canWrite, workspaceFor } from '@/lib/auth/session';
import { RESOURCES, isResource } from '@/lib/resources';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string; resource: string }> };

export const POST = handle(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!canWrite(user)) throw new ApiError(403, 'You do not have access to this');
  const { id, resource } = await ctx.params;
  if (!isResource(resource)) throw new ApiError(404, 'Unknown table');
  await workspaceFor(user, id);
  const def = RESOURCES[resource];
  const data = await readBody(request, def.create);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (prisma as any)[def.delegate].create({ data: { ...data, workspaceId: id } });
  await audit(user.id, `${resource}.create`, row.id);
  return json({ id: row.id }, { status: 201 });
});
