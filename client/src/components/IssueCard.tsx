import { MapPin, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { Issue } from '../lib/types';
import { PriorityBadge, StatusBadge } from './Badges';
import { CategoryIcon } from './CategoryIcon';

/** Whole card is clickable via a stretched link on the title (one tab stop, accessible name = title). */
export function IssueCard({
  issue,
  headingLevel = 'h3',
}: {
  issue: Issue;
  headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  return (
    <article className={`issue-card priority-${issue.priority}`}>
      {issue.hasImage && (
        <img
          className="issue-thumb"
          src={api.imageUrl(issue.code)}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="issue-top">
        <CategoryIcon category={issue.category} size="sm" />
        <div className="meta">
          <strong>{issue.category}</strong>
          <span className="code">{issue.code}</span> ·{' '}
          <time dateTime={issue.createdAt}>{timeAgo(issue.createdAt)}</time>
        </div>
      </div>
      <Heading>
        <Link to={`/track/${issue.code}`}>{issue.title}</Link>
      </Heading>
      <p className="issue-place">
        <MapPin size={14} aria-hidden="true" />
        <span>{issue.location.address}</span>
      </p>
      <div className="issue-foot">
        <PriorityBadge priority={issue.priority} />
        <StatusBadge status={issue.status} />
        {issue.overdue && <span className="badge badge-overdue">Past SLA</span>}
        <span className="votes">
          <ThumbsUp size={14} aria-hidden="true" />
          {issue.upvotes}
          <span className="sr-only"> supporters</span>
        </span>
      </div>
    </article>
  );
}
