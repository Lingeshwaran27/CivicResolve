import { z } from 'zod';
import { CATEGORIES, DEPARTMENT_IDS, PRIORITIES } from '../../domain/catalog.js';

/**
 * Zod schema used to validate whatever the LLM returns.
 * LLM output is treated as untrusted input: anything that fails validation is discarded.
 */
export const RawAnalysisSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  impactScore: z.coerce.number().min(0).max(100),
  department: z.enum(DEPARTMENT_IDS),
  suggestedTitle: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(3).max(600),
  reasoning: z.string().trim().min(3).max(800),
  hazards: z.array(z.string().trim().max(120)).max(6).default([]),
  language: z.string().trim().min(2).max(12).default('en'),
  translatedDescription: z.string().trim().max(3000).nullable().optional(),
  estimatedResolutionDays: z.coerce.number().min(0).max(90),
  confidence: z.coerce.number().min(0).max(1),
});
export type RawAnalysis = z.infer<typeof RawAnalysisSchema>;

/**
 * Standard JSON Schema handed to Gemini's `responseJsonSchema` so the model
 * is constrained to emit exactly this structure.
 */
export const GEMINI_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CATEGORIES] },
    priority: { type: 'string', enum: [...PRIORITIES] },
    impactScore: { type: 'integer', minimum: 0, maximum: 100 },
    department: { type: 'string', enum: [...DEPARTMENT_IDS] },
    suggestedTitle: { type: 'string' },
    summary: { type: 'string' },
    reasoning: { type: 'string' },
    hazards: { type: 'array', items: { type: 'string' } },
    language: { type: 'string' },
    translatedDescription: { type: ['string', 'null'] },
    estimatedResolutionDays: { type: 'integer', minimum: 0, maximum: 90 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: [
    'category',
    'priority',
    'impactScore',
    'department',
    'suggestedTitle',
    'summary',
    'reasoning',
    'hazards',
    'language',
    'estimatedResolutionDays',
    'confidence',
  ],
} as const;

export const BriefingSchema = z.object({
  headline: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(3).max(1200),
  hotspots: z
    .array(
      z.object({
        area: z.string().trim().max(160),
        issue: z.string().trim().max(300),
        recommendation: z.string().trim().max(300),
      }),
    )
    .max(6)
    .default([]),
  actions: z.array(z.string().trim().max(300)).max(8).default([]),
  riskAlerts: z.array(z.string().trim().max(300)).max(6).default([]),
});
export type Briefing = z.infer<typeof BriefingSchema>;

export const GEMINI_BRIEFING_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    hotspots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          issue: { type: 'string' },
          recommendation: { type: 'string' },
        },
        required: ['area', 'issue', 'recommendation'],
      },
    },
    actions: { type: 'array', items: { type: 'string' } },
    riskAlerts: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'summary', 'hotspots', 'actions', 'riskAlerts'],
} as const;

/** Extract the first JSON object from model text (handles ```json fences from non-schema models). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('No JSON object found in model output');
    return JSON.parse(fenced.slice(start, end + 1));
  }
}
