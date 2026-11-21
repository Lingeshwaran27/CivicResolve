import { isOpen, type Category } from '../domain/catalog.js';
import type { Issue } from '../domain/types.js';

const EARTH_RADIUS_M = 6_371_000;
const NEARBY_RADIUS_M = 400;

const STOP_WORDS = new Set(
  'a an the is are was were be been on in at of to for and or with near from this that there here it its my our very please has have had not no'.split(
    ' ',
  ),
);

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export interface DuplicateCandidateInput {
  text: string;
  category?: Category | null;
  lat?: number | null;
  lng?: number | null;
}

export interface DuplicateMatch {
  issue: Issue;
  score: number;
  distanceMeters: number | null;
}

/**
 * Find open issues that probably describe the same problem.
 * Runs locally (no LLM call) so it costs nothing against the AI quota.
 */
export function findDuplicates(
  input: DuplicateCandidateInput,
  issues: readonly Issue[],
  limit = 3,
): DuplicateMatch[] {
  const tokens = tokenize(input.text);
  const hasCoords = typeof input.lat === 'number' && typeof input.lng === 'number';
  const matches: DuplicateMatch[] = [];

  for (const issue of issues) {
    if (!isOpen(issue.status)) continue;
    const textSim = jaccard(tokens, tokenize(`${issue.title} ${issue.description}`));
    const sameCategory = input.category ? input.category === issue.category : false;

    let distance: number | null = null;
    let geoScore = 0;
    if (hasCoords && issue.location.lat !== null && issue.location.lng !== null) {
      distance = haversineMeters(input.lat!, input.lng!, issue.location.lat, issue.location.lng);
      if (distance > NEARBY_RADIUS_M) continue;
      geoScore = 1 - distance / NEARBY_RADIUS_M;
    }

    const score = hasCoords
      ? 0.45 * geoScore + 0.3 * Math.min(textSim * 2.5, 1) + 0.25 * (sameCategory ? 1 : 0)
      : 0.7 * Math.min(textSim * 2, 1) + 0.3 * (sameCategory ? 1 : 0);

    if (score >= 0.5)
      matches.push({
        issue,
        score: Number(score.toFixed(2)),
        distanceMeters: distance === null ? null : Math.round(distance),
      });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
