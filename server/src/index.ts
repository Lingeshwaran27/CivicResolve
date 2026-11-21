import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import type { IssueRepository } from './repositories/issueRepository.js';
import { MemoryIssueRepository } from './repositories/memoryRepository.js';
import { buildSeedIssues, loadSeedImages } from './repositories/seed.js';
import { AiService } from './services/ai/aiService.js';
import { GeminiProvider } from './services/ai/gemini.js';
import { OpenRouterProvider } from './services/ai/openrouter.js';
import type { LlmProvider } from './services/ai/provider.js';

async function main(): Promise<void> {
  const env = loadEnv();

  const slots: { provider: LlmProvider; rpm: number; rpd: number }[] = [];
  if (env.GEMINI_API_KEY) {
    slots.push({
      provider: new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL, env.GEMINI_THINKING),
      rpm: env.GEMINI_RPM,
      rpd: env.GEMINI_RPD,
    });
  }
  if (env.OPENROUTER_API_KEY) {
    slots.push({
      provider: new OpenRouterProvider(
        env.OPENROUTER_API_KEY,
        env.OPENROUTER_MODEL,
        env.OPENROUTER_VISION,
      ),
      rpm: env.OPENROUTER_RPM,
      rpd: env.OPENROUTER_RPD,
    });
  }
  const ai = new AiService(slots);

  let repo: IssueRepository;
  if (env.FIRESTORE_ENABLED) {
    const { FirestoreIssueRepository, createFirestore } =
      await import('./repositories/firestoreRepository.js');
    const db = await createFirestore({
      projectId: env.FIREBASE_PROJECT_ID,
      serviceAccountB64: env.FIREBASE_SERVICE_ACCOUNT_B64,
    });
    repo = new FirestoreIssueRepository(db);
  } else {
    const seed = env.SEED_DEMO_DATA ? buildSeedIssues() : [];
    repo = new MemoryIssueRepository(seed, loadSeedImages(seed));
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = env.STATIC_DIR ?? path.resolve(here, '../../client/dist');

  const app = createApp({
    repo,
    ai,
    auth: {
      adminPassword: env.ADMIN_PASSWORD,
      jwtSecret: env.JWT_SECRET,
      secureCookies: env.NODE_ENV === 'production',
    },
    corsOrigins:
      env.NODE_ENV === 'production' ? [] : env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    staticDir,
  });

  const server = app.listen(env.PORT, () => {
    logger.info('CivicResolve API listening', {
      port: env.PORT,
      storage: repo.kind,
      aiProviders: slots.map((s) => `${s.provider.name}:${s.provider.model}`),
    });
  });

  const shutdown = (signal: string) => {
    logger.info('Shutting down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logger.error('Fatal start-up error', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
