import { CircleCheck, CircleX, Inbox, Wrench } from 'lucide-react';
import { STATUS_LABEL, formatDateTime } from '../lib/format';
import type { Status, StatusEvent } from '../lib/types';

const STEPS: { status: Status; Icon: typeof Inbox }[] = [
  { status: 'reported', Icon: Inbox },
  { status: 'in_progress', Icon: Wrench },
  { status: 'resolved', Icon: CircleCheck },
];

/** Horizontal progress tracker: Reported → In Progress → Resolved, with the date each step was reached. */
export function StatusStepper({
  status,
  history = [],
}: {
  status: Status;
  history?: StatusEvent[];
}) {
  if (status === 'rejected') {
    return (
      <p className="alert alert-info" role="status">
        <CircleX size={18} aria-hidden="true" />
        This complaint was closed by the department. See the timeline for the reason.
      </p>
    );
  }
  const current = STEPS.findIndex((s) => s.status === status);
  const reachedAt = (s: Status) => history.filter((e) => e.status === s).at(-1)?.at;

  return (
    <ol className="tracker" aria-label="Resolution progress">
      {STEPS.map(({ status: step, Icon }, i) => {
        const state =
          i < current || status === 'resolved' ? 'done' : i === current ? 'current' : '';
        const when = state ? reachedAt(step) : undefined;
        return (
          <li key={step} className={state} aria-current={i === current ? 'step' : undefined}>
            <span className="bubble" aria-hidden="true">
              <Icon size={18} />
            </span>
            <span>{STATUS_LABEL[step]}</span>
            {state === 'done' && <span className="sr-only"> (completed)</span>}
            {when && <span className="when">{formatDateTime(when)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ events }: { events: StatusEvent[] }) {
  return (
    <ol className="timeline" aria-label="Status history">
      {[...events].reverse().map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <div className="t-head">
            <strong>{STATUS_LABEL[e.status]}</strong>
            <time className="xs muted" dateTime={e.at}>
              {formatDateTime(e.at)}
            </time>
          </div>
          {e.note && <p className="t-note">{e.note}</p>}
          <span className="t-by">
            {e.by === 'admin'
              ? 'Municipal official'
              : e.by === 'system'
                ? 'CivicResolve'
                : 'Citizen'}
          </span>
        </li>
      ))}
    </ol>
  );
}
