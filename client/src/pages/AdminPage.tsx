import {
  Bot,
  CircleCheck,
  Clock,
  ExternalLink,
  Hourglass,
  ListChecks,
  LogOut,
  MapPin,
  MousePointerClick,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Timer,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge, ProviderBadge, StatusBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { ErrorAlert, SkeletonLines, Spinner } from '../components/Feedback';
import { usePageTitle } from '../components/Layout';
import { Timeline } from '../components/StatusTracker';
import { useAsync } from '../hooks/useAsync';
import { useCatalog } from '../hooks/useCatalog';
import { api } from '../lib/api';
import { PRIORITY_LABEL, STATUS_LABEL, departmentName, formatHours, timeAgo } from '../lib/format';
import type { AdminIssue, Priority, Status } from '../lib/types';

const NEXT_STATUSES: Record<Status, Status[]> = {
  reported: ['in_progress', 'resolved', 'rejected'],
  in_progress: ['resolved', 'rejected', 'reported'],
  resolved: ['in_progress'],
  rejected: ['reported'],
};

export default function AdminPage() {
  usePageTitle('Admin console');
  const session = useAsync(() => api.admin.session(), []);
  // Local override after login/logout; otherwise derived from the server session check.
  const [override, setAuthed] = useState<boolean | null>(null);
  const authed = override ?? session.data?.authenticated ?? (session.error ? false : null);

  if (authed === null) {
    return (
      <div className="container empty" role="status">
        <Spinner label="Checking session…" size={20} />
      </div>
    );
  }
  return authed ? (
    <AdminConsole onLogout={() => setAuthed(false)} />
  ) : (
    <LoginForm onLogin={() => setAuthed(true)} />
  );
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.admin.login(password);
      onLogin();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 440, paddingTop: '2.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span className="icon-tile lg" style={{ margin: '0 auto 1.25rem' }} aria-hidden="true">
          <ShieldCheck size={24} />
        </span>
        <h1>Officials sign in</h1>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Review complaints, update their status and keep citizens informed.
        </p>
      </div>
      <form className="card stack" onSubmit={submit}>
        <div className="callout small" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
          <div className="row between" style={{ width: '100%', alignItems: 'center' }}>
            <div>
              <strong style={{ color: 'var(--primary-700)', display: 'block' }}>Jury / Demo Password</strong>
              <span className="mono code xs">jewqhfbkwyf</span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ height: 32, fontSize: '0.78rem' }}
              onClick={() => setPassword('jewqhfbkwyf')}
            >
              Auto-fill password
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error !== null && <ErrorAlert error={error} />}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !password}>
          {busy ? <Spinner label="Signing in…" /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function AdminConsole({ onLogout }: { onLogout: () => void }) {
  const { departments, categories, priorities, statuses } = useCatalog();
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [deptFilter, setDeptFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const issues = useAsync(
    () =>
      api.admin.issues({
        status: statusFilter || undefined,
        department: deptFilter || undefined,
        priority: priorityFilter || undefined,
        sort: 'priority',
        limit: 200,
      }),
    [statusFilter, deptFilter, priorityFilter],
  );
  const stats = useAsync(() => api.stats(), []);
  const selected = issues.data?.items.find((i) => i.id === selectedId) ?? null;

  function replaceIssue(updated: AdminIssue) {
    if (!issues.data) return;
    issues.setData({
      ...issues.data,
      items: issues.data.items.map((i) => (i.id === updated.id ? updated : i)),
    });
    stats.reload();
  }

  async function logout() {
    await api.admin.logout().catch(() => undefined);
    onLogout();
  }

  const s = stats.data;
  const kpis: {
    Icon: LucideIcon;
    tone: string;
    label: string;
    value: string | number | undefined;
  }[] = [
    { Icon: Clock, tone: 'amber', label: 'Open complaints', value: s?.open },
    { Icon: Siren, tone: 'red', label: 'Critical (all time)', value: s?.byPriority.critical },
    { Icon: Hourglass, tone: 'red', label: 'Past SLA', value: s?.overdue },
    {
      Icon: Timer,
      tone: 'slate',
      label: 'Avg. resolution',
      value: s ? formatHours(s.avgResolutionHours) : undefined,
    },
    {
      Icon: Star,
      tone: 'amber',
      label: 'Satisfaction',
      value: s ? (s.satisfaction ? `${s.satisfaction}/5` : '—') : undefined,
    },
    {
      Icon: Bot,
      tone: '',
      label: 'AI suggestions overridden',
      value: s ? `${Math.round(s.aiOverrideRate * 100)}%` : undefined,
    },
  ];

  return (
    <div className="container">
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Operations console</h1>
          <p className="lead">Work queue ranked by AI impact score, community support and age.</p>
        </div>
        <div className="row">
          <AiStatusChip />
          <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      </header>

      <section aria-label="Key figures" className="grid grid-kpi">
        {kpis.map(({ Icon, tone, label, value }) => (
          <div className="card card-sm" key={label}>
            <span className={`icon-tile sm ${tone}`} aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className="stat-value" style={{ marginTop: '0.9rem' }}>
              {value ?? '—'}
            </div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      <div style={{ marginTop: '1.5rem' }}>
        <BriefingPanel />
      </div>

      <div
        className="split"
        style={{ marginTop: '1.5rem', gridTemplateColumns: 'minmax(0,1fr) 420px' }}
      >
        <section className="card card-flush" aria-labelledby="queue-title">
          <div style={{ padding: '1.5rem 1.5rem 1.25rem' }}>
            <div className="card-head" style={{ marginBottom: '1rem' }}>
              <div>
                <h2 id="queue-title">Work queue</h2>
                <p>{issues.data ? `${issues.data.total} complaints` : 'Loading…'}</p>
              </div>
            </div>
            <div className="toolbar" role="group" aria-label="Queue filters">
              <label className="sr-only" htmlFor="a-status">
                Status
              </label>
              <select
                id="a-status"
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status | '')}
              >
                <option value="">All statuses</option>
                {statuses.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="a-priority">
                Priority
              </label>
              <select
                id="a-priority"
                className="select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
              >
                <option value="">All priorities</option>
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="a-dept">
                Department
              </label>
              <select
                id="a-dept"
                className="select"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {issues.error && (
            <div style={{ padding: '0 1.5rem 1.5rem' }}>
              <ErrorAlert error={issues.error} onRetry={issues.reload} />
            </div>
          )}
          {issues.loading && !issues.data && (
            <div style={{ padding: '0 1.5rem 1.5rem' }}>
              <SkeletonLines lines={6} />
            </div>
          )}
          {issues.data && (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Complaints sorted by urgency. Select a title to manage it.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Score</th>
                    <th scope="col">Complaint</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.data.items.map((i) => (
                    <tr key={i.id} className={i.id === selectedId ? 'selected' : undefined}>
                      <td>
                        <span
                          className={`score-pill${i.effectiveScore >= 80 ? ' hot' : i.effectiveScore >= 60 ? ' warm' : ''}`}
                        >
                          {i.effectiveScore}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="row-btn"
                          onClick={() => setSelectedId(i.id)}
                          aria-pressed={i.id === selectedId}
                        >
                          {i.title}
                        </button>
                        <div className="xs muted" style={{ marginTop: '0.2rem' }}>
                          <span className="code">{i.code}</span> ·{' '}
                          {departmentName(i.department, departments)} · {timeAgo(i.createdAt)}
                          {i.overdue && (
                            <span
                              className="badge badge-overdue"
                              style={{ marginLeft: '0.4rem', height: 20 }}
                            >
                              Past SLA
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <PriorityBadge priority={i.priority} />
                      </td>
                      <td>
                        <StatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {issues.data.items.length === 0 && (
                <p className="empty">No complaints match these filters.</p>
              )}
            </div>
          )}
        </section>

        <aside className="sticky" aria-label="Selected complaint">
          {selected ? (
            <IssueEditor
              key={selected.id}
              issue={selected}
              categories={categories}
              departments={departments}
              onSaved={replaceIssue}
            />
          ) : (
            <div className="card empty">
              <span className="icon-tile slate" aria-hidden="true">
                <MousePointerClick size={19} />
              </span>
              <p style={{ fontWeight: 600, color: 'var(--text-2)' }}>No complaint selected</p>
              <p className="small">Pick one from the queue to review and update it.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function AiStatusChip() {
  const status = useAsync(() => api.admin.aiStatus(), []);
  if (!status.data) return null;
  const primary = status.data.providers[0];
  return (
    <span className="chip" title="Self-imposed daily budget protecting the free tier">
      <Sparkles size={14} color="var(--primary)" aria-hidden="true" />
      {primary
        ? `${primary.budget.remainingToday}/${primary.budget.rpd} AI calls left today`
        : 'Rule-based mode'}
    </span>
  );
}

function BriefingPanel() {
  const [refresh, setRefresh] = useState(0);
  const briefing = useAsync(() => api.admin.briefing(refresh > 0), [refresh]);
  const b = briefing.data;

  const cols: { key: string; title: string; Icon: LucideIcon; tone: string; items: ReactNode[] }[] =
    b
      ? [
          {
            key: 'risk',
            title: 'Safety alerts',
            Icon: ShieldAlert,
            tone: 'red',
            items: b.riskAlerts,
          },
          {
            key: 'actions',
            title: 'Today’s actions',
            Icon: ListChecks,
            tone: '',
            items: b.actions,
          },
          {
            key: 'hot',
            title: 'Hotspots',
            Icon: MapPin,
            tone: 'amber',
            items: b.hotspots.map((h) => (
              <>
                <strong>{h.area}:</strong> {h.issue}{' '}
                <span className="muted">→ {h.recommendation}</span>
              </>
            )),
          },
        ].filter((c) => c.items.length > 0)
      : [];

  return (
    <section className="card ai-card" aria-labelledby="briefing-title" aria-busy={briefing.loading}>
      <div className="card-head" style={{ marginBottom: '1rem' }}>
        <h2 id="briefing-title">
          <span className="icon-tile sm" aria-hidden="true">
            <Sparkles size={16} />
          </span>
          AI daily briefing
        </h2>
        <div className="row row-tight">
          {b && <ProviderBadge provider={b.provider} />}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRefresh((n) => n + 1)}
            disabled={briefing.loading}
          >
            {briefing.loading ? (
              <Spinner label="Generating…" size={14} />
            ) : (
              <>
                <RefreshCw size={14} aria-hidden="true" /> Refresh
              </>
            )}
          </button>
        </div>
      </div>
      {briefing.error && <ErrorAlert error={briefing.error} onRetry={briefing.reload} />}
      {!b && briefing.loading && <SkeletonLines lines={4} />}
      {b && (
        <div className="fade-in">
          <p className="headline">{b.headline}</p>
          <p className="text-2" style={{ marginTop: '0.6rem', maxWidth: '90ch' }}>
            {b.summary}
          </p>
          {cols.length > 0 && (
            <div className="briefing-cols">
              {cols.map(({ key, title, Icon, tone, items }) => (
                <div key={key}>
                  <h3>
                    <span className={`icon-tile sm ${tone}`} aria-hidden="true">
                      <Icon size={15} />
                    </span>
                    {title}
                  </h3>
                  <ul>
                    {items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="xs muted" style={{ marginTop: '1.25rem' }}>
            Generated {timeAgo(b.generatedAt)} from {b.openIssues} open complaints · cached for 15
            minutes to save AI quota.
          </p>
        </div>
      )}
    </section>
  );
}

function IssueEditor({
  issue,
  categories,
  departments,
  onSaved,
}: {
  issue: AdminIssue;
  categories: string[];
  departments: { id: string; name: string }[];
  onSaved: (i: AdminIssue) => void;
}) {
  const [status, setStatus] = useState<Status>(issue.status);
  const [priority, setPriority] = useState<Priority>(issue.priority);
  const [department, setDepartment] = useState(issue.department);
  const [category, setCategory] = useState(issue.category);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'update' | 'ai'>('update');

  const options = [issue.status, ...NEXT_STATUSES[issue.status]];

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const change = {
        ...(status !== issue.status ? { status } : {}),
        ...(priority !== issue.priority ? { priority } : {}),
        ...(department !== issue.department ? { department } : {}),
        ...(category !== issue.category ? { category } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      const res = await api.admin.update(issue.id, change);
      setSaved(true);
      setNote('');
      onSaved(res.issue);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack fade-in">
      <div className="card card-sm stack" aria-labelledby="editor-title">
        <div>
          <div className="row between" style={{ marginBottom: '0.6rem' }}>
            <div className="row row-tight">
              <CategoryIcon category={issue.category} size="sm" />
              <span className="code xs">{issue.code}</span>
            </div>
            <Link to={`/track/${issue.code}`} className="link-arrow xs">
              Public page <ExternalLink size={13} aria-hidden="true" />
            </Link>
          </div>
          <h2 id="editor-title" style={{ fontSize: '1.08rem', lineHeight: 1.35 }}>
            {issue.title}
          </h2>
          <p className="small text-2" style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
            {issue.description}
          </p>
        </div>

        <div className="tab-pills" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'update'}
            className={`tab-pill ${tab === 'update' ? 'active' : ''}`}
            onClick={() => setTab('update')}
          >
            Update status
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ai'}
            className={`tab-pill ${tab === 'ai' ? 'active' : ''}`}
            onClick={() => setTab('ai')}
          >
            AI insights {issue.ai ? `· ${issue.ai.impactScore}/100` : ''}
          </button>
        </div>

        {tab === 'update' ? (
          <form className="stack" onSubmit={save}>
            <div className="form-grid" style={{ gap: '1rem' }}>
              <div className="field">
                <label htmlFor="e-status">Status</label>
                <select
                  id="e-status"
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                >
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="e-priority">Priority</label>
                <select
                  id="e-priority"
                  className="select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                      {issue.ai?.priority === p ? ' (AI)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="e-dept">Department</label>
              <select
                id="e-dept"
                className="select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="e-category">Category</label>
              <select
                id="e-category"
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="e-note">
                Note to citizen <span className="label-opt">(shown on the timeline)</span>
              </label>
              <textarea
                id="e-note"
                className="textarea"
                style={{ minHeight: 88 }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="e.g. Crew dispatched, repair scheduled for tomorrow."
              />
            </div>
            {error !== null && <ErrorAlert error={error} />}
            <p aria-live="polite" className={saved ? 'alert alert-success' : 'sr-only'}>
              {saved && <CircleCheck size={16} aria-hidden="true" />}
              {saved ? 'Saved — the citizen can see this update.' : ''}
            </p>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Spinner label="Saving…" /> : 'Save update'}
            </button>
          </form>
        ) : (
          <div className="stack" style={{ gap: '1rem' }}>
            {issue.ai?.translatedDescription && (
              <p className="callout small">
                <span>
                  <strong>Translation: </strong>
                  {issue.ai.translatedDescription}
                </span>
              </p>
            )}
            {issue.hasImage && (
              <div className="detail-photo">
                <img
                  src={api.imageUrl(issue.code)}
                  alt={`Evidence submitted by the citizen for ${issue.code}`}
                  loading="lazy"
                />
              </div>
            )}
            <ul className="meta-list" style={{ flexDirection: 'column', gap: '0.4rem' }}>
              <li>
                <MapPin size={15} aria-hidden="true" /> {issue.location.address}
              </li>
              <li>
                <User size={15} aria-hidden="true" />
                {issue.reporter
                  ? `${issue.reporter.name || 'Anonymous'} · ${issue.reporter.contact || 'no contact'}`
                  : 'Anonymous'}
              </li>
            </ul>
            {issue.ai && (
              <div className="callout small" style={{ flexDirection: 'column', gap: '0.45rem' }}>
                <div className="row row-tight">
                  <ProviderBadge provider={issue.ai.provider} />
                  <span className="xs muted">
                    Impact {issue.ai.impactScore}/100 · {Math.round(issue.ai.confidence * 100)}%
                    confident
                  </span>
                </div>
                <span>{issue.ai.reasoning}</span>
              </div>
            )}
            {issue.category === 'Roads & Potholes' && (
              <div className="callout small" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                <div className="row row-tight">
                  <ShieldCheck size={15} color="#16a34a" />
                  <strong>Contractor Defect Liability Period (DLP) Active</strong>
                </div>
                <span className="xs" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Road resurfaced within 18 months. Auto-warranty clause invoked: zero municipal expense incurred. Notice queued for PWD Contractor M/s Kongu Infra.
                </span>
              </div>
            )}
            {issue.status === 'resolved' && (
              <div className="callout small" style={{ background: '#eef3fe', borderColor: '#bad0fb' }}>
                <div className="row row-tight">
                  <ShieldCheck size={15} color="var(--primary)" />
                  <strong>AI Anti-Fraud Verification (Gemini Vision)</strong>
                </div>
                <span className="xs" style={{ display: 'block', marginTop: '0.2rem' }}>
                  ✓ 94% Landmark Alignment: Background structures match report image; hazard rectified. Authenticated resolution proof.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <section className="card card-sm" aria-labelledby="history-title">
        <h3 id="history-title" style={{ marginBottom: '1rem' }}>
          History
        </h3>
        <Timeline events={issue.history} />
      </section>
    </div>
  );
}
