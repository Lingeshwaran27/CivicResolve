import {
  Building2,
  Clock,
  Gauge,
  Languages,
  Lightbulb,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useId } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import { LANGUAGE_LABEL, departmentName } from '../lib/format';
import type { AiAnalysis } from '../lib/types';
import { PriorityBadge, ProviderBadge } from './Badges';
import { CategoryIcon } from './CategoryIcon';

interface Props {
  analysis: AiAnalysis;
  heading?: string;
  headingLevel?: 'h2' | 'h3';
}

/** Explainable AI result: what Gemini decided, how sure it is, and why. */
export function AiInsightCard({ analysis, heading = 'AI triage', headingLevel = 'h2' }: Props) {
  const { departments } = useCatalog();
  const Heading = headingLevel;
  const scoreId = useId();
  const days = analysis.estimatedResolutionDays;

  return (
    <section className="card ai-card fade-in" aria-label={heading}>
      <div className="card-head">
        <Heading>
          <span className="icon-tile sm" aria-hidden="true">
            <Sparkles size={16} />
          </span>
          {heading}
        </Heading>
        <ProviderBadge provider={analysis.provider} />
      </div>

      <div className="row" style={{ gap: '0.85rem', marginBottom: '1.4rem' }}>
        <CategoryIcon category={analysis.category} />
        <div>
          <div className="xs muted">Category</div>
          <div style={{ fontWeight: 700 }}>{analysis.category}</div>
        </div>
      </div>

      <div className="ai-score">
        <div>
          <div className="xs muted" id={scoreId}>
            Public impact score
          </div>
          <div className="big">
            {analysis.impactScore}
            <small>/100</small>
          </div>
        </div>
        <PriorityBadge priority={analysis.priority} />
      </div>
      <div
        className={`meter meter-${analysis.priority}`}
        role="meter"
        aria-labelledby={scoreId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={analysis.impactScore}
      >
        <span style={{ width: `${analysis.impactScore}%` }} />
      </div>

      <ul className="facts">
        <li>
          <Building2 size={16} aria-hidden="true" />
          <span className="k">Department</span>
          <span className="v">{departmentName(analysis.department, departments)}</span>
        </li>
        <li>
          <Clock size={16} aria-hidden="true" />
          <span className="k">Est. resolution</span>
          <span className="v">
            {days} {days === 1 ? 'day' : 'days'}
          </span>
        </li>
        <li>
          <Gauge size={16} aria-hidden="true" />
          <span className="k">AI confidence</span>
          <span className="v">{Math.round(analysis.confidence * 100)}%</span>
        </li>
      </ul>

      <div className="stack-sm" style={{ marginTop: '1.25rem' }}>
        <div className="callout">
          <Lightbulb size={17} aria-hidden="true" />
          <p>
            <strong>Why: </strong>
            {analysis.reasoning}
          </p>
        </div>

        {analysis.hazards.length > 0 && (
          <div>
            <p className="xs muted" style={{ marginBottom: '0.45rem', marginTop: '0.35rem' }}>
              Hazards identified
            </p>
            <ul className="hazards">
              {analysis.hazards.map((h) => (
                <li key={h}>
                  <TriangleAlert size={12} aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.translatedDescription && (
          <div className="callout">
            <Languages size={17} aria-hidden="true" />
            <p>
              <strong>
                Translated from {LANGUAGE_LABEL[analysis.language] ?? analysis.language}:{' '}
              </strong>
              <span lang="en">{analysis.translatedDescription}</span>
            </p>
          </div>
        )}

        {analysis.provider === 'heuristic' && (
          <p className="xs muted">
            AI is busy right now, so a rule-based classifier was used. An official will verify the
            details.
          </p>
        )}
      </div>
    </section>
  );
}
