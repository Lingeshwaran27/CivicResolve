import {
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENTS,
  type Category,
  type Priority,
  type Status,
} from '../domain/catalog.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Issue, PhotoCredit, StatusEvent } from '../domain/types.js';
import { newIssueId } from '../lib/ids.js';

interface SeedSpec {
  code: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  score: number;
  status: Status;
  address: string;
  lat: number;
  lng: number;
  daysAgo: number;
  upvotes: number;
  hazards?: string[];
  reasoning: string;
  language?: string;
  translated?: string;
  notes?: { status: Status; note: string; afterDays: number }[];
  rating?: number;
}

// Realistic demo complaints around Coimbatore (PSG Tech / Peelamedu and nearby areas).
const SPECS: SeedSpec[] = [
  {
    code: 'CR-PSG001',
    title: 'Exposed live wires at streetlight pole near bus stop',
    description:
      'The junction box of the streetlight pole opposite the bus stop is open and wires are hanging out. Students wait here every morning and it sparks when it rains.',
    category: 'Streetlights & Electricity',
    priority: 'critical',
    score: 94,
    status: 'in_progress',
    address: 'Avinashi Road, opp. PSG Tech bus stop, Peelamedu',
    lat: 11.0247,
    lng: 77.0028,
    daysAgo: 1,
    upvotes: 14,
    hazards: ['Electrocution risk', 'Students waiting nearby', 'Worse during rain'],
    reasoning:
      'Exposed live wires at a crowded bus stop pose an immediate risk to life, especially in rain.',
    notes: [
      { status: 'in_progress', note: 'Lineman dispatched; area cordoned off.', afterDays: 0.2 },
    ],
  },
  {
    code: 'CR-PSG002',
    title: 'Deep pothole on Avinashi Road service lane',
    description:
      'Large and deep pothole on the service road near Hope College signal. Two-wheelers are skidding, and it fills with water at night.',
    category: 'Roads & Potholes',
    priority: 'high',
    score: 76,
    status: 'reported',
    address: 'Avinashi Road service lane, Hope College, Peelamedu',
    lat: 11.0262,
    lng: 77.0182,
    daysAgo: 3,
    upvotes: 9,
    hazards: ['Two-wheeler accidents', 'Hidden when waterlogged'],
    reasoning: 'A deep pothole on a busy arterial road causes skids and is hidden when flooded.',
  },
  {
    code: 'CR-PSG003',
    title: 'Overflowing garbage bin near Gandhipuram bus stand',
    description:
      'The community bin near the town bus stand has not been cleared for 4 days. Garbage is spilling onto the road and stray dogs are scattering it.',
    category: 'Garbage & Sanitation',
    priority: 'high',
    score: 68,
    status: 'reported',
    address: 'Cross Cut Road, near Gandhipuram Town Bus Stand',
    lat: 11.0168,
    lng: 76.9674,
    daysAgo: 4,
    upvotes: 6,
    hazards: ['Foul smell and flies', 'Attracts stray dogs'],
    reasoning: 'Uncleared waste in a crowded public area is a sanitation and health risk.',
  },
  {
    code: 'CR-PSG004',
    title: 'Drinking water pipeline leaking for a week',
    description:
      'சாய்பாபா காலனியில் குடிநீர் குழாய் ஒரு வாரமாக கசிந்து கொண்டிருக்கிறது. நிறைய தண்ணீர் வீணாகிறது.',
    category: 'Water Supply & Leakage',
    priority: 'medium',
    score: 55,
    status: 'in_progress',
    address: 'NSR Road, Saibaba Colony',
    lat: 11.0283,
    lng: 76.9446,
    daysAgo: 6,
    upvotes: 4,
    hazards: ['Water wastage', 'Road surface damage'],
    reasoning:
      'A continuous leak wastes drinking water and erodes the road, but there is no immediate danger.',
    language: 'ta',
    translated:
      'The drinking water pipe in Saibaba Colony has been leaking for a week. A lot of water is being wasted.',
    notes: [
      { status: 'in_progress', note: 'Leak located; repair scheduled for Thursday.', afterDays: 2 },
    ],
  },
  {
    code: 'CR-PSG005',
    title: 'Open manhole on Race Course walking track',
    description:
      'Manhole cover is missing on the Race Course walking path. Many elderly people walk here in the early morning when it is still dark.',
    category: 'Drainage & Sewage',
    priority: 'critical',
    score: 90,
    status: 'resolved',
    address: 'Race Course Road walking track',
    lat: 11.0005,
    lng: 76.9787,
    daysAgo: 9,
    upvotes: 11,
    hazards: ['Fall risk', 'Elderly walkers in low light'],
    reasoning:
      'An open manhole on a busy walking track is a serious fall hazard, especially before sunrise.',
    notes: [
      { status: 'in_progress', note: 'Temporary barricade placed.', afterDays: 0.3 },
      { status: 'resolved', note: 'New heavy-duty cover installed.', afterDays: 1 },
    ],
    rating: 5,
  },
  {
    code: 'CR-PSG006',
    title: 'Traffic signal not working at Lakshmi Mills junction',
    description:
      'The traffic signal at Lakshmi Mills junction has been blinking yellow since yesterday evening, causing confusion and near-misses during peak hours.',
    category: 'Traffic & Signals',
    priority: 'high',
    score: 74,
    status: 'resolved',
    address: 'Lakshmi Mills Junction, Avinashi Road',
    lat: 11.013,
    lng: 76.993,
    daysAgo: 12,
    upvotes: 7,
    hazards: ['Collision risk at a busy junction'],
    reasoning:
      'A failed signal at a major junction raises the risk of collisions during peak traffic.',
    notes: [
      { status: 'in_progress', note: 'Controller fault identified.', afterDays: 0.5 },
      { status: 'resolved', note: 'Controller replaced; signal operational.', afterDays: 1.5 },
    ],
    rating: 4,
  },
  {
    code: 'CR-PSG007',
    title: 'Stray dog pack chasing children near school',
    description:
      'A pack of 6-7 stray dogs near the corporation school gate chase children and two-wheelers. One child was bitten last week.',
    category: 'Stray Animals',
    priority: 'high',
    score: 72,
    status: 'reported',
    address: 'Corporation School Road, Ganapathy',
    lat: 11.0391,
    lng: 76.98,
    daysAgo: 2,
    upvotes: 8,
    hazards: ['Dog bites', 'Children at risk'],
    reasoning: 'Aggressive strays near a school with a recent bite incident put children at risk.',
  },
  {
    code: 'CR-PSG008',
    title: 'Streetlights off along Singanallur lake road',
    description:
      'About 8 consecutive streetlights are not working along the lake road. Women returning from work feel unsafe at night.',
    category: 'Streetlights & Electricity',
    priority: 'high',
    score: 66,
    status: 'in_progress',
    address: 'Singanallur Lake Road',
    lat: 10.999,
    lng: 77.03,
    daysAgo: 5,
    upvotes: 10,
    hazards: ['Personal safety at night', 'Poor visibility for vehicles'],
    reasoning: 'A long dark stretch affects pedestrian safety at night and road visibility.',
    notes: [
      {
        status: 'in_progress',
        note: 'Cable fault being traced by the electrical team.',
        afterDays: 1,
      },
    ],
  },
  {
    code: 'CR-PSG009',
    title: 'Mosquito breeding in stagnant water at vacant plot',
    description:
      'Rain water is stagnant in the vacant plot next to the apartments for 2 weeks. Lots of mosquitoes and two dengue cases in our street.',
    category: 'Public Health',
    priority: 'high',
    score: 70,
    status: 'reported',
    address: 'Thudiyalur Road, Saravanampatti',
    lat: 11.078,
    lng: 76.999,
    daysAgo: 1,
    upvotes: 5,
    hazards: ['Dengue transmission'],
    reasoning:
      'Stagnant water with reported dengue cases is a public-health risk needing quick action.',
  },
  {
    code: 'CR-PSG010',
    title: 'Shop extension blocking footpath on DB Road',
    description:
      'Shops have extended their stalls onto the footpath on DB Road. Pedestrians are forced to walk on the road.',
    category: 'Encroachment & Illegal Construction',
    priority: 'medium',
    score: 45,
    status: 'reported',
    address: 'DB Road, RS Puram',
    lat: 11.008,
    lng: 76.952,
    daysAgo: 7,
    upvotes: 3,
    hazards: ['Pedestrians pushed onto the road'],
    reasoning: 'The footpath obstruction is an ongoing inconvenience with moderate safety impact.',
  },
  {
    code: 'CR-PSG011',
    title: 'Broken swings in children’s park',
    description: 'Two swings in the ward park are broken and the slide has sharp edges.',
    category: 'Parks & Public Spaces',
    priority: 'medium',
    score: 42,
    status: 'resolved',
    address: 'Ward Park, Peelamedu Pudur',
    lat: 11.03,
    lng: 77.01,
    daysAgo: 15,
    upvotes: 2,
    hazards: ['Minor injury risk for children'],
    reasoning: 'Damaged play equipment can hurt children but the impact is limited to the park.',
    notes: [
      { status: 'in_progress', note: 'Repair work order raised.', afterDays: 2 },
      { status: 'resolved', note: 'Swings replaced and slide edges smoothed.', afterDays: 5 },
    ],
    rating: 4,
  },
  {
    code: 'CR-PSG012',
    title: 'Faded zebra crossing near Fun Mall',
    description: 'The zebra crossing paint has completely faded near the mall entrance.',
    category: 'Traffic & Signals',
    priority: 'low',
    score: 30,
    status: 'reported',
    address: 'Avinashi Road, near Fun Mall',
    lat: 11.024,
    lng: 77.012,
    daysAgo: 10,
    upvotes: 1,
    reasoning: 'Faded markings reduce pedestrian guidance but are not an immediate hazard.',
  },
  {
    code: 'CR-PSG013',
    title: 'Sewage overflowing into houses at Ukkadam',
    description:
      'Underground drainage is blocked and sewage is entering houses on our street since this morning. Children and elderly are inside.',
    category: 'Drainage & Sewage',
    priority: 'critical',
    score: 88,
    status: 'reported',
    address: 'Ukkadam, near Big Bazaar Street junction',
    lat: 10.9893,
    lng: 76.9615,
    daysAgo: 0.3,
    upvotes: 6,
    hazards: ['Sewage contamination in homes', 'Disease outbreak risk'],
    reasoning: 'Sewage entering homes is an immediate health hazard for vulnerable residents.',
  },
  {
    code: 'CR-PSG014',
    title: 'Plastic waste being burnt near Town Hall',
    description:
      'Every evening someone burns plastic waste behind the market. The smoke is thick and smells toxic.',
    category: 'Noise & Pollution',
    priority: 'medium',
    score: 50,
    status: 'rejected',
    address: 'Town Hall market backside',
    lat: 10.9946,
    lng: 76.9617,
    daysAgo: 8,
    upvotes: 2,
    hazards: ['Toxic smoke'],
    reasoning: 'Burning plastic causes local air pollution and health discomfort.',
    notes: [
      {
        status: 'rejected',
        note: 'Duplicate of an existing complaint handled by the pollution control team.',
        afterDays: 1,
      },
    ],
  },
  {
    code: 'CR-PSG015',
    title: 'Garbage heap blocking lane near Peelamedu market',
    description:
      'Shops dump waste at the corner of the market lane every night. Cattle and dogs scatter it across the road and the smell is unbearable.',
    category: 'Garbage & Sanitation',
    priority: 'high',
    score: 67,
    status: 'resolved',
    address: 'Market lane, Peelamedu, Coimbatore',
    lat: 11.0275,
    lng: 77.0057,
    daysAgo: 6,
    upvotes: 12,
    hazards: ['Disease vectors', 'Lane blocked for pedestrians'],
    reasoning: 'A recurring waste heap in a busy market lane is a sanitation and health risk.',
    notes: [
      { status: 'in_progress', note: 'Sanitation crew assigned; shops warned.', afterDays: 0.4 },
      {
        status: 'resolved',
        note: 'Heap cleared by collection van; twice-daily pickup scheduled for the lane.',
        afterDays: 1.1,
      },
    ],
    rating: 5,
  },
];

/**
 * Openly licensed photos (Wikimedia Commons) used to illustrate the sample complaints.
 * Files and attribution live in server/assets/demo (see credits.json).
 */
const SEED_PHOTOS: Record<string, { report?: string; resolution?: string; note?: string }> = {
  'CR-PSG002': { report: 'psg002-pothole' },
  'CR-PSG003': { report: 'psg003-garbage' },
  'CR-PSG004': { report: 'psg004-leak' },
  'CR-PSG005': {
    report: 'psg005-before',
    resolution: 'psg005-after',
    note: 'Heavy-duty cover installed and the opening sealed.',
  },
  'CR-PSG006': {
    resolution: 'psg006-after',
    note: 'Signal controller replaced; junction operating normally.',
  },
  'CR-PSG007': { report: 'psg007-dogs' },
  'CR-PSG008': { report: 'psg008-streetlight' },
  'CR-PSG009': { report: 'psg009-stagnant' },
  'CR-PSG011': {
    report: 'psg011-before',
    resolution: 'psg011-after',
    note: 'Play equipment repaired; park reopened for children.',
  },
  'CR-PSG012': { report: 'psg012-road' },
  'CR-PSG013': { report: 'psg013-flood' },
  'CR-PSG015': {
    report: 'psg015-before',
    resolution: 'psg015-after',
    note: 'Lane cleared by the collection van; regular pickup scheduled.',
  },
};

interface CreditEntry {
  author: string;
  license: string;
  source: string;
}

const ASSET_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/demo');

function readCredits(): Record<string, CreditEntry> {
  try {
    return JSON.parse(readFileSync(path.join(ASSET_DIR, 'credits.json'), 'utf8')) as Record<
      string,
      CreditEntry
    >;
  } catch {
    return {};
  }
}

const credit = (c: CreditEntry | undefined): PhotoCredit | null =>
  c ? { author: c.author, license: c.license, source: c.source } : null;

/** Load demo photos for seeded issues as data URLs, keyed `${kind}:${issueId}`. Missing files are skipped. */
export function loadSeedImages(issues: readonly Issue[]): Map<string, string> {
  const images = new Map<string, string>();
  for (const issue of issues) {
    const photos = SEED_PHOTOS[issue.code];
    if (!photos) continue;
    for (const kind of ['report', 'resolution'] as const) {
      const name = photos[kind];
      if (!name) continue;
      const file = path.join(ASSET_DIR, `${name}.jpg`);
      if (!existsSync(file)) continue;
      const base64 = readFileSync(file).toString('base64');
      images.set(`${kind}:${issue.id}`, `data:image/jpeg;base64,${base64}`);
    }
  }
  return images;
}

const DAY_MS = 86_400_000;

export function buildSeedIssues(now = Date.now()): Issue[] {
  const credits = readCredits();
  return SPECS.map((s) => {
    const photos = SEED_PHOTOS[s.code];
    const created = now - s.daysAgo * DAY_MS;
    const department = CATEGORY_TO_DEPARTMENT[s.category];
    const history: StatusEvent[] = [
      {
        status: 'reported',
        note: 'Complaint submitted by citizen.',
        at: new Date(created).toISOString(),
        by: 'citizen',
      },
      ...(s.notes ?? []).map((n) => ({
        status: n.status,
        note: n.note,
        at: new Date(created + n.afterDays * DAY_MS).toISOString(),
        by: 'admin' as const,
      })),
    ];
    const last = history[history.length - 1]!;
    return {
      id: newIssueId(),
      code: s.code,
      title: s.title,
      description: s.description,
      category: s.category,
      department,
      priority: s.priority,
      status: s.status,
      location: { address: s.address, lat: s.lat, lng: s.lng },
      ai: {
        category: s.category,
        priority: s.priority,
        impactScore: s.score,
        department,
        suggestedTitle: s.title,
        summary: s.translated ?? s.description,
        reasoning: s.reasoning,
        hazards: s.hazards ?? [],
        language: s.language ?? 'en',
        translatedDescription: s.translated ?? null,
        estimatedResolutionDays: DEPARTMENTS[department].slaDays[s.priority],
        confidence: 0.9,
        provider: 'seed',
        model: 'demo-data',
      },
      overrides: { category: false, priority: false, department: false },
      hasImage: Boolean(photos?.report),
      photoCredit: photos?.report ? credit(credits[photos.report]) : null,
      resolution: photos?.resolution
        ? { photo: true, note: photos.note ?? '', credit: credit(credits[photos.resolution]) }
        : null,
      sample: true,
      upvotes: s.upvotes,
      voterHashes: [],
      history,
      reporter: null,
      rating: s.rating
        ? { score: s.rating, comment: 'Quick response, thank you!', at: last.at }
        : null,
      createdAt: new Date(created).toISOString(),
      updatedAt: last.at,
      resolvedAt: s.status === 'resolved' ? last.at : null,
    };
  });
}
