import { Router } from 'express';
import { CATEGORIES, DEPARTMENTS, PRIORITIES, STATUSES } from '../domain/catalog.js';
import type { RateLimiters } from '../http/rateLimits.js';
import {
  AnalyzeBodySchema,
  CodeParamSchema,
  CreateIssueBodySchema,
  ListQuerySchema,
  RatingBodySchema,
  parseImageDataUrl,
} from '../http/schemas.js';
import type { AnalyzeInput } from '../services/ai/aiService.js';
import type { IssueService } from '../services/issueService.js';
import { toPublicIssue } from '../services/priority.js';

function toAnalyzeInput(body: {
  title?: string;
  description: string;
  location?: { address?: string };
  image?: string;
}): AnalyzeInput {
  return {
    title: body.title || undefined,
    description: body.description,
    address: body.location?.address || undefined,
    image: body.image ? parseImageDataUrl(body.image) : undefined,
  };
}

export function publicRoutes(service: IssueService, limits: RateLimiters): Router {
  const router = Router();

  router.get('/catalog', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      categories: CATEGORIES,
      priorities: PRIORITIES,
      statuses: STATUSES,
      departments: Object.values(DEPARTMENTS),
    });
  });

  /** AI triage preview: classification + priority + department + likely duplicates. */
  router.post('/ai/analyze', limits.ai, async (req, res) => {
    const body = AnalyzeBodySchema.parse(req.body);
    const { analysis, duplicates } = await service.analyze(toAnalyzeInput(body), body.location);
    res.json({
      analysis,
      duplicates: duplicates.map((d) => ({
        issue: toPublicIssue(d.issue),
        score: d.score,
        distanceMeters: d.distanceMeters,
      })),
    });
  });

  router.get('/issues', async (req, res) => {
    const query = ListQuerySchema.parse(req.query);
    const { items, total } = await service.list(query);
    res.set('Cache-Control', 'no-store');
    res.json({ items: items.map((i) => toPublicIssue(i)), total });
  });

  router.post('/issues', limits.write, limits.ai, async (req, res) => {
    const body = CreateIssueBodySchema.parse(req.body);
    const issue = await service.create({
      title: body.title,
      description: body.description,
      category: body.category,
      location: body.location,
      imageDataUrl: body.image,
      analyzeInput: toAnalyzeInput(body),
      reporterName: body.reporterName || undefined,
      reporterContact: body.reporterContact || undefined,
    });
    res.status(201).json({ issue: toPublicIssue(issue) });
  });

  router.get('/issues/:code', async (req, res) => {
    const { code } = CodeParamSchema.parse(req.params);
    res.set('Cache-Control', 'no-store');
    res.json({ issue: toPublicIssue(await service.getByCode(code)) });
  });

  router.get('/issues/:code/image', async (req, res) => {
    const { code } = CodeParamSchema.parse(req.params);
    const kind = req.query.kind === 'resolution' ? 'resolution' : 'report';
    const dataUrl = await service.getImage(code, kind);
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match?.[1] || !match[2]) {
      res.status(404).json({ error: 'No photo for this complaint' });
      return;
    }
    res.set('Content-Type', match[1]);
    res.set('Cache-Control', 'public, max-age=86400, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(match[2], 'base64'));
  });

  router.post('/issues/:code/upvote', limits.write, async (req, res) => {
    const { code } = CodeParamSchema.parse(req.params);
    const issue = await service.upvote(code, req.ip ?? 'unknown');
    res.json({ issue: toPublicIssue(issue) });
  });

  router.post('/issues/:code/rating', limits.write, async (req, res) => {
    const { code } = CodeParamSchema.parse(req.params);
    const body = RatingBodySchema.parse(req.body);
    const issue = await service.rate(code, body.score, body.comment);
    res.json({ issue: toPublicIssue(issue) });
  });

  router.get('/stats', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=15');
    res.json(await service.stats());
  });

  return router;
}
