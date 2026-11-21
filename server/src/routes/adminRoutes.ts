import { Router } from 'express';
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  isAdminToken,
  issueAdminToken,
  passwordMatches,
  requireAdmin,
  type AuthConfig,
} from '../http/auth.js';
import { HttpError } from '../http/errors.js';
import type { RateLimiters } from '../http/rateLimits.js';
import {
  AdminUpdateBodySchema,
  IdParamSchema,
  ListQuerySchema,
  LoginBodySchema,
} from '../http/schemas.js';
import type { AiService } from '../services/ai/aiService.js';
import type { IssueService } from '../services/issueService.js';
import { toAdminIssue } from '../services/priority.js';

export function adminRoutes(
  service: IssueService,
  ai: AiService,
  auth: AuthConfig,
  limits: RateLimiters,
): Router {
  const router = Router();

  router.post('/login', limits.login, (req, res) => {
    const { password } = LoginBodySchema.parse(req.body);
    if (!passwordMatches(password, auth.adminPassword)) {
      throw new HttpError(401, 'Incorrect password');
    }
    res.cookie(
      ADMIN_COOKIE,
      issueAdminToken(auth.jwtSecret),
      adminCookieOptions(auth.secureCookies),
    );
    res.json({ ok: true });
  });

  router.post('/logout', (_req, res) => {
    const { maxAge: _maxAge, ...opts } = adminCookieOptions(auth.secureCookies);
    res.clearCookie(ADMIN_COOKIE, opts);
    res.json({ ok: true });
  });

  router.get('/session', (req, res) => {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    res.set('Cache-Control', 'no-store');
    res.json({ authenticated: isAdminToken(cookies?.[ADMIN_COOKIE], auth.jwtSecret) });
  });

  // Everything below requires an admin session.
  router.use(requireAdmin(auth.jwtSecret));

  router.get('/issues', async (req, res) => {
    const query = ListQuerySchema.parse({ sort: 'priority', limit: 200, ...req.query });
    const { items, total } = await service.list(query);
    res.set('Cache-Control', 'no-store');
    res.json({ items: items.map((i) => toAdminIssue(i)), total });
  });

  router.patch('/issues/:id', limits.write, async (req, res) => {
    const { id } = IdParamSchema.parse(req.params);
    const body = AdminUpdateBodySchema.parse(req.body);
    const issue = await service.adminUpdate(id, body);
    res.json({ issue: toAdminIssue(issue) });
  });

  router.get('/briefing', limits.ai, async (req, res) => {
    const refresh = req.query.refresh === '1';
    res.set('Cache-Control', 'no-store');
    res.json(await ai.briefing(await service.allIssues(), refresh));
  });

  router.get('/ai-status', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(ai.status());
  });

  return router;
}
