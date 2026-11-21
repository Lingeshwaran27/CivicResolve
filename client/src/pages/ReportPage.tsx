import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Gauge,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Send,
  Sparkles,
  Tags,
  ThumbsUp,
} from 'lucide-react';
import { lazy, Suspense, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AiInsightCard } from '../components/AiInsightCard';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { ErrorAlert, SkeletonLines, Spinner } from '../components/Feedback';
import { usePageTitle } from '../components/Layout';
import { PhotoInput } from '../components/PhotoInput';
import { VoiceInput } from '../components/VoiceInput';
import { useCatalog } from '../hooks/useCatalog';
import { ApiError, api } from '../lib/api';
import { departmentName } from '../lib/format';
import { getCurrentPosition, reverseGeocode, type Coordinates } from '../lib/media';
import type { AnalyzeResponse, Issue } from '../lib/types';

const IssueMap = lazy(() => import('../components/IssueMap'));

type FieldErrors = Partial<Record<'title' | 'description' | 'address', string>>;

export function validateReport(v: {
  title: string;
  description: string;
  address: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (v.description.trim().length < 10)
    errors.description = 'Please describe the problem in at least 10 characters.';
  if (v.description.trim().length > 2000)
    errors.description = 'Please keep the description under 2000 characters.';
  if (v.title.trim() && v.title.trim().length < 5)
    errors.title = 'Title should be at least 5 characters (or leave it blank for AI).';
  if (v.address.trim().length < 3) errors.address = 'Tell us where the problem is.';
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      <CircleAlert size={14} aria-hidden="true" />
      {message}
    </p>
  );
}

export default function ReportPage() {
  usePageTitle('Report an issue');
  const { categories, departments } = useCatalog();
  const [params] = useSearchParams();
  const formId = useId();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(() => params.get('category') ?? '');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzedFor, setAnalyzedFor] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [created, setCreated] = useState<Issue | null>(null);
  const [supported, setSupported] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const fingerprint = `${description.trim()}|${image ?? ''}`;
  const stale = analysis !== null && analyzedFor !== fingerprint;
  const ai = analysis?.analysis;
  const steps = [
    { label: 'Describe', done: description.trim().length >= 10 },
    { label: 'Locate', done: address.trim().length >= 3 },
    { label: 'AI review', done: Boolean(ai) && !stale },
  ];

  function check(requireAddress: boolean): boolean {
    const e = validateReport({ title, description, address: requireAddress ? address : 'skip' });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const first = Object.keys(e)[0];
      document.getElementById(`${formId}-${first}`)?.focus();
      return false;
    }
    return true;
  }

  async function runAnalysis() {
    if (!check(false)) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await api.analyze({
        title: title.trim() || undefined,
        description: description.trim(),
        location: { address: address.trim() || undefined, lat: coords?.lat, lng: coords?.lng },
        image: image ?? undefined,
      });
      setAnalysis(res);
      setAnalyzedFor(fingerprint);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setAnalyzeError(err);
    } finally {
      setAnalyzing(false);
    }
  }

  async function useMyLocation() {
    setLocating(true);
    setLocationMsg(null);
    try {
      const pos = await getCurrentPosition();
      setCoords(pos);
      const label = await reverseGeocode(pos);
      if (label) setAddress(label);
      setLocationMsg(
        label ? 'Location found.' : 'Location pinned. Please add a landmark or street name.',
      );
    } catch (err) {
      setLocationMsg(err instanceof Error ? err.message : 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!check(true)) return;
    const finalTitle = title.trim() || ai?.suggestedTitle || description.trim().slice(0, 80);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { issue } = await api.createIssue({
        title: finalTitle.length >= 5 ? finalTitle : `${finalTitle} issue`,
        description: description.trim(),
        category: category || undefined,
        location: { address: address.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null },
        image: image ?? undefined,
        reporterName: name.trim() || undefined,
        reporterContact: contact.trim() || undefined,
      });
      setCreated(issue);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError(err);
      if (err instanceof ApiError && err.details.length) {
        const fe: FieldErrors = {};
        for (const d of err.details) {
          if (d.path === 'title' || d.path === 'description') fe[d.path] = d.message;
          if (d.path.startsWith('location')) fe.address = d.message;
        }
        setErrors(fe);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function supportExisting(code: string) {
    try {
      await api.upvote(code);
      setSupported(code);
    } catch (err) {
      setSupported(null);
      setAnalyzeError(err);
    }
  }

  if (created) return <SubmittedView issue={created} departments={departments} />;

  return (
    <div className="container">
      <header className="page-head">
        <div>
          <p className="eyebrow">New complaint</p>
          <h1>Report a civic issue</h1>
          <p className="lead">
            Describe the problem in your own words. Gemini classifies it, judges its urgency and
            routes it to the right department — you can review the result before submitting.
          </p>
        </div>
      </header>

      <div className="split">
        <div>
          <ol className="progress-steps" aria-label="Form progress">
            {steps.map((s) => (
              <li key={s.label} className={s.done ? 'done' : undefined}>
                <span>
                  {s.label}
                  {s.done && <span className="sr-only"> (complete)</span>}
                </span>
              </li>
            ))}
          </ol>

          <form className="card card-flush" onSubmit={onSubmit} noValidate>
            <fieldset className="form-section">
              <legend className="section-title">
                <span className="num" aria-hidden="true">
                  1
                </span>
                <span>
                  <strong>What’s the problem?</strong>
                  <span>Be specific — what, how big, and who is affected.</span>
                </span>
              </legend>

              <div className="field">
                <label htmlFor={`${formId}-description`}>Description</label>
                <textarea
                  id={`${formId}-description`}
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Deep pothole in front of the bus stop. Two-wheelers are skidding, worse at night."
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? `${formId}-description-err` : undefined}
                  maxLength={2000}
                  required
                />
                <div className="textarea-tools">
                  <VoiceInput onText={(t) => setDescription((d) => (d ? `${d} ${t}` : t))} />
                  <span className="xs muted" aria-hidden="true">
                    {description.length}/2000
                  </span>
                </div>
                <FieldError id={`${formId}-description-err`} message={errors.description} />
              </div>

              <div className="form-grid" style={{ marginTop: '1.25rem' }}>
                <div className="field">
                  <label htmlFor={`${formId}-title`}>
                    Short title <span className="label-opt">(optional)</span>
                  </label>
                  <input
                    id={`${formId}-title`}
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    placeholder="AI will suggest one"
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? `${formId}-title-err` : undefined}
                  />
                  <FieldError id={`${formId}-title-err`} message={errors.title} />
                </div>
                <div className="field">
                  <label htmlFor={`${formId}-category`}>Category</label>
                  <select
                    id={`${formId}-category`}
                    className="select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Let AI decide{ai ? ` (suggests ${ai.category})` : ''}</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <PhotoInput value={image} onChange={setImage} />
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend className="section-title">
                <span className="num" aria-hidden="true">
                  2
                </span>
                <span>
                  <strong>Where is it?</strong>
                  <span>A street name or nearby landmark helps crews find it fast.</span>
                </span>
              </legend>
              <div className="field">
                <label htmlFor={`${formId}-address`}>Address or landmark</label>
                <div className="input-icon">
                  <MapPin size={17} aria-hidden="true" />
                  <input
                    id={`${formId}-address`}
                    className="input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={200}
                    autoComplete="street-address"
                    placeholder="e.g. Avinashi Road, opp. PSG Tech bus stop"
                    aria-invalid={Boolean(errors.address)}
                    aria-describedby={errors.address ? `${formId}-address-err` : undefined}
                  />
                </div>
                <FieldError id={`${formId}-address-err`} message={errors.address} />
                <div className="row row-tight" style={{ marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={useMyLocation}
                    disabled={locating}
                  >
                    {locating ? (
                      <Spinner label="Locating…" size={14} />
                    ) : (
                      <>
                        <LocateFixed size={15} aria-hidden="true" /> Use my location
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-expanded={showMap}
                    onClick={() => setShowMap((s) => !s)}
                  >
                    <MapIcon size={15} aria-hidden="true" />
                    {showMap ? 'Hide map' : 'Pick on map'}
                  </button>
                  {coords && (
                    <span className="xs muted mono">
                      {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </span>
                  )}
                </div>
                <p className="xs muted" aria-live="polite">
                  {locationMsg}
                </p>
                {showMap && (
                  <Suspense fallback={<SkeletonLines lines={2} />}>
                    <IssueMap
                      className="map map-sm fade-in"
                      label="Map: click to set the issue location"
                      value={coords}
                      onPick={(p) => {
                        setCoords(p);
                        setLocationMsg('Location pinned on map.');
                        void reverseGeocode(p).then(
                          (label) => label && !address && setAddress(label),
                        );
                      }}
                    />
                  </Suspense>
                )}
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend className="section-title">
                <span className="num" aria-hidden="true">
                  3
                </span>
                <span>
                  <strong>
                    Your details <span className="label-opt">(optional)</span>
                  </strong>
                  <span>Only visible to officials — never shown publicly.</span>
                </span>
              </legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`${formId}-name`}>Name</label>
                  <input
                    id={`${formId}-name`}
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${formId}-contact`}>Phone or email</label>
                  <input
                    id={`${formId}-contact`}
                    className="input"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={120}
                    autoComplete="email"
                  />
                </div>
              </div>
            </fieldset>

            {submitError !== null && (
              <div style={{ padding: '0 1.75rem 1.25rem' }}>
                <ErrorAlert error={submitError} />
              </div>
            )}

            <div className="form-actions">
              <p className="xs muted" style={{ maxWidth: '34ch' }}>
                Skipped the preview? AI triage still runs automatically when you submit.
              </p>
              <div className="row row-tight">
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={runAnalysis}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <Spinner label="Analysing…" />
                  ) : (
                    <>
                      <Sparkles size={16} aria-hidden="true" />
                      {ai && !stale ? 'Re-analyse' : 'Analyse with AI'}
                    </>
                  )}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <Spinner label="Submitting…" />
                  ) : (
                    <>
                      Submit complaint <Send size={15} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        <aside className="sticky" aria-label="AI analysis">
          <div
            ref={resultRef}
            tabIndex={-1}
            aria-live="polite"
            style={{ outline: 'none' }}
            className="stack"
          >
            {analyzing && (
              <div className="card ai-card">
                <p style={{ marginBottom: '1.25rem', fontWeight: 600 }}>
                  <Spinner label="Reading your description and photo…" />
                </p>
                <SkeletonLines lines={6} />
              </div>
            )}
            {analyzeError !== null && !analyzing && (
              <ErrorAlert error={analyzeError} onRetry={runAnalysis} />
            )}
            {!analysis && !analyzing && analyzeError === null && (
              <div className="card empty-ai">
                <span className="icon-tile lg" aria-hidden="true">
                  <Sparkles size={24} />
                </span>
                <h2>AI triage preview</h2>
                <p className="muted small" style={{ marginTop: '0.4rem' }}>
                  Press <strong>Analyse with AI</strong> to see how your complaint will be handled.
                </p>
                <ul>
                  <li>
                    <Tags size={16} aria-hidden="true" /> Category &amp; hazards
                  </li>
                  <li>
                    <Gauge size={16} aria-hidden="true" /> Priority &amp; public impact
                  </li>
                  <li>
                    <Building2 size={16} aria-hidden="true" /> Responsible department
                  </li>
                </ul>
              </div>
            )}
            {ai && !analyzing && (
              <>
                {stale && (
                  <p className="alert alert-info">
                    You changed the details — re-analyse to refresh the result.
                  </p>
                )}
                <AiInsightCard analysis={ai} />
                {!title.trim() && (
                  <div className="card card-sm row between fade-in">
                    <span style={{ flex: '1 1 180px' }}>
                      <span className="xs muted">Suggested title</span>
                      <br />
                      <strong>{ai.suggestedTitle}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setTitle(ai.suggestedTitle)}
                    >
                      Use this title
                    </button>
                  </div>
                )}
                {analysis.duplicates.length > 0 && (
                  <section className="card card-sm fade-in" aria-labelledby="dup-title">
                    <h2 id="dup-title" style={{ fontSize: '1rem' }}>
                      Already reported nearby?
                    </h2>
                    <p className="xs muted" style={{ margin: '0.3rem 0 1rem' }}>
                      Supporting an existing complaint raises its priority — often faster than a new
                      report.
                    </p>
                    {supported && (
                      <p
                        className="alert alert-success"
                        role="status"
                        style={{ marginBottom: '0.75rem' }}
                      >
                        <CircleCheck size={16} aria-hidden="true" />
                        <span>
                          Thanks! Support added to{' '}
                          <Link to={`/track/${supported}`}>{supported}</Link>.
                        </span>
                      </p>
                    )}
                    <ul className="issue-list">
                      {analysis.duplicates.map((d) => (
                        <li
                          key={d.issue.id}
                          style={{
                            padding: '0.9rem',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--r-sm)',
                          }}
                        >
                          <div className="row row-tight">
                            <StatusBadge status={d.issue.status} />
                            <PriorityBadge priority={d.issue.priority} />
                            <span className="xs muted">
                              {d.distanceMeters !== null ? `${d.distanceMeters} m away · ` : ''}
                              {Math.round(d.score * 100)}% match
                            </span>
                          </div>
                          <p
                            style={{
                              margin: '0.5rem 0 0.7rem',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                            }}
                          >
                            <Link to={`/track/${d.issue.code}`}>{d.issue.title}</Link>
                          </p>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => supportExisting(d.issue.code)}
                            disabled={supported === d.issue.code}
                          >
                            <ThumbsUp size={14} aria-hidden="true" /> Support this (
                            {d.issue.upvotes})
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SubmittedView({
  issue,
  departments,
}: {
  issue: Issue;
  departments: { id: string; name: string }[];
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="card fade-in" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <span
          className="icon-tile lg green"
          style={{ margin: '0 auto 1.25rem' }}
          aria-hidden="true"
        >
          <CircleCheck size={26} />
        </span>
        <h1>Complaint submitted</h1>
        <p className="muted" style={{ margin: '0.6rem 0 1.5rem' }}>
          Save your tracking code to follow progress.
        </p>
        <div className="ticket">
          <span
            className="ticket-code"
            aria-label={`Tracking code ${issue.code.split('').join(' ')}`}
          >
            {issue.code}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(issue.code).then(() => setCopied(true));
            }}
          >
            {copied ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p role="status" style={{ marginTop: '1.5rem' }} className="text-2">
          Routed to <strong>{departmentName(issue.department, departments)}</strong> with{' '}
          <PriorityBadge priority={issue.priority} /> priority.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '2rem' }}>
          <Link className="btn btn-primary" to={`/track/${issue.code}`}>
            Track this complaint <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <a className="btn btn-outline" href="/report">
            Report another issue
          </a>
        </div>
      </div>
      {issue.ai && (
        <div style={{ marginTop: '1.5rem' }}>
          <AiInsightCard analysis={issue.ai} heading="How AI triaged your complaint" />
        </div>
      )}
    </div>
  );
}
