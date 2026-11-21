import { CircleAlert, LoaderCircle } from 'lucide-react';
import { ApiError } from '../lib/api';

export function Spinner({ label, size = 16 }: { label?: string; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <LoaderCircle size={size} className="spin" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="alert alert-error" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="container empty" role="status" aria-live="polite">
      <Spinner label="Loading…" size={20} />
    </div>
  );
}
