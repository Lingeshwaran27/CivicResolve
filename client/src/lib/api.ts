import type {
  AdminIssue,
  AiStatus,
  AnalyzeResponse,
  Briefing,
  Catalog,
  Issue,
  Priority,
  Stats,
  Status,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; details?: { path: string; message: string }[] };
    throw new ApiError(res.status, b.error ?? `Request failed (${res.status})`, b.details ?? []);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export interface ReportPayload {
  title: string;
  description: string;
  category?: string;
  location: { address: string; lat?: number | null; lng?: number | null };
  image?: string;
  reporterName?: string;
  reporterContact?: string;
}

export interface IssueQuery {
  status?: Status;
  category?: string;
  priority?: Priority;
  department?: string;
  q?: string;
  sort?: 'newest' | 'priority' | 'upvotes';
  limit?: number;
}

function toQuery(q: IssueQuery): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const api = {
  catalog: () => request<Catalog>('/catalog'),
  stats: () => request<Stats>('/stats'),
  analyze: (
    payload: Omit<ReportPayload, 'location' | 'title'> & {
      title?: string;
      location?: Partial<ReportPayload['location']>;
    },
  ) => request<AnalyzeResponse>('/ai/analyze', json('POST', payload)),
  createIssue: (payload: ReportPayload) =>
    request<{ issue: Issue }>('/issues', json('POST', payload)),
  listIssues: (q: IssueQuery = {}) =>
    request<{ items: Issue[]; total: number }>(`/issues${toQuery(q)}`),
  getIssue: (code: string) => request<{ issue: Issue }>(`/issues/${encodeURIComponent(code)}`),
  upvote: (code: string) =>
    request<{ issue: Issue }>(`/issues/${encodeURIComponent(code)}/upvote`, json('POST')),
  rate: (code: string, score: number, comment?: string) =>
    request<{ issue: Issue }>(
      `/issues/${encodeURIComponent(code)}/rating`,
      json('POST', { score, comment }),
    ),
  imageUrl: (code: string, kind: 'report' | 'resolution' = 'report') =>
    `/api/issues/${encodeURIComponent(code)}/image${kind === 'resolution' ? '?kind=resolution' : ''}`,

  admin: {
    session: () => request<{ authenticated: boolean }>('/admin/session'),
    login: (password: string) => request<{ ok: true }>('/admin/login', json('POST', { password })),
    logout: () => request<{ ok: true }>('/admin/logout', json('POST')),
    issues: (q: IssueQuery = {}) =>
      request<{ items: AdminIssue[]; total: number }>(`/admin/issues${toQuery(q)}`),
    update: (
      id: string,
      change: Partial<{
        status: Status;
        priority: Priority;
        department: string;
        category: string;
        note: string;
      }>,
    ) =>
      request<{ issue: AdminIssue }>(
        `/admin/issues/${encodeURIComponent(id)}`,
        json('PATCH', change),
      ),
    briefing: (refresh = false) =>
      request<Briefing>(`/admin/briefing${refresh ? '?refresh=1' : ''}`),
    aiStatus: () => request<AiStatus>('/admin/ai-status'),
  },
};
