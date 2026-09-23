import type { ClubVisualIdentity } from '@cf/engine';

/** Exact authored palettes preserve custom club choices and their SVG fallback. */
const CRESTS = [
  ['club_larkspur_wolves','larkspur','#4A5568','#F2A413','HEX','WOLF'],
  ['club_verrow_wanderers','verrow','#1B2445','#B9C2CE','CREST','COMPASS'],
  ['club_marrowgate_athletic','marrowgate','#123B2E','#C9A227','CREST','LION'],
  ['club_neon_row_fc','neon-row','#0B0B10','#FF2FA0','HEX','BOLT'],
  ['club_vantage_point_fc','vantage','#F7F9FC','#1E4FE0','DIAMOND','STAR'],
  ['club_aurelia_sc','aurelia','#F3ECE0','#6E2F6B','CREST','CROWN'],
  ['club_ironhollow_forge','ironhollow','#2E3238','#E2570F','SHIELD','HAMMER'],
  ['club_duskford_rovers','duskford','#6B1A34','#8FCBEF','SHIELD','TOWER'],
  ['club_saltpine_harbour','saltpine','#1D6FA8','#F2F5F7','CIRCLE','ANCHOR'],
  ['club_redmere_republic','redmere','#8C1C13','#EFE7D8','SHIELD','SERPENT'],
  ['club_ember_nine','ember','#221F2E','#9B5DE5','DIAMOND','PHOENIX'],
  ['club_cinderwick_town','cinderwick','#B32226','#F6EEDC','CIRCLE','FLAME'],
] as const;

export function crestForVisual(visual:ClubVisualIdentity): string | undefined {
  const match = CRESTS.find(([, ,primary,secondary,shape,motif]) =>
    primary.toLowerCase() === visual.primary.toLowerCase()
    && secondary.toLowerCase() === visual.secondary.toLowerCase()
    && shape === visual.badgeShape && motif === visual.badgeMotif);
  return match ? `crest.${match[1]}` : undefined;
}

export interface ClubArtIdentity {
  readonly crest: string;
  readonly colours: readonly [string,string,string];
  readonly kits: { readonly home:string;readonly away:string;readonly goalkeeper:string;readonly training:string };
  readonly stadium: string;
}
export function clubArtIdentity(visual:ClubVisualIdentity): ClubArtIdentity {
  return {crest:crestForVisual(visual) ?? 'procedural',colours:[visual.primary,visual.secondary,visual.accent],
    kits:{home:'kit.home',away:'kit.away',goalkeeper:'kit.goalkeeper',training:'kit.training'},stadium:'environment.stadium-day'};
}
export const AUTHORED_CLUB_ART = Object.fromEntries(CRESTS.map(([id,key,primary,secondary])=>[id,{crest:`crest.${key}`,colours:[primary,secondary]}]));
