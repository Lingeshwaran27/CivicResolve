import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type Part,
  type ThinkingConfig,
} from '@google/genai';
import {
  ProviderUnavailableError,
  parseRetryDelayMs,
  type JsonRequest,
  type LlmProvider,
} from './provider.js';

const REQUEST_TIMEOUT_MS = 30_000;

export type GeminiThinking = 'minimal' | 'low' | 'medium' | 'high';

/**
 * Map one portable setting onto each model family:
 * Gemini 2.x uses a token budget (0 disables thinking); Gemini 3.x uses thinking levels.
 */
export function thinkingConfigFor(model: string, thinking: GeminiThinking): ThinkingConfig {
  if (/gemini-2(.|-)/.test(model)) {
    const budget = { minimal: 0, low: 512, medium: 2048, high: -1 }[thinking];
    // Flash-Lite and Flash accept 0; Pro models require a minimum budget, so use dynamic there.
    return { thinkingBudget: /pro/.test(model) && budget === 0 ? -1 : budget };
  }
  const levels = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
  };
  return { thinkingLevel: levels[thinking] };
}

/**
 * Google Gemini provider (Gemini API / Google AI Studio key).
 * Uses structured output (`responseJsonSchema`) so the model is constrained to our schema,
 * and multimodal input so the complaint photo is analysed together with the text.
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  readonly supportsImages = true;
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    /** Reasoning depth. Triage needs speed more than deep reasoning, so the default is minimal. */
    private readonly thinking: GeminiThinking = 'minimal',
  ) {
    this.client = new GoogleGenAI({
      apiKey,
      // Never let the SDK auto-retry: on the free tier a retry storm burns quota.
      // We fall back to another provider instead.
      // v1beta has full `responseJsonSchema` support (and the `*-latest` aliases).
      apiVersion: 'v1beta',
      httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
    });
  }

  async generateJson(request: JsonRequest): Promise<string> {
    const parts: Part[] = [{ text: request.user }];
    if (request.image) {
      parts.push({ inlineData: { mimeType: request.image.mimeType, data: request.image.base64 } });
    }
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
          temperature: 0.2,
          // Generous ceiling: newer Flash models may spend part of it on internal reasoning.
          maxOutputTokens: request.maxOutputTokens ?? 3072,
          thinkingConfig: thinkingConfigFor(this.model, this.thinking),
        },
      });
      const text = response.text;
      if (!text) throw new Error('Gemini returned an empty response');
      return text;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 429 || err.status >= 500)) {
        const daily = err.status === 429 && /per.?day|daily/i.test(err.message);
        throw new ProviderUnavailableError(
          `Gemini unavailable (${err.status})`,
          parseRetryDelayMs(err.message),
          daily,
        );
      }
      throw err;
    }
  }
}
