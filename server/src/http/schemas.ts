import { z } from 'zod';
import { CATEGORIES, DEPARTMENT_IDS, PRIORITIES, STATUSES } from '../domain/catalog.js';
import type { ImageInput } from '../services/ai/provider.js';

/** Max base64 payload (~650 KB binary) — also keeps the Firestore document under its 1 MiB limit. */
export const MAX_IMAGE_BASE64_CHARS = 900_000;
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Strip control characters (keeps newlines/tabs) and trim. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point here
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const cleanText = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(CONTROL_CHARS, '').trim())
    .pipe(z.string().min(min).max(max));

const imageDataUrl = z
  .string()
  .max(MAX_IMAGE_BASE64_CHARS + 40, 'Image is too large (max ~650 KB after compression)')
  .regex(DATA_URL_RE, 'Image must be a JPEG, PNG or WebP data URL');

export const LocationSchema = z.object({
  address: cleanText(3, 200),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

export const AnalyzeBodySchema = z.object({
  title: cleanText(0, 120).optional(),
  description: cleanText(10, 2000),
  location: LocationSchema.partial({ address: true }).optional(),
  image: imageDataUrl.optional(),
});

export const CreateIssueBodySchema = z.object({
  title: cleanText(5, 120),
  description: cleanText(10, 2000),
  /** Citizen's chosen category; omit to accept the AI's classification. */
  category: z.enum(CATEGORIES).optional(),
  location: LocationSchema,
  image: imageDataUrl.optional(),
  reporterName: cleanText(0, 80).optional(),
  reporterContact: cleanText(0, 120).optional(),
});

export const ListQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  department: z.enum(DEPARTMENT_IDS).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'priority', 'upvotes']).default('newest'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const CodeParamSchema = z.object({
  code: z.string().regex(/^CR-[A-Z0-9]{6}$/, 'Invalid tracking code'),
});

export const IdParamSchema = z.object({ id: z.string().min(1).max(64) });

export const RatingBodySchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: cleanText(0, 500).optional(),
});

export const LoginBodySchema = z.object({ password: z.string().min(1).max(200) });

export const AdminUpdateBodySchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    department: z.enum(DEPARTMENT_IDS).optional(),
    category: z.enum(CATEGORIES).optional(),
    note: cleanText(0, 500).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined && v !== ''), {
    message: 'Provide at least one field to update',
  });

export function parseImageDataUrl(dataUrl: string): ImageInput {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw new Error('Invalid image data URL');
  return { mimeType: match[1] as ImageInput['mimeType'], base64: match[2] };
}
