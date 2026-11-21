import { DEPARTMENTS, PRIORITY_BANDS, isOpen } from '../domain/catalog.js';
import type { AdminIssue, Issue, PublicIssue } from '../domain/types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Effective score used to rank the admin work queue:
 *   AI impact score (or the priority band midpoint)
 *   + community signal (upvotes, capped)
 *   + ageing bonus for open issues so nothing starves in the queue.
 */
export function effectiveScore(issue: Issue, now = Date.now()): number {
  const [lo, hi] = PRIORITY_BANDS[issue.priority];
  const base =
    issue.ai && issue.ai.priority === issue.priority
      ? issue.ai.impactScore
      : Math.round((lo + hi) / 2);
  const community = Math.min(issue.upvotes * 3, 20);
  const ageDays = (now - Date.parse(issue.createdAt)) / DAY_MS;
  const ageing = isOpen(issue.status) ? Math.min(Math.floor(ageDays), 10) : 0;
  return Math.min(base + community + ageing, 130);
}

export function slaDueAt(issue: Issue): Date {
  const days = DEPARTMENTS[issue.department].slaDays[issue.priority];
  return new Date(Date.parse(issue.createdAt) + days * DAY_MS);
}

export function toPublicIssue(issue: Issue, now = Date.now()): PublicIssue {
  // Strip private fields explicitly (reporter PII, voter hashes).
  const { reporter: _reporter, voterHashes: _voters, ...rest } = issue;
  const due = slaDueAt(issue);
  return {
    ...rest,
    effectiveScore: effectiveScore(issue, now),
    slaDueAt: due.toISOString(),
    overdue: isOpen(issue.status) && due.getTime() < now,
  };
}

export function toAdminIssue(issue: Issue, now = Date.now()): AdminIssue {
  return { ...toPublicIssue(issue, now), reporter: issue.reporter };
}
