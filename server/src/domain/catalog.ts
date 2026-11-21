/**
 * Static civic catalog: issue categories, municipal departments, priorities and statuses.
 * Kept as `as const` tuples so they double as zod enums and TypeScript unions.
 */

export const CATEGORIES = [
  'Roads & Potholes',
  'Garbage & Sanitation',
  'Streetlights & Electricity',
  'Water Supply & Leakage',
  'Drainage & Sewage',
  'Traffic & Signals',
  'Parks & Public Spaces',
  'Stray Animals',
  'Public Health',
  'Encroachment & Illegal Construction',
  'Noise & Pollution',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['reported', 'in_progress', 'resolved', 'rejected'] as const;
export type Status = (typeof STATUSES)[number];

export interface Department {
  id: DepartmentId;
  name: string;
  description: string;
  /** Target resolution time in days, per priority (service-level agreement). */
  slaDays: Record<Priority, number>;
}

export const DEPARTMENT_IDS = [
  'public_works',
  'solid_waste',
  'electricity',
  'water_supply',
  'drainage',
  'traffic',
  'parks',
  'animal_welfare',
  'public_health',
  'town_planning',
  'pollution_control',
  'grievance_cell',
] as const;
export type DepartmentId = (typeof DEPARTMENT_IDS)[number];

export const DEPARTMENTS: Readonly<Record<DepartmentId, Department>> = {
  public_works: {
    id: 'public_works',
    name: 'Public Works Department (Roads)',
    description: 'Roads, potholes, footpaths, bridges and road damage.',
    slaDays: { critical: 1, high: 3, medium: 7, low: 14 },
  },
  solid_waste: {
    id: 'solid_waste',
    name: 'Solid Waste Management',
    description: 'Garbage collection, overflowing bins, littering and street cleaning.',
    slaDays: { critical: 1, high: 1, medium: 3, low: 7 },
  },
  electricity: {
    id: 'electricity',
    name: 'Electricity & Street Lighting',
    description: 'Streetlights, exposed wires, transformers and electrical hazards.',
    slaDays: { critical: 1, high: 2, medium: 5, low: 10 },
  },
  water_supply: {
    id: 'water_supply',
    name: 'Water Supply Board',
    description: 'Pipeline leaks, bursts, contaminated or no water supply.',
    slaDays: { critical: 1, high: 2, medium: 5, low: 10 },
  },
  drainage: {
    id: 'drainage',
    name: 'Drainage & Sewerage',
    description: 'Blocked drains, sewage overflow, open manholes and waterlogging.',
    slaDays: { critical: 1, high: 2, medium: 5, low: 10 },
  },
  traffic: {
    id: 'traffic',
    name: 'Traffic & Road Safety',
    description: 'Traffic signals, signage, road markings and dangerous junctions.',
    slaDays: { critical: 1, high: 2, medium: 5, low: 14 },
  },
  parks: {
    id: 'parks',
    name: 'Parks & Horticulture',
    description: 'Parks, playgrounds, fallen trees and public open spaces.',
    slaDays: { critical: 1, high: 3, medium: 7, low: 21 },
  },
  animal_welfare: {
    id: 'animal_welfare',
    name: 'Animal Welfare & Veterinary Services',
    description: 'Stray or injured animals, dog bites and animal carcasses.',
    slaDays: { critical: 1, high: 2, medium: 5, low: 14 },
  },
  public_health: {
    id: 'public_health',
    name: 'Public Health Department',
    description: 'Mosquito breeding, disease outbreaks, food safety and sanitation hazards.',
    slaDays: { critical: 1, high: 2, medium: 5, low: 10 },
  },
  town_planning: {
    id: 'town_planning',
    name: 'Town Planning',
    description: 'Encroachments, illegal construction and unsafe buildings.',
    slaDays: { critical: 2, high: 7, medium: 14, low: 30 },
  },
  pollution_control: {
    id: 'pollution_control',
    name: 'Pollution Control',
    description: 'Noise, air pollution, burning waste and industrial discharge.',
    slaDays: { critical: 1, high: 3, medium: 7, low: 14 },
  },
  grievance_cell: {
    id: 'grievance_cell',
    name: 'Citizen Grievance Cell',
    description: 'General grievances that need manual routing.',
    slaDays: { critical: 2, high: 5, medium: 10, low: 20 },
  },
};

/** Default routing used when AI is unavailable or returns an unknown department. */
export const CATEGORY_TO_DEPARTMENT: Readonly<Record<Category, DepartmentId>> = {
  'Roads & Potholes': 'public_works',
  'Garbage & Sanitation': 'solid_waste',
  'Streetlights & Electricity': 'electricity',
  'Water Supply & Leakage': 'water_supply',
  'Drainage & Sewage': 'drainage',
  'Traffic & Signals': 'traffic',
  'Parks & Public Spaces': 'parks',
  'Stray Animals': 'animal_welfare',
  'Public Health': 'public_health',
  'Encroachment & Illegal Construction': 'town_planning',
  'Noise & Pollution': 'pollution_control',
  Other: 'grievance_cell',
};

/** Impact-score bands that correspond to each priority. */
export const PRIORITY_BANDS: Readonly<Record<Priority, readonly [number, number]>> = {
  critical: [80, 100],
  high: [60, 79],
  medium: [35, 59],
  low: [0, 34],
};

export function priorityFromScore(score: number): Priority {
  if (score >= PRIORITY_BANDS.critical[0]) return 'critical';
  if (score >= PRIORITY_BANDS.high[0]) return 'high';
  if (score >= PRIORITY_BANDS.medium[0]) return 'medium';
  return 'low';
}

/** Allowed status transitions (admin workflow). */
const TRANSITIONS: Readonly<Record<Status, readonly Status[]>> = {
  reported: ['in_progress', 'resolved', 'rejected'],
  in_progress: ['resolved', 'rejected', 'reported'],
  resolved: ['in_progress'],
  rejected: ['reported'],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isOpen(status: Status): boolean {
  return status === 'reported' || status === 'in_progress';
}
