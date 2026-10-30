import { requireUser, canWrite } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { UploadCard } from '@/components/UploadCard';
import { DeleteRow } from '@/components/DeleteRow';
import { Badge, Empty } from '@/components/ui';

export default async function LibraryPage() {
  const user = await requireUser();
  const docs = await prisma.libraryDoc.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true, kind: true, chars: true, createdAt: true } });
  const write = canWrite(user);
  return (
    <>
      <div className="page-title"><div><h1>Library</h1><p className="muted" style={{ margin: '6px 0 0' }}>Frameworks, templates and research briefings. Analyses use them as reference material.</p></div>
        <UploadCard kind="library" workspaceId="" accept=".docx,.pdf,.xlsx,.csv,.txt,.md" canWrite={write} /></div>
      {docs.length ? (
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Kind</th><th>Size</th><th>Added</th><th /></tr></thead>
          <tbody>{docs.map((d) => <tr key={d.id}><td><b>{d.name}</b></td><td><Badge>{d.kind}</Badge></td><td>{d.chars.toLocaleString()} characters</td><td>{d.createdAt.toLocaleDateString('en-GB')}</td><td>{write ? <DeleteRow url={`/api/library/${d.id}`} confirmText="Delete this document?" /> : null}</td></tr>)}</tbody></table></div>
      ) : <Empty>Nothing here yet. Add a framework, a report template or a research briefing</Empty>}
    </>
  );
}
