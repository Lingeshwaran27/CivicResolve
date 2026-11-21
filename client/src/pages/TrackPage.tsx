import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  CircleAlert,
  Copy,
  MapPin,
  Printer,
  Search,
  Share2,
  Star,
  ThumbsUp,
} from 'lucide-react';
import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AiInsightCard } from '../components/AiInsightCard';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { ErrorAlert, SkeletonLines, Spinner } from '../components/Feedback';
import { usePageTitle } from '../components/Layout';
import { PhotoFigure } from '../components/PhotoFigure';
import { StatusStepper, Timeline } from '../components/StatusTracker';
import { useAsync } from '../hooks/useAsync';
import { useCatalog } from '../hooks/useCatalog';
import { api } from '../lib/api';
import { departmentName, formatDateTime } from '../lib/format';
import type { Issue } from '../lib/types';

const IssueMap = lazy(() => import('../components/IssueMap'));
const CODE_RE = /^CR-[A-Z0-9]{6}$/;

export default function TrackPage() {
  const { code } = useParams();
  return code ? <IssueDetail code={code.toUpperCase()} /> : <TrackForm />;
}

function TrackForm() {
  usePageTitle('Track a complaint');
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    let code = value.trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(code)) code = `CR-${code}`;
    if (!CODE_RE.test(code)) {
      setError('Tracking codes look like CR-7K2M9Q.');
      return;
    }
    navigate(`/track/${code}`);
  }

  return (
    <div className="container" style={{ maxWidth: 620, paddingTop: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span className="icon-tile lg" style={{ margin: '0 auto 1.25rem' }} aria-hidden="true">
          <Search size={24} />
        </span>
        <h1>Track a complaint</h1>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Enter the tracking code you received when you submitted your report.
        </p>
      </div>
      <form className="card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="track-code">Tracking code</label>
          <div className="input-row">
            <input
              id="track-code"
              className="input mono"
              style={{ fontSize: '1rem', letterSpacing: '0.06em' }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="CR-XXXXXX"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'track-code-err' : undefined}
            />
            <button className="btn btn-primary" type="submit" style={{ height: 46 }}>
              Track
            </button>
          </div>
          {error && (
            <p className="field-error" id="track-code-err">
              <CircleAlert size={14} aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
        <div className="row row-tight" style={{ marginTop: '1.25rem' }}>
          <span className="xs muted">Try a demo:</span>
          <Link className="chip mono" to="/track/CR-PSG001">
            CR-PSG001
          </Link>
          <Link className="chip mono" to="/track/CR-PSG005">
            CR-PSG005
          </Link>
          <Link className="chip mono" to="/track/CR-PSG004">
            CR-PSG004
          </Link>
        </div>
      </form>
    </div>
  );
}

function IssueDetail({ code }: { code: string }) {
  const { departments } = useCatalog();
  const state = useAsync(() => api.getIssue(code), [code]);
  const [copied, setCopied] = useState(false);
  usePageTitle(state.data ? `${code}: ${state.data.issue.title}` : `Complaint ${code}`);

  if (state.loading && !state.data) {
    return (
      <div className="container empty" role="status" aria-live="polite">
        <Spinner label={`Loading complaint ${code}…`} size={20} />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="container" style={{ maxWidth: 620 }}>
        <h1 style={{ marginBottom: '1.25rem' }}>Complaint {code}</h1>
        <ErrorAlert error={state.error} onRetry={state.reload} />
        <Link to="/track" className="link-arrow" style={{ marginTop: '1.25rem' }}>
          <ArrowLeft size={16} aria-hidden="true" /> Try another code
        </Link>
      </div>
    );
  }
  if (!state.data) return null;
  const issue = state.data.issue;
  const update = (i: Issue) => state.setData({ issue: i });

  return (
    <div className="container">
      <Link to="/track" className="link-arrow small" style={{ marginBottom: '1.25rem' }}>
        <ArrowLeft size={15} aria-hidden="true" /> Track another
      </Link>

      <header className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: '1rem', flex: '1 1 420px' }}>
            <CategoryIcon category={issue.category} />
            <div style={{ minWidth: 0 }}>
              <div className="row row-tight" style={{ marginBottom: '0.5rem' }}>
                <StatusBadge status={issue.status} />
                <PriorityBadge priority={issue.priority} />
                {issue.overdue && <span className="badge badge-overdue">Past target date</span>}
              </div>
              <h1 style={{ fontSize: 'clamp(1.4rem, 2.6vw, 1.85rem)' }}>{issue.title}</h1>
              <ul className="meta-list" style={{ marginTop: '0.75rem' }}>
                <li>{issue.category}</li>
                <li>
                  <Building2 size={15} aria-hidden="true" />
                  <strong>{departmentName(issue.department, departments)}</strong>
                </li>
                <li>
                  <CalendarClock size={15} aria-hidden="true" />
                  Reported <time dateTime={issue.createdAt}>{formatDateTime(issue.createdAt)}</time>
                </li>
              </ul>
            </div>
          </div>
          <div className="row row-tight">
            <button
              type="button"
              className="btn btn-outline btn-sm mono"
              onClick={() => {
                void navigator.clipboard?.writeText(issue.code).then(() => setCopied(true));
              }}
              aria-label={`Copy tracking code ${issue.code}`}
              title="Copy tracking code"
            >
              {copied ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              {issue.code}
            </button>
            <a
              className="btn btn-outline btn-sm"
              style={{ color: '#16a34a', borderColor: '#bbf7d0' }}
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Help fix our street! Track & upvote complaint ${issue.code} (${issue.title}) on CivicResolve: ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Share on WhatsApp for community upvotes"
            >
              <Share2 size={14} aria-hidden="true" /> WhatsApp
            </a>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => window.print()}
              title="Print official grievance acknowledgement"
            >
              <Printer size={14} aria-hidden="true" /> Print
            </button>
          </div>
        </div>
        <hr className="divider" />
        <StatusStepper status={issue.status} history={issue.history} />
        <p className="xs muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
          {issue.status === 'resolved' && issue.resolvedAt
            ? `Resolved on ${formatDateTime(issue.resolvedAt)}.`
            : `Target resolution by ${formatDateTime(issue.slaDueAt)} (department service level).`}
        </p>
      </header>

      <div className="split">
        <div className="stack">
          <section className="card" aria-labelledby="details-title">
            <h2 id="details-title" style={{ marginBottom: '1rem' }}>
              Details
            </h2>
            <p className="text-2" style={{ whiteSpace: 'pre-wrap' }}>
              {issue.description}
            </p>
            {(issue.hasImage || issue.resolution?.photo) && (
              <div style={{ marginTop: '1.5rem' }}>
                {issue.resolution?.photo && (
                  <h3 style={{ marginBottom: '0.75rem' }}>Before &amp; after</h3>
                )}
                <div
                  className={`photo-pair${issue.hasImage && issue.resolution?.photo ? '' : ' single'}`}
                >
                  {issue.hasImage && (
                    <PhotoFigure
                      src={api.imageUrl(issue.code)}
                      alt={`Evidence submitted with complaint: ${issue.title}`}
                      label="Reported"
                      credit={issue.photoCredit}
                    />
                  )}
                  {issue.resolution?.photo && (
                    <PhotoFigure
                      src={api.imageUrl(issue.code, 'resolution')}
                      alt={`Proof of resolution for ${issue.title}`}
                      label="Resolved"
                      tone="green"
                      credit={issue.resolution.credit}
                    />
                  )}
                </div>
                {issue.resolution?.note && (
                  <p className="callout small" style={{ marginTop: '0.9rem' }}>
                    <span>
                      <strong>Resolution note: </strong>
                      {issue.resolution.note}
                    </span>
                  </p>
                )}
              </div>
            )}
            {issue.sample && (
              <p className="xs muted" style={{ marginTop: '1rem' }}>
                Sample complaint from the demo dataset. Photos are openly licensed images used for
                illustration.
              </p>
            )}
            <p className="issue-place" style={{ marginTop: '1.25rem', marginBottom: '0.75rem' }}>
              <MapPin size={15} aria-hidden="true" />
              <span>{issue.location.address}</span>
            </p>
            {issue.location.lat !== null && (
              <Suspense fallback={<SkeletonLines lines={2} />}>
                <IssueMap
                  className="map map-sm"
                  issues={[issue]}
                  label={`Map showing the location of ${issue.code}`}
                />
              </Suspense>
            )}
          </section>

          <section className="card" aria-labelledby="history-title">
            <h2 id="history-title" style={{ marginBottom: '1.25rem' }}>
              Activity
            </h2>
            <Timeline events={issue.history} />
          </section>
        </div>

        <aside className="stack sticky" aria-label="AI analysis and actions">
          <SupportBox issue={issue} onUpdate={update} />
          {issue.status === 'resolved' && <RatingBox issue={issue} onUpdate={update} />}
          {issue.ai && <AiInsightCard analysis={issue.ai} heading="AI triage" />}
          {(issue.overrides.category || issue.overrides.priority || issue.overrides.department) && (
            <p className="xs muted">
              Officials adjusted the AI suggestion
              {issue.overrides.category ? ' (category)' : ''}
              {issue.overrides.priority ? ' (priority)' : ''}
              {issue.overrides.department ? ' (department)' : ''}.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function SupportBox({ issue, onUpdate }: { issue: Issue; onUpdate: (i: Issue) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const open = issue.status === 'reported' || issue.status === 'in_progress';

  async function support() {
    setBusy(true);
    try {
      const res = await api.upvote(issue.code);
      onUpdate(res.issue);
      setMsg({ ok: true, text: 'Thanks — your support has been counted.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not record support.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-sm" aria-labelledby="support-title">
      <div className="row" style={{ gap: '0.85rem', marginBottom: '1rem' }}>
        <span className="icon-tile" aria-hidden="true">
          <ThumbsUp size={18} />
        </span>
        <div>
          <h2 id="support-title" style={{ fontSize: '1rem' }}>
            Affected too?
          </h2>
          <p className="xs muted">
            {issue.upvotes} {issue.upvotes === 1 ? 'citizen has' : 'citizens have'} supported this
            complaint.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-soft btn-block"
        onClick={support}
        disabled={!open || busy}
      >
        {busy ? <Spinner label="Saving…" /> : 'I’m affected too'}
      </button>
      <p
        aria-live="polite"
        className={msg ? `xs ${msg.ok ? 'muted' : 'field-error'}` : 'sr-only'}
        style={{ marginTop: '0.6rem' }}
      >
        {msg?.text}
      </p>
    </section>
  );
}

function RatingBox({ issue, onUpdate }: { issue: Issue; onUpdate: (i: Issue) => void }) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (issue.rating) {
    return (
      <section className="card card-sm" aria-labelledby="rating-title">
        <h2 id="rating-title" style={{ fontSize: '1rem', marginBottom: '0.6rem' }}>
          Citizen feedback
        </h2>
        <p className="stars-static" aria-label={`Rated ${issue.rating.score} out of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={18}
              fill={n <= issue.rating!.score ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          ))}
        </p>
        {issue.rating.comment && (
          <p className="small muted" style={{ marginTop: '0.5rem' }}>
            “{issue.rating.comment}”
          </p>
        )}
      </section>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (score === 0) return;
    setBusy(true);
    setError(null);
    try {
      onUpdate((await api.rate(issue.code, score, comment.trim() || undefined)).issue);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || score;
  return (
    <form className="card card-sm stack-sm" onSubmit={submit} aria-labelledby="rate-title">
      <h2 id="rate-title" style={{ fontSize: '1rem' }}>
        How was the resolution?
      </h2>
      <div className="stars" role="radiogroup" aria-label="Rating out of 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === score}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={n <= shown ? 'on' : undefined}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setScore(n)}
          >
            <Star size={26} fill={n <= shown ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="rating-comment">
          Comment <span className="label-opt">(optional)</span>
        </label>
        <input
          id="rating-comment"
          className="input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
        />
      </div>
      {error !== null && <ErrorAlert error={error} />}
      <button type="submit" className="btn btn-primary" disabled={score === 0 || busy}>
        {busy ? <Spinner label="Sending…" /> : 'Submit feedback'}
      </button>
    </form>
  );
}
