import type { Firestore } from 'firebase-admin/firestore';
import type { ImageKind, Issue } from '../domain/types.js';
import type { IssueRepository } from './issueRepository.js';

const ISSUES = 'issues';
const IMAGES = 'issueImages';
const LIST_CACHE_MS = 10_000;
const MAX_ISSUES = 2000;

/**
 * Cloud Firestore adapter (works on the free Spark plan).
 * - Images live in a separate collection so list queries stay small and cheap.
 * - `listAll` is cached for a few seconds to keep reads well inside the free 50k/day quota.
 * - Only single-field ordering is used, so no composite indexes have to be created.
 */
export class FirestoreIssueRepository implements IssueRepository {
  readonly kind = 'firestore' as const;
  private listCache: { at: number; items: Issue[] } | null = null;

  constructor(private readonly db: Firestore) {}

  private invalidate(): void {
    this.listCache = null;
  }

  async create(issue: Issue, imageDataUrl?: string): Promise<Issue> {
    const batch = this.db.batch();
    batch.create(this.db.collection(ISSUES).doc(issue.id), issue);
    if (imageDataUrl)
      batch.set(this.db.collection(IMAGES).doc(issue.id), { dataUrl: imageDataUrl });
    await batch.commit();
    this.invalidate();
    return issue;
  }

  async getById(id: string): Promise<Issue | null> {
    const snap = await this.db.collection(ISSUES).doc(id).get();
    return snap.exists ? (snap.data() as Issue) : null;
  }

  async getByCode(code: string): Promise<Issue | null> {
    const snap = await this.db.collection(ISSUES).where('code', '==', code).limit(1).get();
    const doc = snap.docs[0];
    return doc ? (doc.data() as Issue) : null;
  }

  async listAll(): Promise<Issue[]> {
    if (this.listCache && Date.now() - this.listCache.at < LIST_CACHE_MS) {
      return this.listCache.items;
    }
    const snap = await this.db
      .collection(ISSUES)
      .orderBy('createdAt', 'desc')
      .limit(MAX_ISSUES)
      .get();
    const items = snap.docs.map((d) => d.data() as Issue);
    this.listCache = { at: Date.now(), items };
    return items;
  }

  async update(id: string, mutate: (current: Issue) => Issue | null): Promise<Issue | null> {
    const ref = this.db.collection(ISSUES).doc(id);
    const result = await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const next = mutate(snap.data() as Issue);
      if (!next) return null;
      tx.set(ref, next);
      return next;
    });
    if (result) this.invalidate();
    return result;
  }

  async getImage(id: string, kind: ImageKind = 'report'): Promise<string | null> {
    const docId = kind === 'resolution' ? `${id}__resolution` : id;
    const snap = await this.db.collection(IMAGES).doc(docId).get();
    const data = snap.data() as { dataUrl?: string } | undefined;
    return data?.dataUrl ?? null;
  }
}

/** Create a Firestore client from env: Application Default Credentials on Cloud Run, or a base64 service account elsewhere. */
export async function createFirestore(options: {
  projectId?: string;
  serviceAccountB64?: string;
}): Promise<Firestore> {
  const { initializeApp, cert, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) {
    const credential = options.serviceAccountB64
      ? cert(JSON.parse(Buffer.from(options.serviceAccountB64, 'base64').toString('utf8')))
      : applicationDefault();
    initializeApp({ credential, projectId: options.projectId });
  }
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}
