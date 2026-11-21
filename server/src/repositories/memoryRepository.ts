import type { ImageKind, Issue } from '../domain/types.js';
import type { IssueRepository } from './issueRepository.js';

export class MemoryIssueRepository implements IssueRepository {
  readonly kind = 'memory' as const;
  private readonly issues = new Map<string, Issue>();
  private readonly codes = new Map<string, string>();
  private readonly images = new Map<string, string>();

  /** @param seedImages map of `${kind}:${issueId}` → data URL */
  constructor(seed: readonly Issue[] = [], seedImages: ReadonlyMap<string, string> = new Map()) {
    for (const [k, v] of seedImages) this.images.set(k, v);
    for (const issue of seed) {
      this.issues.set(issue.id, structuredClone(issue));
      this.codes.set(issue.code, issue.id);
    }
  }

  async create(issue: Issue, imageDataUrl?: string): Promise<Issue> {
    this.issues.set(issue.id, structuredClone(issue));
    this.codes.set(issue.code, issue.id);
    if (imageDataUrl) this.images.set(`report:${issue.id}`, imageDataUrl);
    return structuredClone(issue);
  }

  async getById(id: string): Promise<Issue | null> {
    const issue = this.issues.get(id);
    return issue ? structuredClone(issue) : null;
  }

  async getByCode(code: string): Promise<Issue | null> {
    const id = this.codes.get(code);
    return id ? this.getById(id) : null;
  }

  async listAll(): Promise<Issue[]> {
    return [...this.issues.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => structuredClone(i));
  }

  async update(id: string, mutate: (current: Issue) => Issue | null): Promise<Issue | null> {
    const current = this.issues.get(id);
    if (!current) return null;
    const next = mutate(structuredClone(current));
    if (!next) return null;
    this.issues.set(id, structuredClone(next));
    return structuredClone(next);
  }

  async getImage(id: string, kind: ImageKind = 'report'): Promise<string | null> {
    return this.images.get(`${kind}:${id}`) ?? null;
  }
}
