import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'Not found'));
};

/** Central error handler: consistent JSON shape, no stack traces or internals leaked to clients. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  const status = (err as { status?: number; type?: string }).status;
  if (status === 404) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (status === 413) {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }
  if (status === 400 && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  logger.error('Unhandled error', {
    path: req.path,
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
