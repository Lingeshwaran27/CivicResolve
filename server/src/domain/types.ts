import type { Category, DepartmentId, Priority, Status } from './catalog.js';

export type AiProviderName = 'gemini' | 'openrouter' | 'heuristic' | 'seed';

/** Structured, validated output of the AI triage step. */
export interface AiAnalysis {
  category: Category;
  priority: Priority;
  /** 0–100 estimate of public impact / urgency. */
  impactScore: number;
  department: DepartmentId;
  suggestedTitle: string;
  summary: string;
  /** Plain-language explanation of why this priority and department were chosen. */
  reasoning: string;
  hazards: string[];
  /** ISO 639-1 code of the citizen's original text, e.g. "en", "ta", "hi". */
  language: string;
  /** English translation when the original text was not English. */
  translatedDescription: string | null;
  estimatedResolutionDays: number;
  /** 0–1 self-reported confidence of the classifier. */
  confidence: number;
  provider: AiProviderName;
  model: string;
}

export interface GeoLocation {
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface StatusEvent {
  status: Status;
  note: string;
  at: string;
  by: 'citizen' | 'admin' | 'system';
}

export interface Rating {
  score: number;
  comment: string;
  at: string;
}

export interface PhotoCredit {
  author: string;
  license: string;
  source: string;
}

export type ImageKind = 'report' | 'resolution';

export interface Issue {
  id: string;
  /** Short, human-friendly tracking code, e.g. CR-7K2M9Q. */
  code: string;
  title: string;
  description: string;
  category: Category;
  department: DepartmentId;
  priority: Priority;
  status: Status;
  location: GeoLocation;
  ai: AiAnalysis | null;
  /** Which AI suggestions were changed by the citizen or an admin. */
  overrides: { category: boolean; priority: boolean; department: boolean };
  hasImage: boolean;
  /** Attribution for openly licensed demo photos (sample data only). */
  photoCredit?: PhotoCredit | null;
  /** Proof-of-resolution photo uploaded by officials. */
  resolution?: { photo: boolean; note: string; credit: PhotoCredit | null } | null;
  /** True for illustrative demo complaints (seed data). */
  sample?: boolean;
  upvotes: number;
  /** Salted hashes of upvoters (private — never returned publicly). */
  voterHashes: string[];
  history: StatusEvent[];
  /** Private reporter details — only visible to admins. */
  reporter: { name: string; contact: string } | null;
  rating: Rating | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

/** The subset of an issue that is safe to expose publicly. */
export type PublicIssue = Omit<Issue, 'voterHashes' | 'reporter'> & {
  effectiveScore: number;
  slaDueAt: string;
  overdue: boolean;
};

export type AdminIssue = PublicIssue & { reporter: Issue['reporter'] };
