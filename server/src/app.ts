import { existsSync } from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, notFound } from './http/errors.js';
import { createRateLimiters } from './http/rateLimits.js';
import type { AuthConfig } from './http/auth.js';
import type { IssueRepository } from './repositories/issueRepository.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { publicRoutes } from './routes/publicRoutes.js';
import type { AiService } from './services/ai/aiService.js';
import { IssueService } from './services/issueService.js';

export interface AppDeps {
  repo: IssueRepository;
  ai: AiService;
  auth: AuthConfig;
  corsOrigins?: string[];
  staticDir?: string;
  disableRateLimits?: boolean;
}

/** Express application factory — wired with real services in index.ts, with fakes in tests. */
export function createApp(deps: AppDeps): Express {
  const app = express();
  const service = new IssueService(deps.repo, deps.ai, deps.auth.jwtSecret);
  const limits = createRateLimiters(deps.disableRateLimits);

  app.disable('x-powered-by');
  // Cloud Run / Render terminate TLS at a proxy; trust exactly one hop for req.ip and secure cookies.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Leaflet positions map tiles with inline styles.
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
          connectSrc: ["'self'", 'https://nominatim.openstreetmap.org'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1.5mb' }));

  if (deps.corsOrigins?.length) {
    const allowed = new Set(deps.corsOrigins);
    app.use('/api', (req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowed.has(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
        res.set('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', storage: deps.repo.kind, ai: deps.ai.status().activeProvider });
  });

  app.use('/api', limits.api);
  app.use('/api', publicRoutes(service, limits));
  app.use('/api/admin', adminRoutes(service, deps.ai, deps.auth, limits));
  app.use('/api', notFound);

  // Serve the built React app (single container deployment).
  if (deps.staticDir && existsSync(deps.staticDir)) {
    app.use(
      '/assets',
      // fallthrough: false → a missing hashed asset is a real 404, not the SPA's index.html.
      express.static(path.join(deps.staticDir, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      }),
    );
    app.use(express.static(deps.staticDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(deps.staticDir!, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
