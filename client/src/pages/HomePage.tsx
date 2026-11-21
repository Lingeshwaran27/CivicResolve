import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Building2,
  CircleCheck,
  Clock,
  ExternalLink,
  Inbox,
  Languages,
  MapPin,
  MessageSquareText,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
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

const CIVIC_BULLETINS = [
  '💧 Siruvani Water: West Zone (Wards 21–35, RS Puram & Vadavalli) supply cycle active today 6:00 AM – 11:30 AM.',
  '⚡ TANGEDCO: Sub-station maintenance power shutdown in Peelamedu & Hope College tomorrow 9 AM – 2 PM.',
  '🚧 Avinashi Expressway: Elevated corridor beam work near Lakshmi Mills; light vehicles advised to use Race Course.',
  '🧹 Clean Coimbatore: Valankulam lake bund desilting and plastics clearance drive scheduled this Saturday.',
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
        <div className="container" style={{ marginBottom: '1.5rem' }}>
          <div className="civic-bulletin" role="region" aria-label="Live municipal bulletin">
            <div className="bulletin-tag">
              <span className="live-dot" aria-hidden="true" />
              <span>Coimbatore Live Updates</span>
            </div>
            <div className="bulletin-marquee" tabIndex={0} aria-label="Live news scroll, hover to pause">
              <div className="bulletin-track">
                {[...CIVIC_BULLETINS, ...CIVIC_BULLETINS].map((text, idx) => (
                  <span className="bulletin-item" key={idx}>
                    <span>{text}</span>
                    <span className="bulletin-sep" aria-hidden="true">
                      ·
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="container hero-grid">
          <div className="hero-content">
            <span className="hero-badge">
              <span className="dot" aria-hidden="true">
                <Sparkles size={13} />
              </span>
              AI triage powered by Google Gemini
            </span>
            <h1 id="hero-title">
              Fix your city, <span className="accent">one report at a time.</span>
            </h1>
            <p className="lead">
              Report civic issues — potholes, garbage, broken streetlights, water leaks — in English, Tamil or Hindi.
              Gemini AI reads your complaint, sets priority, and routes it to the right municipal department instantly.
            </p>
            <div className="hero-ctas">
              <Link to="/report" className="btn btn-primary btn-lg">
                Report an issue
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/track" className="btn btn-outline btn-lg">
                Track a complaint
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

interface TriageScenario {
  id: string;
  tabLabel: string;
  badge: string;
  image: string;
  afterImage?: string;
  hasBeforeAfter?: boolean;
  hazardTag: string;
  originalText: string;
  translatedText: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number;
  routedTo: string;
  reasoning: string;
  outcomeText: string;
  outcomeSub: string;
  code: string;
}

const TRIAGE_SCENARIOS: TriageScenario[] = [
  {
    id: 'tamil-pothole',
    tabLabel: '🇮🇳 தமிழ் Pothole',
    badge: 'Tamil AI Triage · Vision Analysis',
    image: '/hero-pothole.jpg',
    hazardTag: 'Deep Crater · Water Stagnation Risk',
    originalText: '“மெயின் ரோட்டில் பெரிய குழிகள், மழை பெய்தால் தண்ணீர் தேங்கி நிற்கிறது.”',
    translatedText: 'Big potholes on the main road; water collects when it rains.',
    category: 'Roads & Potholes',
    priority: 'high',
    impactScore: 76,
    routedTo: 'Public Works Department (Roads)',
    reasoning: 'Gemini detected arterial asphalt crater posing acute skidding risk for 2-wheelers.',
    outcomeText: 'CR-PSG002 · Triaged & Dispatched',
    outcomeSub: 'Road restoration crew assigned · 48h SLA',
    code: 'CR-PSG002',
  },
  {
    id: 'hindi-wire',
    tabLabel: '⚡ हिन्दी Live Wire',
    badge: 'Hindi AI Triage · Emergency Escalation',
    image: '/hero-wire.jpg',
    hazardTag: 'Exposed Cable · High Shock Risk',
    originalText: '“स्कूल के पास बिजली का खंभा झुक गया है और नंगे तार लटक रहे हैं।”',
    translatedText: 'Electric pole leaning near school with exposed live wires dangling.',
    category: 'Streetlights & Electricity',
    priority: 'critical',
    impactScore: 96,
    routedTo: 'TANGEDCO (24/7 Rapid Emergency Response)',
    reasoning: 'Gemini Vision detected dangling high-voltage line within 20m of school pedestrian zone.',
    outcomeText: 'CR-PSG001 · Emergency Escalation',
    outcomeSub: 'Peelamedu sub-station crew dispatched · ETA 35m',
    code: 'CR-PSG001',
  },
  {
    id: 'manhole-resolved',
    tabLabel: '✅ Manhole Fixed (Before & After)',
    badge: 'AI Anti-Fraud · Landmark Alignment Check',
    image: '/hero-manhole-before.jpg',
    afterImage: '/hero-manhole-after.jpg',
    hasBeforeAfter: true,
    hazardTag: 'Chamber Re-sealed · 94% Landmark Match Verified',
    originalText: '“Race Course walking track open stormwater manhole missing cast-iron slab.”',
    translatedText: 'Open inspection pit poses fatal falling hazard to joggers and pedestrians.',
    category: 'Drainage & Sewage',
    priority: 'high',
    impactScore: 88,
    routedTo: 'CCMC Central Sewage Wing',
    reasoning: 'Before & After photos match GPS coordinates. 94% landmark alignment confirms heavy cast-iron slab sealed.',
    outcomeText: 'CR-PSG005 · Verified Resolved',
    outcomeSub: 'Fixed in 18 hrs · Citizen rated 5.0 ★',
    code: 'CR-PSG005',
  },
];

interface RadarPin {
  id: string;
  code: string;
  ward: string;
  name: string;
  issue: string;
  dept: string;
  priority: 'critical' | 'high' | 'resolved' | 'medium';
  color: string;
  status: string;
  x: number;
  y: number;
  eta: string;
}

const RADAR_PINS: RadarPin[] = [
  {
    id: 'pin-1',
    code: 'CR-PSG001',
    ward: 'Ward 34',
    name: 'Peelamedu',
    issue: 'Exposed live wire dangling near school zone',
    dept: 'TANGEDCO Emergency Line',
    priority: 'critical',
    color: '#ef4444',
    status: 'Crew En Route',
    x: 68,
    y: 38,
    eta: 'ETA 35m',
  },
  {
    id: 'pin-2',
    code: 'CR-PSG002',
    ward: 'Ward 22',
    name: 'Gandhipuram',
    issue: 'Major potholes & monsoon road flooding',
    dept: 'CCMC PWD Roads Wing',
    priority: 'high',
    color: '#f59e0b',
    status: 'Materials Allocated',
    x: 52,
    y: 44,
    eta: 'SLA: 32h remaining',
  },
  {
    id: 'pin-3',
    code: 'CR-PSG005',
    ward: 'Ward 65',
    name: 'Race Course',
    issue: 'Stormwater manhole chamber cover sealed',
    dept: 'CCMC Sewage Wing',
    priority: 'resolved',
    color: '#22c55e',
    status: 'Verified Closed',
    x: 56,
    y: 65,
    eta: 'Fixed in 18h',
  },
  {
    id: 'pin-4',
    code: 'CR-PSG004',
    ward: 'Ward 45',
    name: 'Ukkadam',
    issue: 'Main pipeline burst (100 PSI water surge)',
    dept: 'TWAD / Suez Water',
    priority: 'high',
    color: '#38bdf8',
    status: 'Valved Off / Repairing',
    x: 34,
    y: 72,
    eta: 'ETA 2h',
  },
];

/** Interactive Hero: Dual-mode AI Triage Simulator & Live City Operations Radar */
function HeroPreview() {
  const [mode, setMode] = useState<'triage' | 'radar'>('triage');
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [manholeTab, setManholeTab] = useState<'before' | 'after'>('after');
  const [selectedPinId, setSelectedPinId] = useState('pin-1');
  const [isPaused, setIsPaused] = useState(false);

  // Auto-cycle scenarios every 5.5s unless hovered or manually paused
  useEffect(() => {
    if (mode !== 'triage' || isPaused) return;
    const timer = setInterval(() => {
      setScenarioIdx((prev) => (prev + 1) % TRIAGE_SCENARIOS.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [mode, isPaused]);

  const scenario = TRIAGE_SCENARIOS[scenarioIdx] ?? TRIAGE_SCENARIOS[0]!;
  const activePin = RADAR_PINS.find((p) => p.id === selectedPinId) ?? RADAR_PINS[0]!;

  return (
    <div
      className="preview"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="CivicResolve interactive showcase"
    >
      <div className="preview-card">
        {/* Top Control Bar with Mode Switcher & Live Pulse */}
        <div className="preview-mode-bar">
          <div className="mode-toggle-group" role="tablist" aria-label="Showcase view">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'triage'}
              className={`mode-tab-btn ${mode === 'triage' ? 'active' : ''}`}
              onClick={() => {
                setMode('triage');
                setIsPaused(true);
              }}
            >
              <Sparkles size={14} />
              <span>AI Triage Demo</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'radar'}
              className={`mode-tab-btn ${mode === 'radar' ? 'active' : ''}`}
              onClick={() => {
                setMode('radar');
                setIsPaused(true);
              }}
            >
              <Radio size={14} />
              <span>Live City Radar</span>
            </button>
          </div>

          <div className="live-pulse-indicator" title="Connected to Google Gemini 2.5 Flash & CCMC Central Hub">
            <span className="live-pulse-dot" aria-hidden="true" />
            <span>{mode === 'triage' ? (isPaused ? 'Interactive' : 'Auto-Tour') : 'Coimbatore Ward Hub'}</span>
          </div>
        </div>

        {/* ─────────────── MODE 1: AI TRIAGE SIMULATOR ─────────────── */}
        {mode === 'triage' && (
          <>
            {/* Scenario Quick Selector Chips */}
            <div className="scenario-nav" role="tablist" aria-label="Civic scenarios">
              {TRIAGE_SCENARIOS.map((sc, idx) => (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  aria-selected={scenarioIdx === idx}
                  className={`scenario-chip ${scenarioIdx === idx ? 'active' : ''}`}
                  onClick={() => {
                    setScenarioIdx(idx);
                    setIsPaused(true);
                  }}
                >
                  {sc.tabLabel}
                </button>
              ))}
            </div>

            <div className="preview-body" style={{ padding: '1.15rem 1.35rem', gap: '1rem' }}>
              {/* Media container with photo & floating AI hazard tag */}
              <div className="preview-media-box">
                <img
                  src={
                    scenario.hasBeforeAfter && manholeTab === 'before'
                      ? scenario.image
                      : scenario.hasBeforeAfter && manholeTab === 'after'
                        ? scenario.afterImage
                        : scenario.image
                  }
                  alt={scenario.tabLabel}
                />
                <span className="media-hazard-badge">
                  <ShieldCheck size={13} color="#38bdf8" />
                  <span>{scenario.hazardTag}</span>
                </span>

                {scenario.hasBeforeAfter && (
                  <div className="media-proof-toggle">
                    <button
                      type="button"
                      className={`proof-toggle-btn ${manholeTab === 'before' ? 'active' : ''}`}
                      onClick={() => setManholeTab('before')}
                    >
                      Before
                    </button>
                    <button
                      type="button"
                      className={`proof-toggle-btn ${manholeTab === 'after' ? 'active' : ''}`}
                      onClick={() => setManholeTab('after')}
                    >
                      After Fixed ✓
                    </button>
                  </div>
                )}
              </div>

              {/* Native Language Quote & Instant Translation */}
              <div className="quote" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 600 }}>{scenario.originalText}</div>
                <small style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Languages size={13} />
                  <span>Translated: {scenario.translatedText}</span>
                </small>
              </div>

              {/* Key Values Grid */}
              <dl className="kv" style={{ gap: '0.75rem 1rem' }}>
                <div>
                  <dt>Category</dt>
                  <dd>
                    <CategoryIcon category={scenario.category} size="sm" />
                    <span>{scenario.category}</span>
                  </dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>
                    <PriorityBadge priority={scenario.priority} />
                  </dd>
                </div>
                <div className="full">
                  <dt style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Impact Score</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{scenario.impactScore} / 100</span>
                  </dt>
                  <dd style={{ display: 'block' }}>
                    <div className={`meter meter-${scenario.impactScore > 85 ? 'critical' : 'high'}`}>
                      <span style={{ width: `${scenario.impactScore}%` }} />
                    </div>
                  </dd>
                </div>
                <div className="full">
                  <dt>Routed to</dt>
                  <dd>
                    <Building2 size={15} color="var(--muted)" />
                    <span>{scenario.routedTo}</span>
                  </dd>
                </div>
              </dl>

              {/* AI Reasoning pill */}
              <div className="ai-reasoning-banner">
                <Sparkles size={16} />
                <div>
                  <strong>Gemini AI Reasoning</strong>
                  <span>{scenario.reasoning}</span>
                </div>
              </div>
            </div>

            {/* Bottom Outcome Strip */}
            <div className="preview-foot" style={{ padding: '0.85rem 1.35rem' }}>
              <span className={`icon-tile ${scenario.priority === 'critical' ? 'amber' : 'green'} sm`}>
                {scenario.priority === 'critical' ? <Zap size={16} /> : <CircleCheck size={16} />}
              </span>
              <span>
                <strong>{scenario.outcomeText}</strong>
                <span className="muted xs">{scenario.outcomeSub}</span>
              </span>
              <Link
                to={`/track/${scenario.code}`}
                className="btn btn-outline btn-sm"
                style={{ marginLeft: 'auto', fontSize: '0.75rem', height: '30px', padding: '0 0.65rem' }}
              >
                Track <ArrowRight size={12} />
              </Link>
            </div>
          </>
        )}

        {/* ─────────────── MODE 2: CITY COMMAND RADAR (Idea 3) ─────────────── */}
        {mode === 'radar' && (
          <div className="radar-hub">
            <div className="radar-header">
              <h3>
                <Activity size={16} color="#38bdf8" />
                <span>CCMC Central Operations Hub</span>
              </h3>
              <span className="radar-badge">Coimbatore 100 Wards</span>
            </div>

            {/* Radar Screen Graphic */}
            <div className="radar-screen" role="region" aria-label="Live Coimbatore civic radar map">
              <div className="radar-grid-bg" />
              <div className="radar-ring r1" />
              <div className="radar-ring r2" />
              <div className="radar-ring r3" />
              <div className="radar-axis-h" />
              <div className="radar-axis-v" />
              <div className="radar-beam" />

              {/* Radar Pins */}
              {RADAR_PINS.map((pin) => {
                const isSelected = selectedPinId === pin.id;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    className={`radar-target ${isSelected ? 'active' : ''}`}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%`, color: pin.color }}
                    onClick={() => setSelectedPinId(pin.id)}
                    aria-label={`${pin.name} - ${pin.issue}`}
                  >
                    <div className="target-point">
                      <div className="target-ping" />
                    </div>
                    <span className="target-label">
                      {pin.name} ({pin.ward})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Active Radar Ticket Card */}
            <div className="radar-detail-card">
              <div className="radar-detail-top">
                <span style={{ fontWeight: 700, color: activePin.color, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={13} />
                  <span>{activePin.name} · {activePin.ward}</span>
                </span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: '0.7rem' }}>
                  {activePin.status}
                </span>
              </div>
              <h4 className="radar-detail-title">{activePin.issue}</h4>
              <div className="radar-detail-meta">
                <span>{activePin.dept} · <strong style={{ color: '#f8fafc' }}>{activePin.eta}</strong></span>
                <Link to={`/track/${activePin.code}`} className="radar-detail-link">
                  <span>Track {activePin.code}</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>

            {/* Municipal Radar Performance Band */}
            <div className="radar-metrics-band">
              <div className="radar-metric-item">
                <span className="radar-metric-val">1.2s</span>
                <span className="radar-metric-lbl">AI Triage</span>
              </div>
              <div className="radar-metric-item">
                <span className="radar-metric-val">94.2%</span>
                <span className="radar-metric-lbl">Anti-Fraud</span>
              </div>
              <div className="radar-metric-item">
                <span className="radar-metric-val">26h</span>
                <span className="radar-metric-lbl">Avg SLA</span>
              </div>
              <div className="radar-metric-item">
                <span className="radar-metric-val">100 Wards</span>
                <span className="radar-metric-lbl">Live Coverage</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
