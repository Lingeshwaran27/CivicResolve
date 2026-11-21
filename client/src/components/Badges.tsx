import { Sparkles } from 'lucide-react';
import { PRIORITY_LABEL, PROVIDER_LABEL, STATUS_LABEL } from '../lib/format';
import type { AiProviderName, Priority, Status } from '../lib/types';

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge badge-dot p-${priority}`}>
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge s-${status}`}>
      <span className="sr-only">Status: </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProviderBadge({ provider }: { provider: AiProviderName }) {
  const ai = provider === 'gemini' || provider === 'openrouter';
  return (
    <span
      className={`badge ${ai ? 'badge-ai' : 'badge-neutral'}`}
      title={`Analysed by ${PROVIDER_LABEL[provider]}`}
    >
      {ai && <Sparkles size={12} aria-hidden="true" />}
      {PROVIDER_LABEL[provider]}
    </span>
  );
}
