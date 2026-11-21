import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_PASSWORD,
  FakeProvider,
  TINY_PNG,
  makeTestApp,
  validAnalysisJson,
} from './helpers.js';

const report = {
  title: 'Deep pothole near bus stop',
  description:
    'There is a very deep pothole on the main road near the bus stop, bikes are skidding.',
  location: { address: 'Avinashi Road, Peelamedu', lat: 11.0247, lng: 77.0028 },
};

async function adminAgent(app: ReturnType<typeof makeTestApp>['app']) {
  const agent = request.agent(app);
  const res = await agent.post('/api/admin/login').send({ password: ADMIN_PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

describe('public API', () => {
  it('reports health and storage mode', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', storage: 'memory', ai: 'heuristic' });
  });

  it('sets security headers', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('serves the catalog', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/catalog');
    expect(res.body.categories).toContain('Roads & Potholes');
    expect(res.body.departments.length).toBeGreaterThan(5);
  });

  it('analyzes a complaint with the configured AI provider and finds nearby duplicates', async () => {
    const gemini = new FakeProvider('gemini', () => validAnalysisJson());
    const { app } = makeTestApp({ providers: [gemini], seed: true });
    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ ...report, location: { lat: 11.0262, lng: 77.0182 } });
    expect(res.status).toBe(200);
    expect(res.body.analysis).toMatchObject({
      category: 'Roads & Potholes',
      priority: 'high',
      provider: 'gemini',
    });
    expect(res.body.duplicates[0].issue.code).toBe('CR-PSG002');
  });

  it('sends the photo to the model as multimodal input', async () => {
    const gemini = new FakeProvider('gemini', () => validAnalysisJson());
    const { app } = makeTestApp({ providers: [gemini] });
    await request(app)
      .post('/api/ai/analyze')
      .send({ ...report, image: TINY_PNG })
      .expect(200);
    expect(gemini.calls[0]?.image?.mimeType).toBe('image/png');
  });

  it('creates an issue reusing the cached analysis (one AI call per report)', async () => {
    const gemini = new FakeProvider('gemini', () => validAnalysisJson());
    const { app } = makeTestApp({ providers: [gemini] });
    await request(app).post('/api/ai/analyze').send(report).expect(200);
    const res = await request(app).post('/api/issues').send(report);
    expect(res.status).toBe(201);
    expect(res.body.issue.code).toMatch(/^CR-[A-Z0-9]{6}$/);
    expect(res.body.issue).toMatchObject({
      status: 'reported',
      department: 'public_works',
      priority: 'high',
    });
    expect(gemini.calls).toHaveLength(1);
  });

  it('routes by the citizen category when they override the AI', async () => {
    const gemini = new FakeProvider('gemini', () => validAnalysisJson());
    const { app } = makeTestApp({ providers: [gemini] });
    const res = await request(app)
      .post('/api/issues')
      .send({ ...report, category: 'Drainage & Sewage' })
      .expect(201);
    expect(res.body.issue.department).toBe('drainage');
    expect(res.body.issue.overrides.category).toBe(true);
  });

  it('never exposes reporter contact details publicly', async () => {
    const { app } = makeTestApp();
    const created = await request(app)
      .post('/api/issues')
      .send({ ...report, reporterName: 'Asha', reporterContact: 'asha@example.com' })
      .expect(201);
    const res = await request(app).get(`/api/issues/${created.body.issue.code}`);
    expect(JSON.stringify(res.body)).not.toContain('asha@example.com');
    expect(res.body.issue.voterHashes).toBeUndefined();
  });

  it('stores and serves an attached photo', async () => {
    const { app } = makeTestApp();
    const created = await request(app)
      .post('/api/issues')
      .send({ ...report, image: TINY_PNG })
      .expect(201);
    const img = await request(app).get(`/api/issues/${created.body.issue.code}/image`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
  });

  it('rejects invalid input with field-level errors', async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'x', description: 'short', location: {} });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['title', 'description', 'location.address']),
    );
  });

  it('rejects non-image uploads', async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post('/api/issues')
      .send({ ...report, image: 'data:text/html;base64,PHNjcmlwdD4=' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown tracking codes and 400 for malformed ones', async () => {
    const { app } = makeTestApp();
    await request(app).get('/api/issues/CR-ZZZZZZ').expect(404);
    await request(app).get('/api/issues/not-a-code').expect(400);
  });

  it('allows one upvote per client', async () => {
    const { app } = makeTestApp({ seed: true });
    const first = await request(app).post('/api/issues/CR-PSG002/upvote');
    expect(first.status).toBe(200);
    expect(first.body.issue.upvotes).toBe(10);
    await request(app).post('/api/issues/CR-PSG002/upvote').expect(409);
  });

  it('filters and sorts the public list', async () => {
    const { app } = makeTestApp({ seed: true });
    const res = await request(app).get('/api/issues?status=reported&sort=priority');
    expect(res.status).toBe(200);
    expect(res.body.items.every((i: { status: string }) => i.status === 'reported')).toBe(true);
    const scores = res.body.items.map((i: { effectiveScore: number }) => i.effectiveScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('computes dashboard statistics', async () => {
    const { app } = makeTestApp({ seed: true });
    const res = await request(app).get('/api/stats');
    expect(res.body.total).toBe(15);
    expect(res.body.byStatus.resolved).toBe(4);
    expect(res.body.trend).toHaveLength(14);
    expect(res.body.satisfaction).toBeGreaterThan(0);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('admin API', () => {
  it('requires authentication', async () => {
    const { app } = makeTestApp();
    await request(app).get('/api/admin/issues').expect(401);
    await request(app).patch('/api/admin/issues/x').send({ status: 'resolved' }).expect(401);
  });

  it('rejects a wrong password', async () => {
    const { app } = makeTestApp();
    await request(app).post('/api/admin/login').send({ password: 'wrong' }).expect(401);
  });

  it('sets an httpOnly, SameSite=Strict session cookie', async () => {
    const { app } = makeTestApp();
    const res = await request(app).post('/api/admin/login').send({ password: ADMIN_PASSWORD });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('walks an issue through the full lifecycle and lets the citizen rate it', async () => {
    const { app } = makeTestApp();
    const agent = await adminAgent(app);
    const created = await request(app)
      .post('/api/issues')
      .send({ ...report, reporterContact: '98765 43210' })
      .expect(201);
    const { id, code } = created.body.issue;

    const list = await agent.get('/api/admin/issues').expect(200);
    expect(list.body.items[0].reporter.contact).toBe('98765 43210');

    await request(app).post(`/api/issues/${code}/rating`).send({ score: 5 }).expect(409);

    const progress = await agent
      .patch(`/api/admin/issues/${id}`)
      .send({ status: 'in_progress', note: 'Crew dispatched', department: 'drainage' })
      .expect(200);
    expect(progress.body.issue.status).toBe('in_progress');
    expect(progress.body.issue.overrides.department).toBe(true);

    const resolved = await agent
      .patch(`/api/admin/issues/${id}`)
      .send({ status: 'resolved' })
      .expect(200);
    expect(resolved.body.issue.resolvedAt).not.toBeNull();
    expect(resolved.body.issue.history.map((h: { status: string }) => h.status)).toEqual([
      'reported',
      'in_progress',
      'resolved',
    ]);

    const rated = await request(app)
      .post(`/api/issues/${code}/rating`)
      .send({ score: 5, comment: 'Fixed fast!' })
      .expect(200);
    expect(rated.body.issue.rating.score).toBe(5);
    await request(app).post(`/api/issues/${code}/rating`).send({ score: 1 }).expect(409);
  });

  it('blocks invalid status transitions', async () => {
    const { app, repo } = makeTestApp({ seed: true });
    const agent = await adminAgent(app);
    const resolved = (await repo.getByCode('CR-PSG005'))!;
    const res = await agent.patch(`/api/admin/issues/${resolved.id}`).send({ status: 'rejected' });
    expect(res.status).toBe(409);
  });

  it('produces a daily briefing (rule-based without an LLM)', async () => {
    const { app } = makeTestApp({ seed: true });
    const agent = await adminAgent(app);
    const res = await agent.get('/api/admin/briefing').expect(200);
    expect(res.body.provider).toBe('heuristic');
    expect(res.body.openIssues).toBeGreaterThan(0);
  });

  it('logs out by clearing the session', async () => {
    const { app } = makeTestApp();
    const agent = await adminAgent(app);
    await agent.post('/api/admin/logout').expect(200);
    const session = await agent.get('/api/admin/session');
    expect(session.body.authenticated).toBe(false);
  });
});

describe('static web app', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'civic-static-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>');
  writeFileSync(path.join(dir, 'assets', 'app-123.js'), 'console.log(1)');

  it('serves the SPA shell for client-side routes', async () => {
    const { app } = makeTestApp({ staticDir: dir });
    const res = await request(app).get('/track/CR-PSG001');
    expect(res.status).toBe(200);
    expect(res.text).toContain('root');
  });

  it('serves hashed assets with long-lived caching and 404s missing ones', async () => {
    const { app } = makeTestApp({ staticDir: dir });
    const ok = await request(app).get('/assets/app-123.js');
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toContain('immutable');
    await request(app).get('/assets/missing.js').expect(404);
  });
});

describe('demo photos', () => {
  it('serves openly licensed sample photos with credits, including resolution proof', async () => {
    const { buildSeedIssues, loadSeedImages } = await import('../src/repositories/seed.js');
    const { MemoryIssueRepository } = await import('../src/repositories/memoryRepository.js');
    const { AiService } = await import('../src/services/ai/aiService.js');
    const { createApp } = await import('../src/app.js');
    const seed = buildSeedIssues();
    const app = createApp({
      repo: new MemoryIssueRepository(seed, loadSeedImages(seed)),
      ai: new AiService([]),
      auth: { adminPassword: 'x'.repeat(10), jwtSecret: 'y'.repeat(40), secureCookies: false },
      disableRateLimits: true,
    });
    const issue = (await request(app).get('/api/issues/CR-PSG005')).body.issue;
    expect(issue.sample).toBe(true);
    expect(issue.photoCredit.license).toBeTruthy();
    expect(issue.resolution.photo).toBe(true);
    const before = await request(app).get('/api/issues/CR-PSG005/image');
    const after = await request(app).get('/api/issues/CR-PSG005/image?kind=resolution');
    expect(before.headers['content-type']).toBe('image/jpeg');
    expect(after.status).toBe(200);
    await request(app).get('/api/issues/CR-PSG001/image?kind=resolution').expect(404);
  });
});
