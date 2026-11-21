/** API contract types (mirror of server/src/domain). */
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'reported' | 'in_progress' | 'resolved' | 'rejected';
export type AiProviderName = 'gemini' | 'openrouter' | 'heuristic' | 'seed';

export interface Department {
  id: string;
  name: string;
  description: string;
  slaDays: Record<Priority, number>;
}

export interface Catalog {
  categories: string[];
  priorities: Priority[];
  statuses: Status[];
  departments: Department[];
}

export interface AiAnalysis {
  category: string;
  priority: Priority;
  impactScore: number;
  department: string;
  suggestedTitle: string;
  summary: string;
  reasoning: string;
  hazards: string[];
  language: string;
  translatedDescription: string | null;
  estimatedResolutionDays: number;
  confidence: number;
  provider: AiProviderName;
  model: string;
}

export interface StatusEvent {
  status: Status;
  note: string;
  at: string;
  by: 'citizen' | 'admin' | 'system';
}

export interface PhotoCredit {
  author: string;
  license: string;
  source: string;
}

export interface Issue {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  department: string;
  priority: Priority;
  status: Status;
  location: { address: string; lat: number | null; lng: number | null };
  ai: AiAnalysis | null;
  overrides: { category: boolean; priority: boolean; department: boolean };
  hasImage: boolean;
  photoCredit?: PhotoCredit | null;
  resolution?: { photo: boolean; note: string; credit: PhotoCredit | null } | null;
  sample?: boolean;
  upvotes: number;
  history: StatusEvent[];
  rating: { score: number; comment: string; at: string } | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  effectiveScore: number;
  slaDueAt: string;
  overdue: boolean;
}

export interface AdminIssue extends Issue {
  reporter: { name: string; contact: string } | null;
}

export interface DuplicateMatch {
  issue: Issue;
  score: number;
  distanceMeters: number | null;
}

export interface AnalyzeResponse {
  analysis: AiAnalysis;
  duplicates: DuplicateMatch[];
}

export interface Stats {
  total: number;
  open: number;
  overdue: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  byCategory: Record<string, number>;
  byDepartment: Record<string, number>;
  avgResolutionHours: number | null;
  satisfaction: number | null;
  aiOverrideRate: number;
  trend: { date: string; reported: number; resolved: number }[];
}

export interface Briefing {
  headline: string;
  summary: string;
  hotspots: { area: string; issue: string; recommendation: string }[];
  actions: string[];
  riskAlerts: string[];
  generatedAt: string;
  provider: AiProviderName;
  model: string;
  openIssues: number;
}

export interface AiStatus {
  activeProvider: AiProviderName;
  providers: {
    name: string;
    model: string;
    budget: {
      rpm: number;
      rpd: number;
      usedToday: number;
      remainingToday: number;
      cooldownUntil: string | null;
    };
  }[];
  cacheEntries: number;
}
