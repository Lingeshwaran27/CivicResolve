import rateLimit, { type Options } from 'express-rate-limit';

const base: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly.' },
};

export interface RateLimiters {
  api: ReturnType<typeof rateLimit>;
  ai: ReturnType<typeof rateLimit>;
  write: ReturnType<typeof rateLimit>;
  login: ReturnType<typeof rateLimit>;
}

/** Layered rate limits. The AI limiter protects the free-tier LLM quota from any single visitor. */
export function createRateLimiters(disabled = false): RateLimiters {
  const skip = () => disabled;
  return {
    api: rateLimit({ ...base, windowMs: 60_000, limit: 300, skip }),
    ai: rateLimit({ ...base, windowMs: 60_000, limit: 6, skip }),
    write: rateLimit({ ...base, windowMs: 10 * 60_000, limit: 30, skip }),
    login: rateLimit({ ...base, windowMs: 15 * 60_000, limit: 10, skip }),
  };
}
