import type { ReactElement } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import type { Priority, Stats, Status } from '../lib/types';

const BLUE = '#2458e6';
const GREEN = '#1f9d5c';
const STATUS_COLORS: Record<Status, string> = {
  reported: BLUE,
  in_progress: '#e0a100',
  resolved: GREEN,
  rejected: '#a3afc2',
};
const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#e03131',
  high: '#f0700f',
  medium: '#e0a100',
  low: GREEN,
};

const axis = { fontSize: 12, fill: '#64748f' };
const grid = { stroke: '#e2e9f3', strokeDasharray: '3 4' };
const tooltip = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e2e9f3',
    boxShadow: '0 12px 32px -14px rgb(15 40 90 / 25%)',
    fontSize: 13,
  },
  cursor: { fill: 'rgb(36 88 230 / 6%)' },
};

function ChartCard(props: { title: string; sub: string; summary: string; children: ReactElement }) {
  return (
    <figure className="card chart-card" style={{ margin: 0 }}>
      <figcaption>
        <h3>{props.title}</h3>
        <p>{props.sub}</p>
      </figcaption>
      <div className="chart-box">
        <ResponsiveContainer>{props.children}</ResponsiveContainer>
      </div>
      <p className="sr-only">{props.summary}</p>
    </figure>
  );
}

/** Recharts visualisations — lazy-loaded so the citizen reporting flow stays lightweight. */
export default function Charts({ stats }: { stats: Stats }) {
  const byCategory = Object.entries(stats.byCategory)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  const byStatus = (Object.keys(stats.byStatus) as Status[])
    .map((s) => ({ name: STATUS_LABEL[s], key: s, value: stats.byStatus[s] }))
    .filter((d) => d.value > 0);
  const byPriority = (Object.keys(stats.byPriority) as Priority[]).map((p) => ({
    name: PRIORITY_LABEL[p],
    key: p,
    value: stats.byPriority[p],
  }));
  const trend = stats.trend.map((t) => ({ ...t, label: t.date.slice(5) }));
  const sum = (k: 'reported' | 'resolved') => trend.reduce((a, t) => a + t[k], 0);

  return (
    <div className="chart-grid">
      <ChartCard
        title="Reported vs resolved"
        sub="Last 14 days"
        summary={`Last 14 days: ${sum('reported')} reported, ${sum('resolved')} resolved.`}
      >
        <AreaChart data={trend} margin={{ right: 8, left: -18, top: 6 }}>
          <defs>
            <linearGradient id="gReported" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity={0.18} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip {...tooltip} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotoneX"
            dataKey="reported"
            name="Reported"
            stroke={BLUE}
            strokeWidth={2.2}
            fill="url(#gReported)"
          />
          <Area
            type="monotoneX"
            dataKey="resolved"
            name="Resolved"
            stroke={GREEN}
            strokeWidth={2.2}
            fill="url(#gResolved)"
          />
        </AreaChart>
      </ChartCard>

      <ChartCard
        title="By category"
        sub="All complaints"
        summary={byCategory.map((c) => `${c.name}: ${c.count}`).join('; ')}
      >
        <BarChart data={byCategory} layout="vertical" margin={{ left: 0, right: 16 }}>
          <CartesianGrid {...grid} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={axis}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            interval={0}
            tick={{ ...axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip {...tooltip} />
          <Bar dataKey="count" name="Complaints" fill={BLUE} radius={[0, 6, 6, 0]} barSize={14} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="Status"
        sub="Where complaints are in the workflow"
        summary={byStatus.map((s) => `${s.name}: ${s.value}`).join('; ')}
      >
        <PieChart>
          <Pie
            data={byStatus}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="85%"
            paddingAngle={3}
            stroke="none"
          >
            {byStatus.map((d) => (
              <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
            ))}
          </Pie>
          <Tooltip {...tooltip} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ChartCard>

      <ChartCard
        title="Priority mix"
        sub="As assessed by AI and officials"
        summary={byPriority.map((p) => `${p.name}: ${p.value}`).join('; ')}
      >
        <BarChart data={byPriority} margin={{ left: -18, top: 6 }}>
          <CartesianGrid {...grid} vertical={false} />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip {...tooltip} />
          <Bar dataKey="value" name="Complaints" radius={[6, 6, 0, 0]} barSize={36}>
            {byPriority.map((d) => (
              <Cell key={d.key} fill={PRIORITY_COLORS[d.key]} />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>
    </div>
  );
}
