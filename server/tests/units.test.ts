import { describe, expect, it } from 'vitest';
import { canTransition, priorityFromScore } from '../src/domain/catalog.js';
import { loadEnv } from '../src/config/env.js';
import { passwordMatches, issueAdminToken, isAdminToken } from '../src/http/auth.js';
import { buildSeedIssues } from '../src/repositories/seed.js';
import { RequestBudget } from '../src/services/ai/budget.js';
import { heuristicAnalysis } from '../src/services/ai/heuristic.js';
import { OpenRouterProvider } from '../src/services/ai/openrouter.js';
import { ProviderUnavailableError, parseRetryDelayMs } from '../src/services/ai/provider.js';
import { findDuplicates, haversineMeters } from '../src/services/duplicates.js';
import { effectiveScore, toPublicIssue } from '../src/services/priority.js';
import { TtlCache } from '../src/lib/ttlCache.js';

describe('RequestBudget', () => {
  it('enforces requests per minute and recovers after a minute', () => {
    let now = Date.parse('2026-11-21T10:00:00Z');
    const budget = new RequestBudget(2, 100, () => now);
    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(false);
    now += 60_000;
    expect(budget.tryAcquire()).toBe(true);
  });

  it('enforces requests per day and resets at Pacific midnight', () => {
    let now = Date.parse('2026-11-21T07:00:00Z'); // 23:00 PST on Nov 20
    const budget = new RequestBudget(100, 1, () => now);
    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(false);
    now = Date.parse('2026-11-21T08:30:00Z'); // 00:30 PST on Nov 21
    expect(budget.tryAcquire()).toBe(true);
  });

  it('honours cooldowns', () => {
    let now = 1_000_000;
    const budget = new RequestBudget(100, 100, () => now);
    budget.cooldown(20_000);
    expect(budget.tryAcquire()).toBe(false);
    now += 20_001;
    expect(budget.tryAcquire()).toBe(true);
  });
});

describe('heuristic classifier', () => {
  it('classifies potholes to public works', () => {
    const r = heuristicAnalysis({ description: 'Big pothole on the road near my house' });
    expect(r.category).toBe('Roads & Potholes');
    expect(r.department).toBe('public_works');
  });

  it('marks live-wire hazards as critical', () => {
    const r = heuristicAnalysis({
      description: 'Exposed wire sparking from the electric pole near school',
    });
    expect(r.category).toBe('Streetlights & Electricity');
    expect(r.priority).toBe('critical');
  });

  it('detects Tamil text and Tamil keywords', () => {
    const r = heuristicAnalysis({ description: 'எங்கள் தெருவில் குப்பை நிறைந்து கிடக்கிறது' });
    expect(r.language).toBe('ta');
    expect(r.category).toBe('Garbage & Sanitation');
  });

  it('falls back to the grievance cell when nothing matches', () => {
    const r = heuristicAnalysis({ description: 'Something is wrong in our locality please check' });
    expect(r.category).toBe('Other');
    expect(r.department).toBe('grievance_cell');
  });
});

describe('duplicates', () => {
  it('computes great-circle distance', () => {
    expect(haversineMeters(11.0247, 77.0028, 11.0247, 77.0028)).toBe(0);
    expect(Math.round(haversineMeters(11.0, 77.0, 11.001, 77.0))).toBe(111);
  });

  it('finds a nearby open issue of the same category', () => {
    const seed = buildSeedIssues();
    const matches = findDuplicates(
      {
        text: 'pothole on service road near Hope College',
        category: 'Roads & Potholes',
        lat: 11.0263,
        lng: 77.0183,
      },
      seed,
    );
    expect(matches[0]?.issue.code).toBe('CR-PSG002');
  });

  it('ignores resolved issues and far-away issues', () => {
    const seed = buildSeedIssues();
    const resolved = findDuplicates(
      {
        text: 'open manhole race course',
        category: 'Drainage & Sewage',
        lat: 11.0005,
        lng: 76.9787,
      },
      seed,
    );
    expect(resolved.map((m) => m.issue.code)).not.toContain('CR-PSG005');
    const far = findDuplicates(
      { text: 'pothole', category: 'Roads & Potholes', lat: 13.08, lng: 80.27 },
      seed,
    );
    expect(far).toHaveLength(0);
  });
});

describe('priority & privacy', () => {
  it('boosts the queue score with community upvotes', () => {
    const [issue] = buildSeedIssues();
    const base = effectiveScore({ ...issue!, upvotes: 0 });
    expect(effectiveScore({ ...issue!, upvotes: 5 })).toBe(base + 15);
  });

  it('strips private fields from public issues', () => {
    const [issue] = buildSeedIssues();
    const pub = toPublicIssue({ ...issue!, reporter: { name: 'A', contact: 'secret' } });
    expect('reporter' in pub).toBe(false);
    expect('voterHashes' in pub).toBe(false);
  });

  it('maps scores to priorities and guards status transitions', () => {
    expect(priorityFromScore(85)).toBe('critical');
    expect(priorityFromScore(10)).toBe('low');
    expect(canTransition('reported', 'in_progress')).toBe(true);
    expect(canTransition('resolved', 'rejected')).toBe(false);
  });
});

describe('auth helpers', () => {
  it('compares passwords safely', () => {
    expect(passwordMatches('abc', 'abc')).toBe(true);
    expect(passwordMatches('abc', 'abcd')).toBe(false);
  });

  it('verifies only correctly signed admin tokens', () => {
    const secret = 'x'.repeat(40);
    expect(isAdminToken(issueAdminToken(secret), secret)).toBe(true);
    expect(isAdminToken(issueAdminToken(secret), 'y'.repeat(40))).toBe(false);
    expect(isAdminToken('garbage', secret)).toBe(false);
  });
});

describe('config', () => {
  it('rejects weak secrets', () => {
    expect(() => loadEnv({ ADMIN_PASSWORD: 'short', JWT_SECRET: 'tiny' })).toThrow(
      /ADMIN_PASSWORD/,
    );
  });

  it('refuses the placeholder password in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        ADMIN_PASSWORD: 'change-me-please',
        JWT_SECRET: 'z'.repeat(40),
      }),
    ).toThrow(/placeholder/);
  });

  it('applies safe defaults', () => {
    const env = loadEnv({ ADMIN_PASSWORD: 'long-enough', JWT_SECRET: 'z'.repeat(40) });
    expect(env.GEMINI_RPM).toBe(8);
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.SEED_DEMO_DATA).toBe(true);
  });
});

describe('provider utilities', () => {
  it('parses Google retry delays', () => {
    expect(parseRetryDelayMs('{"retryDelay": "37s"}')).toBe(37_000);
    expect(parseRetryDelayMs('12')).toBe(12_000);
    expect(parseRetryDelayMs(null)).toBeNull();
  });

  it('maps OpenRouter 429s to ProviderUnavailableError', async () => {
    const fakeFetch = (async () =>
      new Response('{}', { status: 429, headers: { 'retry-after': '5' } })) as typeof fetch;
    const provider = new OpenRouterProvider('key', 'model:free', false, fakeFetch);
    await expect(
      provider.generateJson({ system: 's', user: 'u', jsonSchema: {} }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('returns OpenRouter message content', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
      })) as typeof fetch;
    const provider = new OpenRouterProvider('key', 'model:free', false, fakeFetch);
    await expect(provider.generateJson({ system: 's', user: 'u', jsonSchema: {} })).resolves.toBe(
      '{"ok":true}',
    );
  });
});

describe('TtlCache', () => {
  it('expires entries and evicts the least recently used', () => {
    let now = 0;
    const cache = new TtlCache<number>(2, 100, () => now);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    now = 200;
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('Gemini thinking config', () => {
  it('uses a token budget for Gemini 2.5 and levels for Gemini 3.x', async () => {
    const { thinkingConfigFor } = await import('../src/services/ai/gemini.js');
    expect(thinkingConfigFor('gemini-2.5-flash', 'minimal')).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor('gemini-2.5-pro', 'minimal')).toEqual({ thinkingBudget: -1 });
    expect(thinkingConfigFor('gemini-3.5-flash', 'low')).toEqual({ thinkingLevel: 'LOW' });
  });
});
