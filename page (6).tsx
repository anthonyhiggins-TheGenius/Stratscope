import { requireUser, workspaceFor, canWrite } from '@/lib/auth/session';
import { loadWorkspace, payloadOf, sourcesFactory } from '@/lib/data';
import { aiEnabled, aiLabel } from '@/lib/ai';
import type { Rec } from '@/lib/domain/util';
import { analyseMetric, fmtNum, fmtPct } from '@/lib/domain/stats';
import { calibration } from '@/lib/domain/calibration';
import { riskBand, riskScore } from '@/lib/ai/prompts';
import { RunPanel, type JobView } from '@/components/RunPanel';
import { Section } from '@/components/Section';
import { ResourceTable } from '@/components/ResourceTable';
import { ResultView } from '@/components/results/ResultView';
import { AnalysisCard } from '@/components/AnalysisCard';
import { QualityCard } from '@/components/QualityCard';
import { MetricCard } from '@/components/MetricCard';
import { RunStep } from '@/components/RunStep';
import { ReportBuilder } from '@/components/ReportBuilder';
import { HeatMap } from '@/components/charts';
import { Callout, Empty } from '@/components/ui';
import type { DeckData } from '@/components/deck-data';
import { ACTION, PREDICTION, RISK, SERVICE, SIGNAL, WATCH } from '@/lib/fields';

const OTHER = ['interviews', 'diagnostic', 'report', 'story'];

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  await workspaceFor(user, id);
  const data = await loadWorkspace(id);
  const write = canWrite(user);
  const aiOn = aiEnabled();
  const sourcesFor = sourcesFactory(data);
  const fresh = (xs: { isNew: boolean }[]) => xs.filter((x) => x.isNew).length;

  const mainAnalyses = data.analyses.filter((a) => !OTHER.includes(a.kind));
  const reportAnalyses = data.analyses.filter((a) => a.kind === 'report' || a.kind === 'story');
  const lastOf = (k: string) => data.analyses.find((a) => a.kind === k);
  const ivLatest = lastOf('interviews'), dgLatest = lastOf('diagnostic');
  const extract = lastOf('extract'), planTable = lastOf('plantable');
  const planPayload: Rec | null = planTable ? payloadOf(planTable) : null;
  const deck: DeckData = {
    extract: extract ? payloadOf(extract) : null, planTable: planPayload, sources: planTable ? sourcesFor(planTable) : null,
    metrics: data.metrics.map((m) => ({ name: m.name, direction: m.direction, points: m.points })), risks: data.risks, actions: data.actions, predictions: data.predictions,
  };
  const earlierFor = (a: { id: string; kind: string; planId: string | null; createdAt: Date }) => (a.kind === 'plantable' ? data.analyses.filter((x) => x.kind === 'plantable' && x.id !== a.id && x.planId === a.planId) : []);
  const view = (a: (typeof data.analyses)[number]) => <ResultView a={a} sources={sourcesFor(a)} canWrite={write} earlier={earlierFor(a)} deck={deck} />;
  const card = (a: (typeof data.analyses)[number], open: boolean) => (
    <AnalysisCard key={a.id} id={a.id} label={a.label} planName={a.planName} createdAt={a.createdAt} isNew={a.isNew} open={open} canWrite={write}>{view(a)}</AnalysisCard>
  );

  const job = data.job ? ({ id: data.job.id, status: data.job.status, steps: data.job.steps, added: data.job.added, error: data.job.error } as unknown as JobView) : null;
  const accepted = data.feedback.filter((f) => f.verdict === 'accepted').length;
  const calRows = calibration(data.predictions).filter((r) => r.n);
  const withScore = data.risks.map((r) => ({ ...r, score: riskScore(r), band: riskBand(riskScore(r)) }));
  const hasPlan = data.plans.length > 0;
  const metricRows = data.metrics.map((m) => ({ m, an: analyseMetric(m) })).filter((x) => x.an.ok);

  return (
    <>
      <RunPanel
        workspaceId={id}
        plans={data.plans.map((p) => ({ id: p.id, name: p.name }))}
        library={data.library.map((d) => ({ id: d.id, name: d.name, kind: d.kind }))}
        aiEnabled={aiOn} aiLabel={aiLabel()} canWrite={write}
        feedback={{ accepted, rejected: data.feedback.length - accepted }}
        initialJob={job} defaultPlanId={extract?.planId ?? data.plans[0]?.id}
      />

      <Section id="summary" title="Summary" defaultOpen>
        {data.analyses.length ? (
          <>
            <QualityCard extract={extract ? payloadOf(extract) : null} planTable={planPayload} sources={planTable ? sourcesFor(planTable) : null} />
            {mainAnalyses.slice(0, 4).filter((a) => payloadOf(a).summary).map((a) => <Callout key={a.id}><b>{a.label}.</b> {String(payloadOf(a).summary)}</Callout>)}
          </>
        ) : <Empty>Run a quick analysis to see the summary</Empty>}
      </Section>

      <Section id="analysis" title="Analysis" count={mainAnalyses.length} fresh={fresh(mainAnalyses)} defaultOpen>
        {mainAnalyses.length ? mainAnalyses.map((a, i) => card(a, i === 0)) : <Empty>No analysis yet. Run a quick analysis above</Empty>}
      </Section>

      <Section id="actions" title="Actions" count={data.actions.length} fresh={fresh(data.actions)}>
        <ResourceTable workspaceId={id} resource="actions" rows={data.actions} columns={ACTION.columns} fields={ACTION.fields} addLabel="Add action" canWrite={write} emptyText="No actions yet. Add them from recommendations or the strategic plan" />
      </Section>

      <Section id="numbers" title="Numbers and trends" count={data.metrics.length} fresh={fresh(data.metrics)}>
        {metricRows.length ? (
          <div className="card mb"><h2 style={{ marginBottom: 12 }}>Comparison</h2>
            <div className="table-wrap"><table><thead><tr><th>Metric</th><th>Latest</th><th>Change</th><th>Growth</th><th>Trend</th><th>Projected</th><th>Confidence</th></tr></thead>
              <tbody>{metricRows.map(({ m, an }) => an.ok ? <tr key={m.id}><td><b>{m.name}</b></td><td>{fmtNum(an.last)}</td><td>{fmtPct(an.changePct)}</td><td>{an.cagr == null ? '' : fmtPct(an.cagr * 100)}</td><td><span className={`badge ${an.trend === 'Improving' ? 'ok' : an.trend === 'Worsening' ? 'danger' : ''}`}>{an.trend}</span></td><td>{fmtNum(an.forecast[an.forecast.length - 1]!.y)}</td><td>{an.confidence}</td></tr> : null)}</tbody></table></div></div>
        ) : null}
        {data.metrics.length ? data.metrics.map((m) => <MetricCard key={m.id} metric={m} planTable={planPayload} />) : <Empty>Add figures in Sources to see trends</Empty>}
      </Section>

      <Section id="findings" title="Interview findings" count={ivLatest ? 1 : 0} fresh={fresh(data.analyses.filter((a) => a.kind === 'interviews'))}>
        <RunStep workspaceId={id} kind="interviews" label="Analyse interviews" hint={data.interviews.length ? `Sends the transcripts to ${aiLabel()}` : 'Add interviews in Sources first'} enabled={write && aiOn && data.interviews.length > 0} planId={data.plans[0]?.id} />
        {ivLatest ? card(ivLatest, true) : null}
      </Section>

      <Section id="diagnostic" title="Diagnostic" count={dgLatest ? 1 : 0} fresh={fresh(data.analyses.filter((a) => a.kind === 'diagnostic'))}>
        <RunStep workspaceId={id} kind="diagnostic" label="Run diagnostic" hint="Uses the plan, interviews, figures and risks you have added" enabled={write && aiOn && (hasPlan || data.interviews.length > 0)} planId={data.plans[0]?.id} />
        {dgLatest ? card(dgLatest, true) : null}
      </Section>

      <Section id="foresight" title="Foresight" count={data.predictions.length + data.watch.length} fresh={fresh(data.predictions) + data.watch.filter((w) => w.status === 'Triggered').length}>
        <h2 style={{ marginBottom: 12 }}>Predictions</h2>
        {calRows.length ? <div className="table-wrap mb"><table><thead><tr><th>Confidence</th><th>Resolved</th><th>Came true</th></tr></thead><tbody>{calRows.map((r) => <tr key={r.c}><td>{r.c}</td><td>{r.n}</td><td>{Math.round((r.rate ?? 0) * 100)}%</td></tr>)}</tbody></table></div> : <p className="muted small">Mark outcomes as events happen and an accuracy table appears here.</p>}
        <ResourceTable workspaceId={id} resource="predictions" rows={data.predictions} columns={PREDICTION.columns} fields={PREDICTION.fields} addLabel="Add prediction" canWrite={write} emptyText="No predictions yet. Track them from the Horizon trends analysis" />
        <h2 style={{ margin: '28px 0 12px' }}>Watchlist</h2>
        <ResourceTable workspaceId={id} resource="watch" rows={data.watch} columns={WATCH.columns} fields={WATCH.fields} addLabel="Add indicator" canWrite={write} emptyText="No indicators. Add them from the strategic plan" />
      </Section>

      <Section id="risks" title="Risks" count={data.risks.length} fresh={fresh(data.risks)}>
        <div className="mb"><HeatMap risks={data.risks} /></div>
        <ResourceTable workspaceId={id} resource="risks" rows={withScore} columns={[...RISK.columns.slice(0, 4), { key: 'band', label: 'Rating', badge: { extreme: 'danger', high: 'warn' } }, ...RISK.columns.slice(4)]} fields={RISK.fields} addLabel="Add risk" canWrite={write} emptyText="No risks yet" />
      </Section>

      <Section id="services" title="Services" count={data.services.length} fresh={fresh(data.services)}>
        <ResourceTable workspaceId={id} resource="services" rows={data.services} columns={SERVICE.columns} fields={SERVICE.fields} addLabel="Add service" canWrite={write} emptyText="No services yet" />
      </Section>

      <Section id="signals" title="Signals" count={data.signals.length} fresh={fresh(data.signals)}>
        <ResourceTable workspaceId={id} resource="signals" rows={data.signals} columns={SIGNAL.columns} fields={SIGNAL.fields} addLabel="Add signal" canWrite={write} emptyText="No signals yet" />
      </Section>

      <Section id="reports" title="Reports and presentation" count={reportAnalyses.length} fresh={fresh(reportAnalyses)}>
        <ReportBuilder workspaceId={id} templates={data.library.filter((d) => d.kind === 'Template').map((d) => ({ id: d.id, name: d.name }))} enabled={write && aiOn && (hasPlan || data.interviews.length > 0)} planId={data.plans[0]?.id} />
        {reportAnalyses.length ? reportAnalyses.map((a, i) => card(a, i === 0)) : <Empty>No reports yet</Empty>}
      </Section>
    </>
  );
}
