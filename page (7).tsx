import { requireUser, workspaceFor, canWrite } from '@/lib/auth/session';
import { loadWorkspace } from '@/lib/data';
import { UploadCard } from '@/components/UploadCard';
import { DeleteRow } from '@/components/DeleteRow';
import { Badge, Empty } from '@/components/ui';
import { analyseMetric } from '@/lib/domain/stats';

const DOCS = '.docx,.pdf,.xlsx,.csv,.txt,.md';

export default async function SourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  await workspaceFor(user, id);
  const data = await loadWorkspace(id);
  const write = canWrite(user);
  const aiOn = process.env.AI_PROVIDER !== undefined && process.env.AI_PROVIDER !== 'none';
  const del = (url: string) => (write ? <DeleteRow url={url} confirmText="Delete this?" /> : null);
  return (
    <>
      <div className="row spread mb"><h2>Plans</h2><UploadCard kind="plan" workspaceId={id} accept={DOCS} canWrite={write} autoAnalyse={aiOn} /></div>
      {data.plans.length ? (
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Size</th><th>Added</th><th /></tr></thead>
          <tbody>{data.plans.map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.chars.toLocaleString()} characters{p.truncated ? <> <Badge tone="warn">Shortened</Badge></> : null}</td><td>{p.createdAt.toLocaleDateString('en-GB')}</td><td>{del(`/api/workspaces/${id}/documents/${p.id}`)}</td></tr>)}</tbody></table></div>
      ) : <Empty>Upload a plan to begin. Word, PDF, Excel, CSV and text files work</Empty>}

      <div className="row spread mb" style={{ marginTop: 36 }}><h2>Interviews and focus groups</h2><UploadCard kind="interview" workspaceId={id} accept={DOCS} canWrite={write} /></div>
      {data.interviews.length ? (
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Kind</th><th>Size</th><th>Added</th><th /></tr></thead>
          <tbody>{data.interviews.map((d) => <tr key={d.id}><td><b>{d.name}</b></td><td><Badge>{d.kind}</Badge></td><td>{d.chars.toLocaleString()} characters</td><td>{d.createdAt.toLocaleDateString('en-GB')}</td><td>{del(`/api/workspaces/${id}/documents/${d.id}`)}</td></tr>)}</tbody></table></div>
      ) : <Empty>No interviews or focus groups</Empty>}

      <div className="row spread mb" style={{ marginTop: 36 }}><h2>Figures</h2><UploadCard kind="figures" workspaceId={id} accept=".csv,.xlsx,.txt" canWrite={write} /></div>
      {data.metrics.length ? (
        <div className="table-wrap"><table><thead><tr><th>Metric</th><th>Values</th><th>Better when</th><th>Source</th><th /></tr></thead>
          <tbody>{data.metrics.map((m) => { const n = analyseMetric(m); return <tr key={m.id}><td><b>{m.name}</b>{m.unit ? <span className="muted"> ({m.unit})</span> : null}</td><td>{Array.isArray(m.points) ? m.points.length : 0}{n.ok ? '' : ' (needs 2 or more)'}</td><td>{m.direction}</td><td className="muted">{m.source}</td><td>{del(`/api/workspaces/${id}/rows/metrics/${m.id}`)}</td></tr>; })}</tbody></table></div>
      ) : <Empty>No figures. Upload a CSV with columns Metric, Period, Value, or periods across the top</Empty>}
    </>
  );
}
