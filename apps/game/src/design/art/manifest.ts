import { PREMIUM_ASSETS, type AssetKey } from './premium-index';
import { PREMADE_MANAGERS, type ManagerAppearance } from '@cf/engine';

export { type AssetKey };
export type AssetCrop = 'hero' | 'card' | 'thumb';

/** All production art paths are owned here. Missing keys use code-native art. */
export function assetFor(key: string, crop: AssetCrop = 'card'): string | undefined {
  if (key === 'character.member-kai-arden') return `/art/membership/superstar-${crop === 'thumb' ? 'thumb' : 'hero'}.webp`;
  const asset = PREMIUM_ASSETS[key as AssetKey];
  return asset?.variants[crop].src;
}

export const art = {
  office: 'environment.office',
  manager: 'manager.neutral',
  tactics: 'object.tactics-tablet',
  training: 'object.training-cones',
  scouting: 'object.scout-binoculars',
} as const satisfies Record<string, AssetKey>;

export const FACILITY_ART = {
  facility_stadium: 'environment.stadium-day',
  facility_training_centre: 'environment.training-ground',
  facility_medical: 'environment.medical',
  facility_recovery: 'environment.medical',
  facility_academy: 'environment.academy',
  facility_scouting: 'environment.scouting-office',
  facility_analytics: 'environment.tactics-room',
  facility_media_dept: 'environment.media-studio',
  facility_creator_studio: 'environment.media-studio',
  facility_merchandising: 'environment.fan-zone',
  facility_fan_zone: 'environment.fan-zone',
} as const;
export function facilityArt(type: string, level = 1): string {
  const scene = FACILITY_ART[type as keyof typeof FACILITY_ART] ?? 'environment.stadium-day';
  return level >= 4 && assetFor(`${scene}-elite`) ? `${scene}-elite` : scene;
}

export function storyArt(eventType: string): string {
  const type = eventType.toUpperCase();
  if (/TRANSFER|SIGN|CONTRACT/.test(type)) return 'story.transfer';
  if (/INJUR|MEDICAL/.test(type)) return 'story.injury';
  if (/TRAIN|DEVELOP/.test(type)) return 'story.training';
  if (/SPONSOR|FINANCE/.test(type)) return 'story.sponsorship';
  if (/FAN|COMMUNITY/.test(type)) return 'story.fans';
  if (/PRESS|MEDIA|CONTROVERS/.test(type)) return 'story.press';
  if (/DEFEAT|LOSS/.test(type)) return 'story.defeat';
  if (/WIN|VICTORY/.test(type)) return 'story.victory';
  if (/CREATOR|STREAM/.test(type)) return 'story.creator';
  if (/RIVAL/.test(type)) return 'story.rivalry';
  return 'story.matchday';
}

/** Stable visual families. These are illustrations, not inventory or effects. */
export const OBJECT_ART = {
  tactics:{standard:'object.tactics-tablet',elite:'object.magnetic-board'},
  training:{standard:'object.training-cones',elite:'object.hurdles'},
  scouting:{standard:'object.report-folder',elite:'object.scout-binoculars'},
  boots:{standard:'object.boots-training',elite:'object.boots-elite'},
  football:{standard:'object.football-training',elite:'object.football-elite'},
  medical:{standard:'object.medical-bag',elite:'object.treatment-table'},
  creator:{standard:'object.creator-camera',elite:'object.streaming-desk'},
} as const satisfies Record<string,Record<string,AssetKey>>;

export const PROGRAMME_ART = {
  ATTACK:'object.football-training',DEFENCE:'object.mannequin-wall',FITNESS:'object.hurdles',
  TECHNICAL:'object.training-cones',TACTICAL:'object.magnetic-board',RECOVERY:'environment.medical',YOUTH:'environment.academy',
} as const satisfies Record<string,AssetKey>;

/** Prepared atmosphere library; no weather simulation is claimed by the UI. */
export const STADIUM_AMBIENCE = {
  day:{clear:'ambience.day-clear',rain:'ambience.day-rain',snow:'ambience.day-snow'},
  night:{clear:'ambience.night-clear',rain:'ambience.night-rain',fog:'ambience.night-fog'},
  dusk:{overcast:'ambience.dusk-overcast'},dawn:{clear:'ambience.dawn-clear'},
} as const satisfies Record<string,Record<string,AssetKey>>;
export function stadiumAmbience(time:string,weather:string): string {
  const times:Readonly<Record<string,Readonly<Record<string,string>>>>=STADIUM_AMBIENCE;
  return times[time]?.[weather] ?? 'ambience.night-clear';
}

/** Exact authored appearance match: custom choices keep their vector portrait. */
export function managerAssetFor(appearance: ManagerAppearance): string | undefined {
  const match = PREMADE_MANAGERS.find(manager => manager.appearance &&
    (['skinTone','hairStyle','hairColor','facialHair','outfit','accessory','accentColor'] as const).every(field => manager.appearance?.[field] === appearance[field]));
  if (match) return `manager.${match.id.split('_')[1]}-neutral`;
  if (appearance.skinTone === 3 && appearance.hairStyle === 'waves' && appearance.hairColor === '#2e2119' && appearance.facialHair === 'beard' && appearance.outfit === 'training_kit' && appearance.accessory === 'none') return 'manager.neutral';
  return undefined;
}
