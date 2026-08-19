/** Positions are data, not strings scattered through logic. */
export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_GROUPS = {
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB'],
  MID: ['CDM', 'CM', 'CAM'],
  ATT: ['LW', 'RW', 'ST'],
} as const;
export type PositionGroup = keyof typeof POSITION_GROUPS;

export const positionGroup = (pos: Position): PositionGroup => {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'CDM' || pos === 'CM' || pos === 'CAM') return 'MID';
  return 'ATT';
};

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'Goalkeeper', CB: 'Centre Back', LB: 'Left Back', RB: 'Right Back',
  CDM: 'Defensive Mid', CM: 'Central Mid', CAM: 'Attacking Mid',
  LW: 'Left Wing', RW: 'Right Wing', ST: 'Striker',
};

/**
 * How naturally a player covers a position other than their own. Playing out of
 * position is allowed, but it costs effectiveness — a real trade-off rather than
 * a blocked UI action.
 */
export const POSITION_FAMILIARITY: Record<Position, Partial<Record<Position, number>>> = {
  GK: { GK: 1 },
  CB: { CB: 1, LB: 0.75, RB: 0.75, CDM: 0.7 },
  LB: { LB: 1, RB: 0.85, CB: 0.7, LW: 0.7, CM: 0.6 },
  RB: { RB: 1, LB: 0.85, CB: 0.7, RW: 0.7, CM: 0.6 },
  CDM: { CDM: 1, CM: 0.9, CB: 0.7, CAM: 0.7 },
  CM: { CM: 1, CDM: 0.88, CAM: 0.88, LW: 0.6, RW: 0.6 },
  CAM: { CAM: 1, CM: 0.88, LW: 0.78, RW: 0.78, ST: 0.75 },
  LW: { LW: 1, RW: 0.88, CAM: 0.78, ST: 0.7, LB: 0.6 },
  RW: { RW: 1, LW: 0.88, CAM: 0.78, ST: 0.7, RB: 0.6 },
  ST: { ST: 1, CAM: 0.72, LW: 0.7, RW: 0.7 },
};

export const familiarity = (natural: Position, playing: Position): number =>
  POSITION_FAMILIARITY[natural][playing] ?? 0.45;
