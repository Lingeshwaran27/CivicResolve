import {
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENTS,
  PRIORITY_BANDS,
  isOpen,
  priorityFromScore,
} from '../../domain/catalog.js';
import type { AiAnalysis, AiProviderName, Issue } from '../../domain/types.js';
import { sha256 } from '../../lib/ids.js';
import { logger } from '../../lib/logger.js';
import { TtlCache } from '../../lib/ttlCache.js';
import { effectiveScore, slaDueAt } from '../priority.js';
import { RequestBudget, type BudgetSnapshot } from './budget.js';
import { heuristicAnalysis } from './heuristic.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  BRIEFING_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
} from './prompts.js';
import { ProviderUnavailableError, type ImageInput, type LlmProvider } from './provider.js';
import {
  BriefingSchema,
  GEMINI_ANALYSIS_SCHEMA,
  GEMINI_BRIEFING_SCHEMA,
  RawAnalysisSchema,
  extractJson,
  type Briefing,
  type RawAnalysis,
} from './schema.js';

export interface AnalyzeInput {
  title?: string;
  description: string;
  address?: string;
  image?: ImageInput;
}

export interface BriefingResult extends Briefing {
  generatedAt: string;
  provider: AiProviderName;
  model: string;
  openIssues: number;
}

interface ProviderSlot {
  provider: LlmProvider;
  budget: RequestBudget;
}

export interface AiStatus {
  activeProvider: AiProviderName;
  providers: { name: string; model: string; configured: true; budget: BudgetSnapshot }[];
  cacheEntries: number;
}

const ANALYSIS_CACHE_TTL_MS = 60 * 60 * 1000;
const BRIEFING_TTL_MS = 15 * 60 * 1000;
const BRIEFING_MIN_REFRESH_MS = 60 * 1000;

/**
 * Orchestrates AI calls with a strict cost/quota policy:
 *  1. Cache by content hash — identical requests never hit the API twice (analyze → submit reuses it).
 *  2. Coalesce concurrent identical requests into one in-flight call.
 *  3. Try providers in order (Gemini → OpenRouter) only while their self-imposed budget allows.
 *  4. On 429/5xx put the provider on cooldown and fall through — never retry in a loop.
 *  5. Validate model output with zod; fall back to the deterministic classifier if all else fails.
 */
export class AiService {
  private readonly slots: ProviderSlot[];
  private readonly analysisCache = new TtlCache<AiAnalysis>(500, ANALYSIS_CACHE_TTL_MS);
  private readonly inflight = new Map<string, Promise<AiAnalysis>>();
  private briefingCache: { value: BriefingResult; at: number } | null = null;

  constructor(
    slots: { provider: LlmProvider; rpm: number; rpd: number }[],
    private readonly clock: () => number = Date.now,
  ) {
    this.slots = slots.map((s) => ({
      provider: s.provider,
      budget: new RequestBudget(s.rpm, s.rpd, clock),
    }));
  }

  /**
   * Cache key = description + photo only. The title and address are context, and citizens often
   * accept the AI-suggested title before submitting — that must not trigger a second LLM call.
   */
  static cacheKey(input: AnalyzeInput): string {
    return sha256(
      JSON.stringify([
        input.description.trim().toLowerCase(),
        input.image ? sha256(input.image.base64) : '',
      ]),
    );
  }

  /** Returns a cached analysis without spending quota (used when the citizen submits). */
  peek(input: AnalyzeInput): AiAnalysis | undefined {
    return this.analysisCache.get(AiService.cacheKey(input));
  }

  async analyze(input: AnalyzeInput): Promise<AiAnalysis> {
    const key = AiService.cacheKey(input);
    const cached = this.analysisCache.get(key);
    if (cached) return cached;
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = this.runAnalysis(input)
      .then((result) => {
        this.analysisCache.set(key, result);
        return result;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private async runAnalysis(input: AnalyzeInput): Promise<AiAnalysis> {
    const user = buildAnalysisUserPrompt({ ...input, hasImage: Boolean(input.image) });
    for (const slot of this.slots) {
      const raw = await this.tryProvider(slot, (p) =>
        p.generateJson({
          system: ANALYSIS_SYSTEM_PROMPT,
          user,
          image: input.image,
          jsonSchema: GEMINI_ANALYSIS_SCHEMA,
        }),
      );
      if (raw === null) continue;
      const parsed = RawAnalysisSchema.safeParse(safeExtract(raw));
      if (parsed.success) {
        return normalizeAnalysis(parsed.data, slot.provider.name, slot.provider.model);
      }
      logger.warn('AI output failed validation; trying next provider', {
        provider: slot.provider.name,
        issues: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    return heuristicAnalysis(input);
  }

  private async tryProvider(
    slot: ProviderSlot,
    call: (p: LlmProvider) => Promise<string>,
  ): Promise<string | null> {
    if (!slot.budget.tryAcquire()) {
      logger.info('AI budget guard skipped provider', { provider: slot.provider.name });
      return null;
    }
    try {
      return await call(slot.provider);
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        if (err.dailyQuotaExhausted) slot.budget.exhaustForToday();
        else slot.budget.cooldown(err.retryAfterMs ?? 60_000);
      }
      logger.warn('AI provider call failed', {
        provider: slot.provider.name,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /** AI daily briefing for administrators. Cached for 15 minutes to protect the quota. */
  async briefing(issues: readonly Issue[], forceRefresh = false): Promise<BriefingResult> {
    const now = this.clock();
    if (this.briefingCache) {
      const age = now - this.briefingCache.at;
      if (age < BRIEFING_TTL_MS && (!forceRefresh || age < BRIEFING_MIN_REFRESH_MS)) {
        return this.briefingCache.value;
      }
    }

    const open = issues
      .filter((i) => isOpen(i.status))
      .sort((a, b) => effectiveScore(b, now) - effectiveScore(a, now));
    const compact = open.slice(0, 40).map((i) => ({
      code: i.code,
      title: i.title.slice(0, 90),
      category: i.category,
      priority: i.priority,
      department: i.department,
      status: i.status,
      upvotes: i.upvotes,
      ageDays: Math.floor((now - Date.parse(i.createdAt)) / 86_400_000),
      overdue: slaDueAt(i).getTime() < now,
      area: i.location.address.slice(0, 80),
    }));

    let result: BriefingResult | null = null;
    if (compact.length > 0) {
      for (const slot of this.slots) {
        const raw = await this.tryProvider(slot, (p) =>
          p.generateJson({
            system: BRIEFING_SYSTEM_PROMPT,
            user: `Today is ${new Date(now).toDateString()}. Open issues (${open.length} total, top ${compact.length} by urgency):\n${JSON.stringify(compact)}`,
            jsonSchema: GEMINI_BRIEFING_SCHEMA,
          }),
        );
        if (raw === null) continue;
        const parsed = BriefingSchema.safeParse(safeExtract(raw));
        if (parsed.success) {
          result = {
            ...parsed.data,
            generatedAt: new Date(now).toISOString(),
            provider: slot.provider.name,
            model: slot.provider.model,
            openIssues: open.length,
          };
          break;
        }
      }
    }
    result ??= heuristicBriefing(open, now);
    this.briefingCache = { value: result, at: now };
    return result;
  }

  status(): AiStatus {
    const providers = this.slots.map((s) => ({
      name: s.provider.name,
      model: s.provider.model,
      configured: true as const,
      budget: s.budget.snapshot(),
    }));
    const usable = providers.find((p) => p.budget.remainingToday > 0 && !p.budget.cooldownUntil);
    return {
      activeProvider: (usable?.name as AiProviderName | undefined) ?? 'heuristic',
      providers,
      cacheEntries: this.analysisCache.size,
    };
  }
}

function safeExtract(raw: string): unknown {
  try {
    return extractJson(raw);
  } catch {
    return null;
  }
}

/** Make the model output internally consistent (priority ↔ score, valid department). */
export function normalizeAnalysis(
  raw: RawAnalysis,
  provider: AiProviderName,
  model: string,
): AiAnalysis {
  const [lo, hi] = PRIORITY_BANDS[raw.priority];
  let score = Math.round(raw.impactScore);
  let priority = raw.priority;
  if (score < lo || score > hi) {
    // Trust the explicit priority label; clamp the score into its band.
    score = Math.min(Math.max(score, lo), hi);
    priority = priorityFromScore(score);
  }
  const department = DEPARTMENTS[raw.department]
    ? raw.department
    : CATEGORY_TO_DEPARTMENT[raw.category];
  const language = raw.language.toLowerCase().slice(0, 5);
  return {
    category: raw.category,
    priority,
    impactScore: score,
    department,
    suggestedTitle: raw.suggestedTitle,
    summary: raw.summary,
    reasoning: raw.reasoning,
    hazards: raw.hazards.filter((h) => h.length > 0).slice(0, 4),
    language,
    translatedDescription: language === 'en' ? null : raw.translatedDescription?.trim() || null,
    estimatedResolutionDays: Math.round(raw.estimatedResolutionDays),
    confidence: Number(raw.confidence.toFixed(2)),
    provider,
    model,
  };
}

function heuristicBriefing(open: readonly Issue[], now: number): BriefingResult {
  const overdue = open.filter((i) => slaDueAt(i).getTime() < now);
  const critical = open.filter((i) => i.priority === 'critical');
  const byCategory = new Map<string, number>();
  for (const i of open) byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + 1);
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    headline:
      open.length === 0
        ? 'No open complaints — the city is all clear.'
        : `${open.length} open complaints, ${critical.length} critical, ${overdue.length} past SLA.`,
    summary:
      open.length === 0
        ? 'All reported issues have been resolved or closed.'
        : `Most reports concern ${top.map(([c, n]) => `${c} (${n})`).join(', ')}. Prioritise critical and overdue items first.`,
    hotspots: open.slice(0, 3).map((i) => ({
      area: i.location.address || 'Unspecified location',
      issue: `${i.code}: ${i.title}`,
      recommendation: `Dispatch ${DEPARTMENTS[i.department].name} (${i.priority} priority).`,
    })),
    actions: critical
      .slice(0, 5)
      .map((i) => `Respond today to ${i.code} — ${i.title} (${DEPARTMENTS[i.department].name}).`),
    riskAlerts: critical.slice(0, 3).map((i) => `${i.code}: ${i.ai?.hazards[0] ?? i.title}`),
    generatedAt: new Date(now).toISOString(),
    provider: 'heuristic',
    model: 'rules-v1',
    openIssues: open.length,
  };
}
