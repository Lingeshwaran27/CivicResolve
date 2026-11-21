import { createElement } from 'react';
import {
  Building2,
  CircleHelp,
  Construction,
  Droplets,
  HeartPulse,
  Lightbulb,
  PawPrint,
  TrafficCone,
  Trash2,
  Trees,
  Volume2,
  Waves,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'Roads & Potholes': Construction,
  'Garbage & Sanitation': Trash2,
  'Streetlights & Electricity': Lightbulb,
  'Water Supply & Leakage': Droplets,
  'Drainage & Sewage': Waves,
  'Traffic & Signals': TrafficCone,
  'Parks & Public Spaces': Trees,
  'Stray Animals': PawPrint,
  'Public Health': HeartPulse,
  'Encroachment & Illegal Construction': Building2,
  'Noise & Pollution': Volume2,
};

export function categoryIcon(category: string): LucideIcon {
  return ICONS[category] ?? CircleHelp;
}

/** Category glyph in a tinted tile. Decorative — the category name is always shown as text. */
export function CategoryIcon({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' }) {
  // Icons are static module-level components; createElement picks one without redefining it.
  return (
    <span className={`icon-tile${size === 'sm' ? ' sm' : ''}`} aria-hidden="true">
      {createElement(categoryIcon(category), { size: size === 'sm' ? 16 : 19, strokeWidth: 2 })}
    </span>
  );
}
