import {
  CATEGORIES,
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENTS,
  PRIORITIES,
  STATUSES,
  canTransition,
  type Category,
  type DepartmentId,
  type Priority,
  type Status,
} from '../domain/catalog.js';
import type { AiAnalysis, ImageKind, Issue } from '../domain/types.js';
import { HttpError } from '../http/errors.js';
import type { ListQuery } from '../http/schemas.js';
import { newIssueId, newTrackingCode, sha256 } from '../lib/ids.js';
import type { IssueRepository } from '../repositories/issueRepository.js';
import type { AiService, AnalyzeInput } from './ai/aiService.js';
import { findDuplicates, type DuplicateMatch } from './duplicates.js';
import { effectiveScore, slaDueAt } from './priority.js';

export interface CreateIssueInput {
  title: string;
  description: string;
  category?: Category;
  location: { address: string; lat?: number | null; lng?: number | null };
  imageDataUrl?: string;
  analyzeInput: AnalyzeInput;
  reporterName?: string;
  reporterContact?: string;
}

export interface AdminUpdate {
  status?: Status;
  priority?: Priority;
  department?: DepartmentId;
  category?: Category;
  note?: string;
}

const DAY_MS = 86_400_000;

export class IssueService {
  constructor(
    private readonly repo: IssueRepository,
    private readonly ai: AiService,
    private readonly voteSalt: string,
  ) {}

  async analyze(input: AnalyzeInput, location?: { lat?: number | null; lng?: number | null }) {
    const analysis = await this.ai.analyze(input);
    const duplicates = await this.duplicatesFor({
      text: `${input.title ?? ''} ${analysis.translatedDescription ?? input.description}`,
      category: analysis.category,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    });
    return { analysis, duplicates };
  }

  async duplicatesFor(input: Parameters<typeof findDuplicates>[0]): Promise<DuplicateMatch[]> {
    return findDuplicates(input, await this.repo.listAll());
  }

  async create(input: CreateIssueInput): Promise<Issue> {
    // Reuse the analysis the citizen already saw (cache hit = no extra AI call).
    const ai: AiAnalysis =
      this.ai.peek(input.analyzeInput) ?? (await this.ai.analyze(input.analyzeInput));
    const category = input.category ?? ai.category;
    const categoryOverridden = category !== ai.category;
    // If the citizen changed the category, route by their category; otherwise trust the AI routing.
    const department = categoryOverridden ? CATEGORY_TO_DEPARTMENT[category] : ai.department;
    const now = new Date().toISOString();

    const issue: Issue = {
      id: newIssueId(),
      code: await this.uniqueCode(),
      title: input.title,
      description: input.description,
      category,
      department,
      priority: ai.priority,
      status: 'reported',
      location: {
        address: input.location.address,
        lat: input.location.lat ?? null,
        lng: input.location.lng ?? null,
      },
      ai,
      overrides: { category: categoryOverridden, priority: false, department: categoryOverridden },
      hasImage: Boolean(input.imageDataUrl),
      upvotes: 0,
      voterHashes: [],
      history: [
        {
          status: 'reported',
          note: `Complaint received. AI triage (${ai.provider}) routed it to ${DEPARTMENTS[department].name} as ${ai.priority} priority.`,
          at: now,
          by: 'system',
        },
      ],
      reporter:
        input.reporterName || input.reporterContact
          ? { name: input.reporterName ?? '', contact: input.reporterContact ?? '' }
          : null,
      rating: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    return this.repo.create(issue, input.imageDataUrl);
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = newTrackingCode();
      if (!(await this.repo.getByCode(code))) return code;
    }
    throw new HttpError(503, 'Could not allocate a tracking code, please retry');
  }

  async list(query: ListQuery): Promise<{ items: Issue[]; total: number }> {
    const all = await this.repo.listAll();
    const q = query.q?.toLowerCase();
    const filtered = all.filter(
      (i) =>
        (!query.status || i.status === query.status) &&
        (!query.category || i.category === query.category) &&
        (!query.priority || i.priority === query.priority) &&
        (!query.department || i.department === query.department) &&
        (!q ||
          i.code.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.location.address.toLowerCase().includes(q)),
    );
    const now = Date.now();
    if (query.sort === 'priority') {
      filtered.sort((a, b) => effectiveScore(b, now) - effectiveScore(a, now));
    } else if (query.sort === 'upvotes') {
      filtered.sort((a, b) => b.upvotes - a.upvotes);
    }
    return {
      items: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
    };
  }

  async getByCode(code: string): Promise<Issue> {
    const issue = await this.repo.getByCode(code);
    if (!issue) throw new HttpError(404, 'No complaint found with that tracking code');
    return issue;
  }

  async getImage(code: string, kind: ImageKind = 'report'): Promise<string> {
    const issue = await this.getByCode(code);
    const has = kind === 'resolution' ? issue.resolution?.photo : issue.hasImage;
    const image = has ? await this.repo.getImage(issue.id, kind) : null;
    if (!image) throw new HttpError(404, 'No photo for this complaint');
    return image;
  }

  /** One upvote per client (salted IP hash) per issue. */
  async upvote(code: string, clientId: string): Promise<Issue> {
    const issue = await this.getByCode(code);
    const voter = sha256(`${this.voteSalt}:${clientId}`).slice(0, 24);
    let alreadyVoted = false;
    const updated = await this.repo.update(issue.id, (current) => {
      if (current.status === 'resolved' || current.status === 'rejected') return null;
      if (current.voterHashes.includes(voter)) {
        alreadyVoted = true;
        return null;
      }
      return {
        ...current,
        upvotes: current.upvotes + 1,
        voterHashes: [...current.voterHashes, voter].slice(-5000),
        updatedAt: new Date().toISOString(),
      };
    });
    if (alreadyVoted) throw new HttpError(409, 'You have already supported this complaint');
    if (!updated)
      throw new HttpError(409, 'This complaint is closed and can no longer be supported');
    return updated;
  }

  async rate(code: string, score: number, comment?: string): Promise<Issue> {
    const issue = await this.getByCode(code);
    const updated = await this.repo.update(issue.id, (current) => {
      if (current.status !== 'resolved' || current.rating) return null;
      return {
        ...current,
        rating: { score, comment: comment ?? '', at: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      };
    });
    if (!updated) throw new HttpError(409, 'Only resolved complaints can be rated, and only once');
    return updated;
  }

  async adminUpdate(id: string, change: AdminUpdate): Promise<Issue> {
    let transitionError: string | null = null;
    const updated = await this.repo.update(id, (current) => {
      const now = new Date().toISOString();
      const next: Issue = {
        ...current,
        overrides: { ...current.overrides },
        history: [...current.history],
      };
      const notes: string[] = [];

      if (change.status && change.status !== current.status) {
        if (!canTransition(current.status, change.status)) {
          transitionError = `Cannot move a complaint from "${current.status}" to "${change.status}"`;
          return null;
        }
        next.status = change.status;
        next.resolvedAt = change.status === 'resolved' ? now : null;
      }
      if (change.priority && change.priority !== current.priority) {
        next.priority = change.priority;
        next.overrides.priority = change.priority !== current.ai?.priority;
        notes.push(`Priority set to ${change.priority}.`);
      }
      if (change.category && change.category !== current.category) {
        next.category = change.category;
        next.overrides.category = change.category !== current.ai?.category;
        notes.push(`Category changed to ${change.category}.`);
      }
      if (change.department && change.department !== current.department) {
        next.department = change.department;
        next.overrides.department = change.department !== current.ai?.department;
        notes.push(`Reassigned to ${DEPARTMENTS[change.department].name}.`);
      }
      if (change.note) notes.unshift(change.note);

      if (notes.length === 0 && next.status === current.status) return null;
      next.history.push({
        status: next.status,
        note: notes.join(' ') || 'Status updated.',
        at: now,
        by: 'admin',
      });
      next.updatedAt = now;
      return next;
    });
    if (transitionError) throw new HttpError(409, transitionError);
    if (!updated) {
      const exists = await this.repo.getById(id);
      if (!exists) throw new HttpError(404, 'Complaint not found');
      throw new HttpError(400, 'Nothing to update');
    }
    return updated;
  }

  async stats() {
    const all = await this.repo.listAll();
    const now = Date.now();
    const count = <K extends string>(keys: readonly K[], pick: (i: Issue) => K) => {
      const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
      for (const i of all) out[pick(i)] += 1;
      return out;
    };

    const resolved = all.filter((i) => i.status === 'resolved' && i.resolvedAt);
    const resolutionHours = resolved.map(
      (i) => (Date.parse(i.resolvedAt!) - Date.parse(i.createdAt)) / 3_600_000,
    );
    const ratings = all.filter((i) => i.rating).map((i) => i.rating!.score);
    const open = all.filter((i) => i.status === 'reported' || i.status === 'in_progress');

    const trend: { date: string; reported: number; resolved: number }[] = [];
    for (let d = 13; d >= 0; d -= 1) {
      const day = new Date(now - d * DAY_MS).toISOString().slice(0, 10);
      trend.push({
        date: day,
        reported: all.filter((i) => i.createdAt.slice(0, 10) === day).length,
        resolved: resolved.filter((i) => i.resolvedAt!.slice(0, 10) === day).length,
      });
    }

    return {
      total: all.length,
      open: open.length,
      overdue: open.filter((i) => slaDueAt(i).getTime() < now).length,
      byStatus: count(STATUSES, (i) => i.status),
      byPriority: count(PRIORITIES, (i) => i.priority),
      byCategory: count(CATEGORIES, (i) => i.category),
      byDepartment: Object.fromEntries(
        Object.keys(DEPARTMENTS).map((d) => [d, all.filter((i) => i.department === d).length]),
      ),
      avgResolutionHours: resolutionHours.length
        ? Math.round(resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length)
        : null,
      satisfaction: ratings.length
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : null,
      aiOverrideRate: all.length
        ? Number(
            (
              all.filter(
                (i) => i.overrides.category || i.overrides.priority || i.overrides.department,
              ).length / all.length
            ).toFixed(2),
          )
        : 0,
      trend,
    };
  }

  async allIssues(): Promise<Issue[]> {
    return this.repo.listAll();
  }
}
