import {
  CATEGORIES,
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENTS,
  PRIORITY_BANDS,
  priorityFromScore,
  type Category,
} from '../../domain/catalog.js';
import type { AiAnalysis } from '../../domain/types.js';

/**
 * Deterministic, offline classifier used when no LLM is configured or all LLMs are
 * rate-limited. It keeps the product usable (and the tests hermetic) — the UI clearly
 * labels results from this engine as "rule-based" so citizens and admins know.
 * Includes common Tamil and Hindi keywords for local reporting.
 */
const KEYWORDS: Readonly<Record<Exclude<Category, 'Other'>, readonly string[]>> = {
  'Roads & Potholes': [
    'pothole',
    'road',
    'crack',
    'tar',
    'asphalt',
    'footpath',
    'pavement',
    'speed breaker',
    'bridge',
    'குழி',
    'சாலை',
    'रोड',
    'सड़क',
    'गड्ढा',
  ],
  'Garbage & Sanitation': [
    'garbage',
    'trash',
    'waste',
    'bin',
    'dump',
    'litter',
    'rubbish',
    'debris',
    'smell',
    'stink',
    'குப்பை',
    'कचरा',
    'कूड़ा',
  ],
  'Streetlights & Electricity': [
    'streetlight',
    'street light',
    'lamp',
    'light',
    'electric',
    'wire',
    'transformer',
    'pole',
    'power',
    'current',
    'spark',
    'விளக்கு',
    'மின்',
    'बिजली',
    'लाइट',
  ],
  'Water Supply & Leakage': [
    'water',
    'leak',
    'pipe',
    'pipeline',
    'tap',
    'supply',
    'burst',
    'contaminated',
    'drinking',
    'தண்ணீர்',
    'குடிநீர்',
    'पानी',
    'पाइप',
  ],
  'Drainage & Sewage': [
    'drain',
    'drainage',
    'sewage',
    'sewer',
    'manhole',
    'gutter',
    'overflow',
    'waterlogging',
    'clog',
    'flood',
    'சாக்கடை',
    'வடிகால்',
    'नाली',
    'सीवर',
  ],
  'Traffic & Signals': [
    'traffic',
    'signal',
    'junction',
    'signboard',
    'zebra',
    'crossing',
    'parking',
    'jam',
    'சிக்னல்',
    'போக்குவரத்து',
    'ट्रैफिक',
  ],
  'Parks & Public Spaces': [
    'park',
    'playground',
    'tree',
    'garden',
    'bench',
    'branch',
    'public toilet',
    'பூங்கா',
    'மரம்',
    'पार्क',
    'पेड़',
  ],
  'Stray Animals': [
    'dog',
    'stray',
    'cattle',
    'cow',
    'animal',
    'monkey',
    'bite',
    'carcass',
    'நாய்',
    'மாடு',
    'कुत्ता',
    'जानवर',
  ],
  'Public Health': [
    'mosquito',
    'dengue',
    'malaria',
    'disease',
    'health',
    'stagnant',
    'infection',
    'rats',
    'கொசு',
    'मच्छर',
  ],
  'Encroachment & Illegal Construction': [
    'encroach',
    'illegal',
    'construction',
    'unauthorised',
    'unauthorized',
    'building',
    'shop extension',
    'ஆக்கிரமிப்பு',
    'अतिक्रमण',
  ],
  'Noise & Pollution': [
    'noise',
    'loud',
    'pollution',
    'smoke',
    'burning',
    'dust',
    'air quality',
    'speaker',
    'புகை',
    'शोर',
    'धुआं',
  ],
};

const CRITICAL_SIGNALS = [
  'electrocut',
  'live wire',
  'தீப்பொறி',
  'கம்பி',
  'மின்சாரம் தாக்',
  'exposed wire',
  'sparking',
  'spark',
  'open manhole',
  'collapsed',
  'collapse',
  'fire',
  'accident',
  'injured',
  'death',
  'died',
  'flooding',
  'flooded',
  'burst',
  'fallen tree',
  'gas leak',
  'dangerous',
  'emergency',
  'உயிர்',
  'ஆபத்து',
  'खतरा',
];
const HIGH_SIGNALS = [
  'school',
  'hospital',
  'children',
  'kids',
  'elderly',
  'main road',
  'highway',
  'busy',
  'night',
  'dark',
  'days',
  'week',
  'weeks',
  'sewage',
  'contaminated',
  'bite',
  'many',
  'huge',
  'large',
  'deep',
  'pregnant',
  'பள்ளி',
  'மருத்துவமனை',
  'स्कूल',
  'अस्पताल',
];
const LOW_SIGNALS = ['minor', 'small', 'slightly', 'cosmetic', 'paint', 'faded', 'suggestion'];

function countHits(text: string, words: readonly string[]): number {
  return words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
}

function detectLanguage(text: string): string {
  if (/[஀-௿]/.test(text)) return 'ta';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[ఀ-౿]/.test(text)) return 'te';
  if (/[ഀ-ൿ]/.test(text)) return 'ml';
  if (/[ಀ-೿]/.test(text)) return 'kn';
  return 'en';
}

export function heuristicAnalysis(input: { title?: string; description: string }): AiAnalysis {
  const raw = `${input.title ?? ''} ${input.description}`.trim();
  const text = raw.toLowerCase();

  let best: Category = 'Other';
  let bestHits = 0;
  for (const category of CATEGORIES) {
    if (category === 'Other') continue;
    const hits = countHits(text, KEYWORDS[category]);
    if (hits > bestHits) {
      best = category;
      bestHits = hits;
    }
  }

  const critical = countHits(text, CRITICAL_SIGNALS);
  const high = countHits(text, HIGH_SIGNALS);
  const low = countHits(text, LOW_SIGNALS);
  const score = Math.max(
    5,
    Math.min(98, 40 + critical * 25 + high * 8 - low * 12 + (best === 'Other' ? -5 : 0)),
  );
  const priority = priorityFromScore(score);
  const department = CATEGORY_TO_DEPARTMENT[best];
  const firstSentence = (input.title?.trim() || raw.split(/[.!?\n]/)[0] || raw).slice(0, 80);
  const [lo] = PRIORITY_BANDS[priority];
  const hazards = critical > 0 ? ['Possible risk to public safety'] : [];

  return {
    category: best,
    priority,
    impactScore: Math.max(score, lo),
    department,
    suggestedTitle: firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1),
    summary: raw.slice(0, 280),
    reasoning:
      bestHits > 0
        ? `Matched ${best.toLowerCase()} keywords; ${critical > 0 ? 'safety-related words raised the urgency' : high > 0 ? 'impact-related words raised the urgency' : 'no strong urgency signals found'}. Routed to ${DEPARTMENTS[department].name}.`
        : 'Could not confidently match a category; routed to the grievance cell for manual review.',
    hazards,
    language: detectLanguage(raw),
    translatedDescription: null,
    estimatedResolutionDays: DEPARTMENTS[department].slaDays[priority],
    confidence: bestHits > 1 ? 0.55 : bestHits === 1 ? 0.4 : 0.2,
    provider: 'heuristic',
    model: 'rules-v1',
  };
}
