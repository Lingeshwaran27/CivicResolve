import { describe, expect, it } from 'vitest';
import { AiService, normalizeAnalysis } from '../src/services/ai/aiService.js';
import { ProviderUnavailableError } from '../src/services/ai/provider.js';
import { extractJson } from '../src/services/ai/schema.js';
import { FakeProvider, validAnalysisJson } from './helpers.js';

const input = { description: 'Deep pothole on the main road near the school, bikes are falling.' };

describe('AiService', () => {
  it('uses the primary provider and validates its output', async () => {
    const gemini = new FakeProvider('gemini', () => validAnalysisJson());
    const ai = new AiService([{ provider: gemini, rpm: 10, rpd: 10 }]);
    const result = await ai.analyze(input);
    expect(result).toMatchObject({
      provider: 'gemini',
      category: 'Roads & Potholes',
      impactScore: 72,
    });
  });

  it('caches identical requests and coalesces concurrent ones', async () => {
    const gemini = new FakeProvider('gemini', () => validAnalysisJson());
    const ai = new AiService([{ provider: gemini, rpm: 10, rpd: 10 }]);
    await Promise.all([ai.analyze(input), ai.analyze(input)]);
    await ai.analyze(input);
    expect(gemini.calls).toHaveLength(1);
    expect(ai.peek(input)).toBeDefined();
  });

  it('falls back to OpenRouter when Gemini is rate-limited, then cools Gemini down', async () => {
    const gemini = new FakeProvider('gemini', () => {
      throw new ProviderUnavailableError('429', 30_000);
    });
    const openrouter = new FakeProvider('openrouter', () =>
      validAnalysisJson({ priority: 'medium', impactScore: 50 }),
    );
    const ai = new AiService([
      { provider: gemini, rpm: 10, rpd: 10 },
      { provider: openrouter, rpm: 10, rpd: 10 },
    ]);
    const first = await ai.analyze(input);
    expect(first.provider).toBe('openrouter');
    await ai.analyze({ description: 'Another different complaint about garbage overflowing.' });
    // Gemini is on cooldown, so it is not called a second time.
    expect(gemini.calls).toHaveLength(1);
    expect(ai.status().providers[0]?.budget.cooldownUntil).not.toBeNull();
  });

  it('falls back to the rule-based engine when output is invalid', async () => {
    const gemini = new FakeProvider('gemini', () => '{"category":"Not a category"}');
    const ai = new AiService([{ provider: gemini, rpm: 10, rpd: 10 }]);
    const result = await ai.analyze(input);
    expect(result.provider).toBe('heuristic');
    expect(result.category).toBe('Roads & Potholes');
  });

  it('respects the self-imposed requests-per-minute budget', async () => {
    const gemini = new FakeProvider('gemini', () => validAnalysisJson());
    const ai = new AiService([{ provider: gemini, rpm: 2, rpd: 100 }]);
    for (let i = 0; i < 4; i += 1)
      await ai.analyze({ description: `Unique complaint number ${i} about a pothole` });
    expect(gemini.calls).toHaveLength(2);
  });

  it('stops calling a provider for the day when its daily quota is exhausted', async () => {
    const gemini = new FakeProvider('gemini', () => {
      throw new ProviderUnavailableError('quota', null, true);
    });
    const ai = new AiService([{ provider: gemini, rpm: 10, rpd: 100 }]);
    await ai.analyze(input);
    expect(ai.status().providers[0]?.budget.remainingToday).toBe(0);
    expect(ai.status().activeProvider).toBe('heuristic');
  });

  it('caches the admin briefing', async () => {
    const gemini = new FakeProvider('gemini', () =>
      JSON.stringify({
        headline: 'All good',
        summary: 'Quiet day.',
        hotspots: [],
        actions: [],
        riskAlerts: [],
      }),
    );
    const ai = new AiService([{ provider: gemini, rpm: 10, rpd: 10 }]);
    const { buildSeedIssues } = await import('../src/repositories/seed.js');
    const issues = buildSeedIssues();
    const a = await ai.briefing(issues);
    const b = await ai.briefing(issues, true); // forced refresh within 60s is ignored
    expect(a.provider).toBe('gemini');
    expect(b).toBe(a);
    expect(gemini.calls).toHaveLength(1);
  });
});

describe('normalizeAnalysis', () => {
  it('clamps an impact score that disagrees with the priority label', () => {
    const raw = JSON.parse(validAnalysisJson({ priority: 'critical', impactScore: 40 }));
    const result = normalizeAnalysis(raw, 'gemini', 'm');
    expect(result.priority).toBe('critical');
    expect(result.impactScore).toBe(80);
  });

  it('drops a translation when the text is already English', () => {
    const raw = JSON.parse(validAnalysisJson({ language: 'EN', translatedDescription: 'same' }));
    expect(normalizeAnalysis(raw, 'gemini', 'm').translatedDescription).toBeNull();
  });
});

describe('extractJson', () => {
  it('parses fenced JSON returned by chat models', () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('throws when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});
