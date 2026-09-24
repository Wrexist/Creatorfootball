export const MODEL_ASSETS = {
  campus: { src: '/models/campus.glb', fallback: 'environment.stadium-day', label: 'Club campus' },
  trophy: { src: '/models/trophy.glb', fallback: 'trophy.league', label: 'Trophy design' },
  football: { src: '/models/football.glb', fallback: 'object.football-elite', label: 'Match ball' },
  'kit-classic': { src: '/models/kit-classic.glb', fallback: 'kit.home', label: 'Classic kit' },
  'kit-sash': { src: '/models/kit-sash.glb', fallback: 'kit.home', label: 'Sash kit' },
  'kit-hoops': { src: '/models/kit-hoops.glb', fallback: 'kit.home', label: 'Hooped kit' },
  'kit-pinstripe': { src: '/models/kit-pinstripe.glb', fallback: 'kit.home', label: 'Pinstripe kit' },
} as const;
export type ModelId = keyof typeof MODEL_ASSETS;
export const LIGHTING = {
  aurora: { name: 'Aurora', background: '#112c2c', key: '#b5ffee', fill: '#83a2d2', intensity: 3.3 },
  copper: { name: 'Copper dusk', background: '#302122', key: '#ffd0a4', fill: '#b290af', intensity: 3.2 },
  daylight: { name: 'Daylight', background: '#182829', key: '#fff1d9', fill: '#a8c6c9', intensity: 3.1 },
  floodlit: { name: 'Floodlit', background: '#111c2b', key: '#d0e4ff', fill: '#7c95b5', intensity: 3.6 },
  sunset: { name: 'Sunset', background: '#2d272b', key: '#ffc990', fill: '#9b9abd', intensity: 3.3 },
  creator: { name: 'Creator night', background: '#201d35', key: '#cbb0ff', fill: '#adcba4', intensity: 3.1 },
} as const;
export type LightingId = keyof typeof LIGHTING;
export const CAMPUS_PREVIEWS = {
  start: { name: 'Start', title: 'Local roots', level: 0, description: 'A first stand. A familiar pitch. Somewhere to belong.', levels: { facility_stadium:0, facility_training_centre:0, facility_medical:0, facility_academy:0, facility_creator_studio:0 } },
  mid: { name: 'Mid-game', title: 'A club on the rise', level: 3, description: 'Covered stands, a broadcast tunnel and a growing training campus.', levels: { facility_stadium:3, facility_training_centre:3, facility_medical:2, facility_academy:2, facility_creator_studio:1 } },
  end: { name: 'End-game', title: 'Built for a legacy', level: 5, description: 'A sweeping canopy, two tiers and a complete football campus.', levels: { facility_stadium:5, facility_training_centre:5, facility_medical:5, facility_academy:5, facility_creator_studio:5 } },
} as const;
export type CampusPreviewId = keyof typeof CAMPUS_PREVIEWS;
const completedLevel = (levels: Readonly<Record<string, number>>, key: string): number => {
  const level=levels[key] ?? 0;
  return Number.isFinite(level) ? Math.max(0,Math.min(5,Math.floor(level))) : 0;
};
export function facilityVisible(name: string, levels: Readonly<Record<string, number>>): boolean {
  const stage = /^(facility_.+)_stage_(\d+)_(\d+)$/.exec(name);
  if(stage) {
    const level=completedLevel(levels,stage[1]!);
    return level>=Number(stage[2]) && level<=Number(stage[3]);
  }
  const match = /^(facility_.+)_(\d+)$/.exec(name);
  if (!match) return true;
  const level = completedLevel(levels,match[1]!);
  // The base stand belongs to the stadium even before its first upgrade.
  return Number(match[2]) <= (match[1] === 'facility_stadium' ? Math.max(1, level) : level);
}
