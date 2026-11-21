import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { CatalogProvider } from '../hooks/useCatalog';
import type { AiAnalysis, Catalog, Issue } from '../lib/types';

export const catalog: Catalog = {
  categories: ['Roads & Potholes', 'Garbage & Sanitation', 'Drainage & Sewage', 'Other'],
  priorities: ['critical', 'high', 'medium', 'low'],
  statuses: ['reported', 'in_progress', 'resolved', 'rejected'],
  departments: [
    {
      id: 'public_works',
      name: 'Public Works Department (Roads)',
      description: '',
      slaDays: { critical: 1, high: 3, medium: 7, low: 14 },
    },
    {
      id: 'drainage',
      name: 'Drainage & Sewerage',
      description: '',
      slaDays: { critical: 1, high: 2, medium: 5, low: 10 },
    },
  ],
};

export const analysis: AiAnalysis = {
  category: 'Roads & Potholes',
  priority: 'high',
  impactScore: 74,
  department: 'public_works',
  suggestedTitle: 'Deep pothole near bus stop',
  summary: 'Deep pothole on a busy road.',
  reasoning: 'Busy road with two-wheelers; high accident risk.',
  hazards: ['Two-wheeler skids'],
  language: 'ta',
  translatedDescription: 'There is a deep pothole near the bus stop.',
  estimatedResolutionDays: 3,
  confidence: 0.88,
  provider: 'gemini',
  model: 'gemini-2.5-flash',
};

export const issue: Issue = {
  id: 'id-1',
  code: 'CR-ABC234',
  title: 'Deep pothole near bus stop',
  description: 'There is a deep pothole near the bus stop.',
  category: 'Roads & Potholes',
  department: 'public_works',
  priority: 'high',
  status: 'reported',
  location: { address: 'Avinashi Road', lat: null, lng: null },
  ai: analysis,
  overrides: { category: false, priority: false, department: false },
  hasImage: false,
  upvotes: 3,
  history: [
    {
      status: 'reported',
      note: 'Complaint received.',
      at: '2026-11-20T10:00:00.000Z',
      by: 'system',
    },
  ],
  rating: null,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  resolvedAt: null,
  effectiveScore: 80,
  slaDueAt: '2026-11-23T10:00:00.000Z',
  overdue: false,
};

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CatalogProvider initial={catalog}>{ui}</CatalogProvider>
    </MemoryRouter>,
  );
}

/** Route-aware fetch mock: `routes` maps "METHOD /api/path" prefixes to JSON bodies. */
export function mockFetch(routes: Record<string, unknown | ((body: unknown) => unknown)>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = Object.keys(routes).find((k) => {
      const [m, p] = k.split(' ');
      return m === method && url.startsWith(p!);
    });
    if (!key) return new Response(JSON.stringify({ error: 'not mocked' }), { status: 404 });
    const value = routes[key];
    const body =
      typeof value === 'function'
        ? value(init?.body ? JSON.parse(String(init.body)) : undefined)
        : value;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Run axe-core accessibility checks (colour contrast can't be computed in jsdom). */
export async function axeViolations(container: Element) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}
