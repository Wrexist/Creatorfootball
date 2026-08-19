import type { TacticSetup, TacticVector } from '@cf/engine';

/**
 * The words that go with the numbers.
 *
 * `tactics/vector.ts` in the engine states every instruction's trade-off twice:
 * once as a comment and once as a table of deltas. This file is the third
 * statement of the same thing, in the player's language, and it must never
 * disagree with the other two. If a delta table changes, the sentence here
 * changes with it.
 *
 * The screen shows both: this sentence, and the engine-computed movement in the
 * tactic vector. One tells you what you are choosing, the other proves it.
 */

export type SettingKey =
  | 'tempo' | 'press' | 'line' | 'width' | 'passing' | 'buildUp'
  | 'focus' | 'marking' | 'risk' | 'counter' | 'subStrategy';

export interface SettingDef {
  readonly key: SettingKey;
  readonly label: string;
  readonly question: string;
  /** The value whose delta table is empty — the honest baseline to compare to. */
  readonly neutral: string;
  readonly options: readonly { readonly value: string; readonly label: string; readonly tradeOff: string }[];
}

export const SETTINGS: readonly SettingDef[] = [
  {
    key: 'tempo',
    label: 'Tempo',
    question: 'How fast do you want the ball moved forward?',
    neutral: 'BALANCED',
    options: [
      { value: 'PATIENT', label: 'Patient', tradeOff: 'Better chances and more of the ball — far fewer of them, and the counter dies.' },
      { value: 'BALANCED', label: 'Balanced', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'QUICK', label: 'Quick', tradeOff: 'More attacks and sharper transitions, at the cost of possession and legs.' },
      { value: 'FRANTIC', label: 'Frantic', tradeOff: 'Chaos: shots everywhere, most of them bad, and the squad is empty by the last ten minutes.' },
    ],
  },
  {
    key: 'press',
    label: 'Press',
    question: 'Where do you try to win the ball back?',
    neutral: 'BALANCED',
    options: [
      { value: 'LOW_BLOCK', label: 'Low block', tradeOff: 'Almost nothing gets in behind and the legs last — you surrender the ball and the pitch.' },
      { value: 'MID_BLOCK', label: 'Mid block', tradeOff: 'Solid and cheap. You win the ball later and further from their goal.' },
      { value: 'BALANCED', label: 'Balanced', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'HIGH_PRESS', label: 'High press', tradeOff: 'Turnovers in dangerous areas AND drained stamina AND space in behind AND more fouls. All four, every match.' },
    ],
  },
  {
    key: 'line',
    label: 'Defensive line',
    question: 'How high does the last line sit?',
    neutral: 'NORMAL',
    options: [
      { value: 'DEEP', label: 'Deep', tradeOff: 'Unpickable over the top. Hands them forty yards of free build-up.' },
      { value: 'NORMAL', label: 'Normal', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'HIGH', label: 'High', tradeOff: 'Compresses the pitch and feeds the press — every ball over the top is a one-on-one.' },
    ],
  },
  {
    key: 'width',
    label: 'Width',
    question: 'Do you stretch them or squeeze the middle?',
    neutral: 'BALANCED',
    options: [
      { value: 'NARROW', label: 'Narrow', tradeOff: 'Owns the centre and the best chance locations. The flanks are theirs.' },
      { value: 'BALANCED', label: 'Balanced', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'WIDE', label: 'Wide', tradeOff: 'More entries and crosses from worse positions, and a stretched block to defend with.' },
    ],
  },
  {
    key: 'passing',
    label: 'Passing',
    question: 'Through the lines, or over them?',
    neutral: 'MIXED',
    options: [
      { value: 'DIRECT', label: 'Direct', tradeOff: 'Bypasses their press and feeds counters. You will not see much of the ball.' },
      { value: 'MIXED', label: 'Mixed', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'SHORT', label: 'Short', tradeOff: 'Keeps the ball and builds better openings. Walks straight into a good press.' },
    ],
  },
  {
    key: 'buildUp',
    label: 'Build-up',
    question: 'How does the ball leave your own third?',
    neutral: 'BALANCED',
    options: [
      { value: 'FROM_THE_BACK', label: 'From the back', tradeOff: 'The best way to break a press and the fastest way to gift a goal.' },
      { value: 'BALANCED', label: 'Balanced', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'BYPASS', label: 'Bypass', tradeOff: 'Safe in your own third. Hands possession straight back.' },
    ],
  },
  {
    key: 'focus',
    label: 'Attacking focus',
    question: 'Where do you load the attack?',
    neutral: 'BALANCED',
    options: [
      { value: 'LEFT', label: 'Left', tradeOff: 'Overloads one flank and makes the team readable.' },
      { value: 'CENTRE', label: 'Centre', tradeOff: 'Better positions against more bodies.' },
      { value: 'RIGHT', label: 'Right', tradeOff: 'Overloads one flank and makes the team readable.' },
      { value: 'BALANCED', label: 'Even', tradeOff: 'No bias either way. The reference setting.' },
    ],
  },
  {
    key: 'marking',
    label: 'Marking',
    question: 'Hold the shape, or follow the man?',
    neutral: 'MIXED',
    options: [
      { value: 'ZONAL', label: 'Zonal', tradeOff: 'Holds shape and concedes fewer fouls. Good movement finds the gaps between zones.' },
      { value: 'MIXED', label: 'Mixed', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'MAN', label: 'Man', tradeOff: 'Wins the ball earlier and higher — drags the shape apart and racks up fouls.' },
    ],
  },
  {
    key: 'risk',
    label: 'Risk',
    question: 'How much are you willing to lose by?',
    neutral: 'MEASURED',
    options: [
      { value: 'CAUTIOUS', label: 'Cautious', tradeOff: 'Solid and controlled. You will create very little.' },
      { value: 'MEASURED', label: 'Measured', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'BOLD', label: 'Bold', tradeOff: 'More attacking output bought directly with defensive solidity.' },
      { value: 'RECKLESS', label: 'Reckless', tradeOff: 'Enormous output, an open back door, and results that swing both ways.' },
    ],
  },
  {
    key: 'counter',
    label: 'Counter attacks',
    question: 'What happens the moment you win it?',
    neutral: 'WHEN_ON',
    options: [
      { value: 'NEVER', label: 'Never', tradeOff: 'Everyone stays in shape, and you waste the best moment to attack.' },
      { value: 'WHEN_ON', label: 'When on', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'ALWAYS', label: 'Always', tradeOff: 'Every turnover becomes a break. The team stops building anything and the chances are snatched.' },
    ],
  },
  {
    key: 'subStrategy',
    label: 'Substitutions',
    question: 'When does the bench come on?',
    neutral: 'BALANCED',
    options: [
      { value: 'CONSERVATIVE', label: 'Late', tradeOff: 'A settled side that finishes on tired legs.' },
      { value: 'BALANCED', label: 'Balanced', tradeOff: 'No bias either way. The reference setting.' },
      { value: 'AGGRESSIVE', label: 'Early', tradeOff: 'Fresher legs all game, at the cost of a settled team and sharpness.' },
    ],
  },
];

/** How the match model reads each vector term, and which direction is good news. */
export const VECTOR_TERMS: Readonly<Record<keyof TacticVector, { label: string; higher: 'good' | 'bad' | 'neutral'; scale: number }>> = {
  aggression: { label: 'Defending higher up', higher: 'neutral', scale: 100 },
  attackVolume: { label: 'Chances created', higher: 'good', scale: 100 },
  defensiveSolidity: { label: 'Defensive solidity', higher: 'good', scale: 100 },
  spaceBehind: { label: 'Space in behind', higher: 'bad', scale: 100 },
  fatigueRate: { label: 'Stamina drain', higher: 'bad', scale: 100 },
  possessionBias: { label: 'Share of the ball', higher: 'neutral', scale: 100 },
  pressRecovery: { label: 'Turnovers won high', higher: 'good', scale: 100 },
  counterWeight: { label: 'Counter-attacking', higher: 'neutral', scale: 100 },
  chanceQuality: { label: 'Chance quality', higher: 'good', scale: 100 },
  foulRate: { label: 'Fouls and cards', higher: 'bad', scale: 100 },
  widthBias: { label: 'Play through the wings', higher: 'neutral', scale: 100 },
  volatility: { label: 'Swinginess', higher: 'neutral', scale: 100 },
};

export const settingValue = (tactics: TacticSetup, key: SettingKey): string => String(tactics[key]);
