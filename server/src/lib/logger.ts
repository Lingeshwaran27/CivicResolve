type Level = 'debug' | 'info' | 'warn' | 'error';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Minimal structured logger. In production it emits one JSON object per line,
 * which Google Cloud Logging (Cloud Run) parses automatically into severity + fields.
 */
function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  if (isTest && level !== 'error') return;
  if (isProd) {
    const line = JSON.stringify({ severity: level.toUpperCase(), message, ...fields });
    (level === 'error' ? console.error : console.log)(line);
    return;
  }
  const extra = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : '';
  (level === 'error' ? console.error : console.log)(`[${level}] ${message}${extra}`);
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => log('debug', m, f),
  info: (m: string, f?: Record<string, unknown>) => log('info', m, f),
  warn: (m: string, f?: Record<string, unknown>) => log('warn', m, f),
  error: (m: string, f?: Record<string, unknown>) => log('error', m, f),
};
