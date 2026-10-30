import Link from 'next/link';
import { requireUser, workspaceFor, canWrite } from '@/lib/auth/session';
import { loadWorkspace } from '@/lib/data';
import { HeatMap } from '@/components/charts';
import { riskBand, riskScore } from '@/lib/ai/prompts';
import { Badge, Empty } from '@/components/ui';
import { MarkReviewed } from '@/components/MarkReviewed';

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  await workspaceFor(user, id);
  const data = await loadWorkspace(id);
  const res = `/workspaces/${id}/results`;
  const openActions = data.actions.filter((a) => a.status !== 'Done');
  const openRisks = data.risks.filter((r) => r.status !== 'Closed');
  const high = openRisks.filter((r) => ['high', 'extreme'].includes(riskBand(riskScore(r))));
  const doFirst = [...openActions].sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority as 'High'] ?? 3) - ({ High: 0, Medium: 1, Low: 2 }[b.priority as 'High'] ?? 3)).slice(0, 5);
  const futureSignals = data.signals.filter((s) => s.horizon === 'Future').slice(0, 6);
  const fresh: [string, string, number][] = [
    ['Analyses', 'analysis', data.analyses.filter((x) => x.isNew).length], ['Actions', 'actions', data.actions.filter((x) => x.isNew).length], ['Risks', 'risks', data.risks.filter((x) => x.isNew).length],
    ['Services', 'services', data.services.filter((x) => x.isNew).length], ['Signals', 'signals', data.signals.filter((x) => x.isNew).length], ['Figures', 'numbers', data.metrics.filter((x) => x.isNew).length],
  ];
  const stats: [number, string][] = [[openActions.length, 'Open actions'], [openRisks.length, 'Open risks'], [high.length, 'High or extreme'], [data.services.length, 'Services'], [data.signals.length, 'Signals']];
  return (
    <>
      <div className="stats mb">{stats.map(([n, l]) => <div key={l} className="stat"><b>{n}</b><span className="muted small">{l}</span></div>)}</div>
      {fresh.some((f) => f[2]) ? (
        <div className="card mb">
          <div className="row spread"><h2>What is new</h2>{canWrite(user) ? <MarkReviewed workspaceId={id} areas={['analyses', 'actions', 'risks', 'services', 'signals', 'metrics', 'predictions']} /> : null}</div>
          <div className="chips">{fresh.filter((f) => f[2]).map(([l, s, n]) => <Link key={s} className="chip" href={`${res}#sec-${s}`}><b>{n}</b> new {l.toLowerCase()}</Link>)}</div>
        </div>
      ) : null}
      <div className="card mb">
        <div className="row spread"><h2>Do first</h2><Link href={`${res}#sec-actions`} className="btn link">All actions</Link></div>
        {doFirst.length ? <ul style={{ paddingLeft: 18 }}>{doFirst.map((a) => <li key={a.id} style={{ margin: '8px 0' }}>{a.action} <Badge tone={a.priority === 'High' ? 'danger' : 'warn'}>{a.priority}</Badge></li>)}</ul> : <Empty>No open actions</Empty>}
      </div>
      <div className="cols2 mb">
        <div className="card"><h2 style={{ marginBottom: 14 }}>Risk heat map</h2><HeatMap risks={data.risks} /></div>
        <div className="card"><h2 style={{ marginBottom: 8 }}>Top risks</h2>
          {openRisks.length ? <div className="table-wrap"><table><tbody>{[...openRisks].sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 6).map((r) => <tr key={r.id}><td>{r.title}</td><td><span className={`badge ${riskBand(riskScore(r)) === 'extreme' ? 'danger' : riskBand(riskScore(r)) === 'high' ? 'warn' : ''}`}>{riskBand(riskScore(r))}</span></td></tr>)}</tbody></table></div> : <Empty>No open risks</Empty>}
        </div>
      </div>
      <div className="card"><div className="row spread"><h2>Future signals</h2><Link href={`${res}#sec-signals`} className="btn link">All signals</Link></div>
        {futureSignals.length ? <ul style={{ paddingLeft: 18 }}>{futureSignals.map((s) => <li key={s.id} style={{ margin: '8px 0' }}>{s.title} <Badge>{s.direction}</Badge></li>)}</ul> : <Empty>No future signals</Empty>}
      </div>
    </>
  );
}
