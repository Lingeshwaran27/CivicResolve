import type { ImageKind, Issue } from '../domain/types.js';

/**
 * Persistence port. Two adapters implement it:
 *  - MemoryIssueRepository (local dev, tests, zero-config demo)
 *  - FirestoreIssueRepository (production, Firebase free "Spark" plan)
 */
export interface IssueRepository {
  readonly kind: 'memory' | 'firestore';
  create(issue: Issue, imageDataUrl?: string): Promise<Issue>;
  getById(id: string): Promise<Issue | null>;
  getByCode(code: string): Promise<Issue | null>;
  /** All issues, newest first. Callers filter/paginate in memory (fine at municipal-ward scale). */
  listAll(): Promise<Issue[]>;
  /** Atomically read-modify-write an issue. Return null from the mutator to abort. */
  update(id: string, mutate: (current: Issue) => Issue | null): Promise<Issue | null>;
  getImage(id: string, kind?: ImageKind): Promise<string | null>;
}
