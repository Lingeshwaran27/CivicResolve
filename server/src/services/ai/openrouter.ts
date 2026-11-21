import {
  ProviderUnavailableError,
  parseRetryDelayMs,
  type JsonRequest,
  type LlmProvider,
} from './provider.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string; code?: number };
}

/**
 * OpenRouter fallback provider (OpenAI-compatible API, free ":free" models).
 * Only used when Gemini is unconfigured, rate-limited or failing.
 */
export class OpenRouterProvider implements LlmProvider {
  readonly name = 'openrouter' as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    readonly supportsImages: boolean,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generateJson(request: JsonRequest): Promise<string> {
    const userContent: unknown =
      request.image && this.supportsImages
        ? [
            { type: 'text', text: request.user },
            {
              type: 'image_url',
              image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` },
            },
          ]
        : request.image
          ? `${request.user}\n(A photo was attached but is not visible to you; rely on the text.)`
          : request.user;

    const response = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Lingeshwaran27/CivicResolve',
        'X-Title': 'CivicResolve',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: request.maxOutputTokens ?? 1500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${request.system}\n\nRespond with a single JSON object matching this JSON Schema, no prose:\n${JSON.stringify(request.jsonSchema)}`,
          },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (response.status === 429 || response.status >= 500) {
      throw new ProviderUnavailableError(
        `OpenRouter unavailable (${response.status})`,
        parseRetryDelayMs(response.headers.get('retry-after')),
      );
    }
    const body = (await response.json()) as ChatCompletionResponse;
    if (!response.ok || body.error) {
      throw new Error(`OpenRouter error ${response.status}: ${body.error?.message ?? 'unknown'}`);
    }
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenRouter returned an empty response');
    return content;
  }
}
