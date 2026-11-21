import {
  CircleCheck,
  Clock,
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

        <div className="card card-sm" style={{ marginBottom: '1.25rem' }}>
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
