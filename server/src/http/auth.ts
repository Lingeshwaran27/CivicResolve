import { timingSafeEqual, createHash } from 'node:crypto';
import type { CookieOptions, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';

export const ADMIN_COOKIE = 'cr_admin';
const SESSION_HOURS = 8;

export interface AuthConfig {
  adminPassword: string;
  jwtSecret: string;
  secureCookies: boolean;
}

/** Constant-time password comparison (hash first so lengths always match). */
export function passwordMatches(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function issueAdminToken(secret: string): string {
  return jwt.sign({ role: 'admin' }, secret, {
    algorithm: 'HS256',
    expiresIn: `${SESSION_HOURS}h`,
    issuer: 'civicresolve',
  });
}

export function adminCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  };
}

export function isAdminToken(token: unknown, secret: string): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'civicresolve' });
    return typeof payload === 'object' && payload !== null && payload.role === 'admin';
  } catch {
    return false;
  }
}

export function requireAdmin(secret: string): RequestHandler {
  return (req, _res, next) => {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    if (isAdminToken(cookies?.[ADMIN_COOKIE], secret)) return next();
    next(new HttpError(401, 'Admin login required'));
  };
}
