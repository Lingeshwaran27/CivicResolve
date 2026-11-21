import type { AiProviderName, Priority, Status } from './types';

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const STATUS_LABEL: Record<Status, string> = {
  reported: 'Reported',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Closed',
};

export const PROVIDER_LABEL: Record<AiProviderName, string> = {
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter (fallback)',
  heuristic: 'Rule-based (offline)',
  seed: 'Demo data',
};

export const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
};

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 48) return `${hours} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function departmentName(id: string, departments: { id: string; name: string }[]): string {
  return departments.find((d) => d.id === id)?.name ?? id;
}
