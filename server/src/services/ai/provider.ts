/** A single image passed to a multimodal model. */
export interface ImageInput {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Raw base64 (no data: prefix). */
  base64: string;
}

export interface JsonRequest {
  system: string;
  user: string;
  image?: ImageInput;
  /** JSON Schema describing the expected response (used by providers that support it). */
  jsonSchema: unknown;
  maxOutputTokens?: number;
}

/** Thrown by providers when the upstream API rate-limits or is temporarily unavailable. */
export class ProviderUnavailableError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number | null,
    readonly dailyQuotaExhausted = false,
  ) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

/** A remote LLM that can return a JSON document as text. */
export interface LlmProvider {
  readonly name: 'gemini' | 'openrouter';
  readonly model: string;
  readonly supportsImages: boolean;
  generateJson(request: JsonRequest): Promise<string>;
}

/** Parse "retryDelay": "37s" (Google RPC RetryInfo) or Retry-After headers into milliseconds. */
export function parseRetryDelayMs(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i.exec(text);
  if (match?.[1]) return Math.ceil(Number(match[1]) * 1000);
  const seconds = Number(text);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}
