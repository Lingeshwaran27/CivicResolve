import { createApp } from '../src/app.js';
import { MemoryIssueRepository } from '../src/repositories/memoryRepository.js';
import { buildSeedIssues } from '../src/repositories/seed.js';
import { AiService } from '../src/services/ai/aiService.js';
import type { JsonRequest, LlmProvider } from '../src/services/ai/provider.js';

export const ADMIN_PASSWORD = 'test-admin-password';
export const JWT_SECRET = 'test-jwt-secret-that-is-long-enough-123456';

/** Scriptable fake LLM provider — tests never call real APIs. */
export class FakeProvider implements LlmProvider {
  readonly supportsImages = true;
  calls: JsonRequest[] = [];

  constructor(
    readonly name: 'gemini' | 'openrouter',
    private readonly respond: (req: JsonRequest) => Promise<string> | string,
    readonly model = 'fake-model',
  ) {}

  async generateJson(request: JsonRequest): Promise<string> {
    this.calls.push(request);
    return this.respond(request);
  }
}

export const validAnalysisJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    category: 'Roads & Potholes',
    priority: 'high',
    impactScore: 72,
    department: 'public_works',
    suggestedTitle: 'Deep pothole on main road',
    summary: 'A deep pothole on a busy road is causing skids.',
    reasoning: 'Busy road with two-wheeler traffic; risk of accidents.',
    hazards: ['Two-wheeler skids'],
    language: 'en',
    translatedDescription: null,
    estimatedResolutionDays: 3,
    confidence: 0.86,
    ...overrides,
  });

export function makeTestApp(
  options: { providers?: LlmProvider[]; seed?: boolean; staticDir?: string } = {},
) {
  const repo = new MemoryIssueRepository(options.seed ? buildSeedIssues() : []);
  const ai = new AiService(
    (options.providers ?? []).map((provider) => ({ provider, rpm: 100, rpd: 1000 })),
  );
  const app = createApp({
    repo,
    ai,
    auth: { adminPassword: ADMIN_PASSWORD, jwtSecret: JWT_SECRET, secureCookies: false },
    disableRateLimits: true,
    staticDir: options.staticDir,
  });
  return { app, repo, ai };
}

// 1x1 transparent PNG
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
