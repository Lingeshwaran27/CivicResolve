import {
  CircleCheck,
  Clock,
  Download,
  Hourglass,
  Inbox,
  LayoutGrid,
  Map as MapIcon,
  Search,
  Star,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, useDeferredValue, useState } from 'react';
import { ErrorAlert, SkeletonLines } from '../components/Feedback';
import { IssueCard } from '../components/IssueCard';
import { usePageTitle } from '../components/Layout';
import { useAsync } from '../hooks/useAsync';
import { useCatalog } from '../hooks/useCatalog';
import { api, type IssueQuery } from '../lib/api';
import { PRIORITY_LABEL, STATUS_LABEL, formatHours } from '../lib/format';
import type { Priority, Stats, Status } from '../lib/types';

const IssueMap = lazy(() => import('../components/IssueMap'));
const Charts = lazy(() => import('../components/Charts'));

export function KpiGrid({ stats }: { stats: Stats | null }) {
  const s = stats;
  const items: {
    Icon: LucideIcon;
    tone: string;
    label: string;
    value: string | number | undefined;
  }[] = [
    { Icon: Inbox, tone: '', label: 'Total complaints', value: s?.total },
    { Icon: Clock, tone: 'amber', label: 'Open', value: s?.open },
    { Icon: Hourglass, tone: 'red', label: 'Past target date', value: s?.overdue },
    { Icon: CircleCheck, tone: 'green', label: 'Resolved', value: s?.byStatus.resolved },
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
  ];
  return (
    <section aria-label="Key figures" className="grid grid-kpi">
      {items.map(({ Icon, tone, label, value }) => (
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
  );
}

export default function DashboardPage() {
  usePageTitle('City dashboard');
  const { categories, priorities, statuses } = useCatalog();
  const [status, setStatus] = useState<Status | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<NonNullable<IssueQuery['sort']>>('priority');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search);

  const stats = useAsync(() => api.stats(), []);
  const issues = useAsync(
    () =>
      api.listIssues({
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        q: q.trim() || undefined,
        sort,
        limit: 200,
      }),
    [status, priority, category, q, sort],
  );

  function exportCsv() {
    if (!issues.data?.items.length) return;
    const headers = ['Code', 'Title', 'Category', 'Priority', 'Status', 'Department', 'Address', 'Created', 'Upvotes'];
    const rows = issues.data.items.map((i) => [
      i.code,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.category}"`,
      i.priority,
      i.status,
      `"${i.department}"`,
      `"${(i.location.address || '').replace(/"/g, '""')}"`,
      i.createdAt,
      i.upvotes,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `civicresolve-complaints-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container">
      <header className="page-head">
        <div>
          <p className="eyebrow">Open data</p>
          <h1>City dashboard</h1>
          <p className="lead">
            A live, public view of every complaint — where they are, how urgent they are, and how
            quickly departments are resolving them.
          </p>
        </div>
      </header>

      {stats.error && <ErrorAlert error={stats.error} onRetry={stats.reload} />}
      <KpiGrid stats={stats.data} />

      {stats.data && (
        <section aria-labelledby="charts-title" className="section" style={{ marginTop: '2.5rem' }}>
          <h2 id="charts-title" className="sr-only">
            Trends
          </h2>
          <Suspense fallback={<SkeletonLines lines={4} />}>
            <Charts stats={stats.data} />
          </Suspense>
        </section>
      )}

      <NammaWardScorecard />

      <section aria-labelledby="explore-title" className="section" style={{ marginTop: '3rem' }}>
        <div className="section-head">
          <div>
            <h2 id="explore-title">Explore complaints</h2>
            <p aria-live="polite">
              {issues.data
                ? `${issues.data.total} complaint${issues.data.total === 1 ? '' : 's'} match your filters`
                : 'Loading…'}
            </p>
          </div>
          <div className="row row-tight" role="group" aria-label="View">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={exportCsv}
              title="Export filtered complaints as CSV open data"
            >
              <Download size={14} aria-hidden="true" /> Export CSV
            </button>
            <button
              type="button"
              className={`btn btn-sm ${view === 'map' ? 'btn-soft' : 'btn-ghost'}`}
              aria-pressed={view === 'map'}
              onClick={() => setView('map')}
            >
              <MapIcon size={15} aria-hidden="true" /> Map
            </button>
            <button
              type="button"
              className={`btn btn-sm ${view === 'list' ? 'btn-soft' : 'btn-ghost'}`}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <LayoutGrid size={15} aria-hidden="true" /> Cards only
            </button>
          </div>
        </div>

        <div className="card card-sm toolbar-sticky" style={{ marginBottom: '1.25rem' }}>
          <div className="toolbar" role="group" aria-label="Filters">
            <div className="input-icon">
              <Search size={16} aria-hidden="true" />
              <label className="sr-only" htmlFor="f-search">
                Search
              </label>
              <input
                id="f-search"
                className="input"
                type="search"
                placeholder="Search code, title or area"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="sr-only" htmlFor="f-status">
              Status
            </label>
            <select
              id="f-status"
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status | '')}
            >
              <option value="">All statuses</option>
              {statuses.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABEL[st]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="f-priority">
              Priority
            </label>
            <select
              id="f-priority"
              className="select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority | '')}
            >
              <option value="">All priorities</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="f-category">
              Category
            </label>
            <select
              id="f-category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="f-sort">
              Sort by
            </label>
            <select
              id="f-sort"
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="priority">Most urgent first</option>
              <option value="newest">Newest first</option>
              <option value="upvotes">Most supported</option>
            </select>
          </div>
        </div>

        {issues.error && <ErrorAlert error={issues.error} onRetry={issues.reload} />}

        {view === 'map' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Suspense fallback={<SkeletonLines lines={3} />}>
              <IssueMap
                issues={issues.data?.items ?? []}
                label="Map of complaints, colour-coded by priority"
              />
            </Suspense>
            <p className="xs muted" style={{ marginTop: '0.6rem' }}>
              Marker colour shows priority (red critical → green low); faded markers are closed. The
              cards below list the same complaints.
            </p>
          </div>
        )}

        {issues.loading && !issues.data && <SkeletonLines lines={5} />}
        {issues.data?.items.length === 0 && (
          <p className="empty">No complaints match these filters.</p>
        )}
        <ul className="issue-grid">
          {issues.data?.items.map((issue) => (
            <li key={issue.id}>
              <IssueCard issue={issue} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NammaWardScorecard() {
  const ZONES = [
    { name: 'West Zone (மேற்கு)', areas: 'Vadavalli · Saibaba Colony · RS Puram West', resolved: 95, time: '18h', count: 19, rank: '1 🏆' },
    { name: 'Central Zone (மத்திய)', areas: 'RS Puram · Gandhipuram · Town Hall', resolved: 92, time: '22h', count: 24, rank: '2' },
    { name: 'East Zone (கிழக்கு)', areas: 'Peelamedu · Singanallur · Hopes', resolved: 87, time: '28h', count: 31, rank: '3' },
    { name: 'South Zone (தெற்கு)', areas: 'Ukkadam · Kuniyamuthur · Kovaipudur', resolved: 85, time: '31h', count: 26, rank: '4' },
    { name: 'North Zone (வடக்கு)', areas: 'Saravanampatti · Ganapathy · Thudiyalur', resolved: 82, time: '34h', count: 28, rank: '5' },
  ];

  return (
    <section className="section" aria-labelledby="ward-title" style={{ marginTop: '2.5rem' }}>
      <div className="section-head">
        <div>
          <p className="eyebrow">Ward Accountability</p>
          <h2 id="ward-title">Namma Ward Scorecard (நம்ம வார்டு)</h2>
          <p>Coimbatore City Municipal Corporation (CCMC) 100-Ward zonal speed &amp; resolution rankings.</p>
        </div>
      </div>
      <div className="grid grid-kpi" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
        {ZONES.map((z) => (
          <div className="card card-sm" key={z.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div className="row between">
              <span className="xs code" style={{ fontWeight: 700, color: 'var(--primary)' }}>Rank #{z.rank}</span>
              <span className="badge badge-sm s-resolved">{z.resolved}% Fixed</span>
            </div>
            <strong style={{ fontSize: '0.94rem' }}>{z.name}</strong>
            <span className="xs muted" style={{ lineHeight: 1.35 }}>{z.areas}</span>
            <div className="row between" style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem' }}>
              <span className="muted">Avg: <strong>{z.time}</strong></span>
              <span className="muted">Total: <strong>{z.count}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
