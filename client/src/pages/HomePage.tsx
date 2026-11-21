import {
  ArrowRight,
  Building2,
  CircleCheck,
  Clock,
  Inbox,
  Languages,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { ErrorAlert, SkeletonLines } from '../components/Feedback';
import { IssueCard } from '../components/IssueCard';
import { usePageTitle } from '../components/Layout';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import { formatHours } from '../lib/format';

const FEATURED_CATEGORIES = [
  'Roads & Potholes',
  'Garbage & Sanitation',
  'Streetlights & Electricity',
  'Water Supply & Leakage',
  'Drainage & Sewage',
  'Traffic & Signals',
  'Parks & Public Spaces',
  'Stray Animals',
];

const STEPS: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: MessageSquareText,
    title: 'Describe it your way',
    body: 'Type or speak in English, Tamil or Hindi. Add a photo and drop a pin — that’s it.',
  },
  {
    Icon: Sparkles,
    title: 'Gemini triages instantly',
    body: 'AI reads your words and photo, sets the category and urgency, and routes it to the right department — with its reasoning.',
  },
  {
    Icon: Search,
    title: 'Follow it to resolution',
    body: 'Every update from officials appears on your tracking page, from “Reported” to “Resolved”.',
  },
];

export function HomePage() {
  usePageTitle('Report civic issues with AI');
  const stats = useAsync(() => api.stats(), []);
  const resolved = useAsync(() => api.listIssues({ status: 'resolved', limit: 20 }), []);
  const fixed = (resolved.data?.items ?? []).filter((i) => i.resolution?.photo).slice(0, 3);
  const urgent = useAsync(
    () => api.listIssues({ sort: 'priority', status: 'reported', limit: 6 }),
    [],
  );

  const kpis: {
    Icon: LucideIcon;
    tone: string;
    label: string;
    value: string | number | undefined;
  }[] = [
    { Icon: Inbox, tone: '', label: 'Complaints received', value: stats.data?.total },
    { Icon: Clock, tone: 'amber', label: 'Open right now', value: stats.data?.open },
    { Icon: CircleCheck, tone: 'green', label: 'Resolved', value: stats.data?.byStatus.resolved },
    {
      Icon: Timer,
      tone: 'slate',
      label: 'Avg. resolution time',
      value: stats.data ? formatHours(stats.data.avgResolutionHours) : undefined,
    },
  ];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div>
            <span className="hero-badge">
              <span className="dot" aria-hidden="true">
                <Sparkles size={13} />
              </span>
              AI triage powered by Google Gemini
            </span>
            <h1 id="hero-title">
              Coimbatore Citizen <span className="accent">Grievance Portal</span>
            </h1>
            <p className="lead">
              Report civic issues — potholes, garbage, broken streetlights, water leaks — in English, Tamil or Hindi.
              Gemini AI reads your complaint, sets priority, and routes it to the right municipal department instantly.
            </p>
            <div className="hero-ctas">
              <Link to="/report" className="btn btn-primary btn-lg">
                File a Complaint
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/track" className="btn btn-outline btn-lg">
                Track Your Complaint
              </Link>
            </div>
            <ul className="hero-points">
              <li>
                <Languages size={16} aria-hidden="true" /> English · தமிழ் · हिन्दी
              </li>
              <li>
                <MapPin size={16} aria-hidden="true" /> Photo & GPS location
              </li>
              <li>
                <ShieldCheck size={16} aria-hidden="true" /> Contact details stay private
              </li>
            </ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      <div className="container">
        <section aria-label="City at a glance">
          {stats.error ? (
            <ErrorAlert error={stats.error} onRetry={stats.reload} />
          ) : (
            <div className="stats-band" aria-busy={stats.loading}>
              {kpis.map(({ Icon, tone, label, value }) => (
                <div key={label}>
                  <span className={`icon-tile ${tone}`} aria-hidden="true">
                    <Icon size={19} />
                  </span>
                  <div>
                    <div className="stat-value">{value ?? '—'}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section" aria-labelledby="cats-title">
          <div className="section-head">
            <div>
              <h2 id="cats-title">What can you report?</h2>
              <p>Pick a category to start — or just describe it and let AI decide.</p>
            </div>
          </div>
          <ul className="cat-grid">
            {FEATURED_CATEGORIES.map((c) => (
              <li key={c}>
                <Link className="cat-tile" to={`/report?category=${encodeURIComponent(c)}`}>
                  <CategoryIcon category={c} size="sm" />
                  {c}
                  <ArrowRight className="arrow" size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="section" aria-labelledby="how-title">
          <div className="section-head">
            <div>
              <h2 id="how-title">How it works</h2>
              <p>From a quick report to a resolved issue, in the open.</p>
            </div>
          </div>
          <ol className="steps">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li className="step" key={title}>
                <span className="n" aria-hidden="true">
                  0{i + 1}
                </span>
                <span className="icon-tile" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {fixed.length > 0 && (
          <section className="section" aria-labelledby="fixed-title">
            <div className="section-head">
              <div>
                <h2 id="fixed-title">Recently fixed</h2>
                <p>
                  Officials close the loop with a proof-of-resolution photo, visible to everyone.
                  (Sample data · photos via Wikimedia Commons.)
                </p>
              </div>
            </div>
            <ul className="issue-grid">
              {fixed.map((issue) => (
                <li key={issue.id}>
                  <article className="fixed-card">
                    <div className="pair">
                      {[
                        issue.hasImage && { kind: 'report' as const, label: 'Before', tone: '' },
                        { kind: 'resolution' as const, label: 'After', tone: 'green' },
                      ]
                        .filter(
                          (
                            p,
                          ): p is { kind: 'report' | 'resolution'; label: string; tone: string } =>
                            Boolean(p),
                        )
                        .map((p) => (
                          <div className="photo-frame" key={p.kind}>
                            <img
                              src={api.imageUrl(issue.code, p.kind)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                            <span className={`photo-tag ${p.tone}`}>{p.label}</span>
                          </div>
                        ))}
                    </div>
                    <div className="body">
                      <div className="row row-tight" style={{ marginBottom: '0.5rem' }}>
                        <StatusBadge status={issue.status} />
                        <span className="code xs">{issue.code}</span>
                      </div>
                      <h3 style={{ fontSize: '0.98rem', lineHeight: 1.35 }}>
                        <Link to={`/track/${issue.code}`}>{issue.title}</Link>
                      </h3>
                      {issue.resolution?.note && (
                        <p className="xs muted" style={{ marginTop: '0.4rem' }}>
                          {issue.resolution.note}
                        </p>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="section" aria-labelledby="urgent-title">
          <div className="section-head">
            <div>
              <h2 id="urgent-title">Needs attention now</h2>
              <p>Open reports ranked by AI impact score, community support and age.</p>
            </div>
            <Link to="/dashboard" className="link-arrow">
              View city dashboard <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {urgent.error && <ErrorAlert error={urgent.error} onRetry={urgent.reload} />}
          {urgent.loading && !urgent.data && <SkeletonLines lines={4} />}
          {urgent.data && urgent.data.items.length === 0 && (
            <p className="empty">No open reports right now.</p>
          )}
          {urgent.data && (
            <ul className="issue-grid">
              {urgent.data.items.map((issue) => (
                <li key={issue.id}>
                  <IssueCard issue={issue} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/** Static illustration of the product: what a citizen sees after AI triage. */
function HeroPreview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-card">
        <div className="preview-top">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <span>AI triage · just now</span>
        </div>
        <div className="preview-body">
          <img className="hero-photo" src="/hero-pothole.jpg" alt="" />
          <div className="quote">
            “மெயின் ரோட்டில் பெரிய குழிகள், மழை பெய்தால் தண்ணீர் தேங்கி நிற்கிறது.”
            <small>Translated: Big potholes on the main road; water collects when it rains.</small>
          </div>
          <dl className="kv">
            <div>
              <dt>Category</dt>
              <dd>
                <CategoryIcon category="Roads & Potholes" size="sm" />
                Roads &amp; Potholes
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                <PriorityBadge priority="high" />
              </dd>
            </div>
            <div className="full">
              <dt>Impact score · 76/100</dt>
              <dd style={{ display: 'block' }}>
                <div className="meter meter-high">
                  <span style={{ width: '76%' }} />
                </div>
              </dd>
            </div>
            <div className="full">
              <dt>Routed to</dt>
              <dd>
                <Building2 size={16} color="var(--muted)" />
                Public Works Department (Roads)
              </dd>
            </div>
          </dl>
        </div>
        <div className="preview-foot">
          <span className="icon-tile green sm">
            <CircleCheck size={16} />
          </span>
          <span>
            <strong>CR-7K2M9Q resolved</strong>
            <span className="muted xs">Fixed in 26 hours · rated 5★</span>
          </span>
          <StatusBadge status="resolved" />
        </div>
      </div>
    </div>
  );
}
