import type { ObjectiveTemplate } from '../content/schema';

/**
 * Built-in objective templates.
 *
 * Workstream B owns the full 40+ table in the content pack; this set keeps
 * progression working without it. Targets are expressed as ranges wherever the
 * right number depends on the club's situation — the roller clamps them into
 * what is actually achievable before an objective is ever offered.
 *
 * `{target}` in a title or description is substituted at roll time.
 */
export const FALLBACK_OBJECTIVE_TEMPLATES: readonly ObjectiveTemplate[] = [
  {
    id: 'ob_season_position', title: 'Finish in the top {target}',
    description: 'The board expect this squad to end the season no lower than {target}.',
    kind: 'LEAGUE_POSITION', target: { min: 1, max: 12 },
    rewards: [{ kind: 'CASH', amount: 1_500_000, label: 'Board bonus' }, { kind: 'REPUTATION', amount: 4, label: 'Reputation' }],
    durationCycles: null, source: 'SEASON', importance: 5, weight: 10,
  },
  {
    id: 'ob_season_wins', title: 'Win {target} matches',
    description: 'A season is a points total. Go and collect them.',
    kind: 'WIN_MATCHES', target: { min: 4, max: 16 },
    rewards: [{ kind: 'CASH', amount: 900_000, label: 'Performance bonus' }],
    durationCycles: null, source: 'SEASON', importance: 4, weight: 10,
  },
  {
    id: 'ob_board_trophy', title: 'Win the league',
    description: 'Nothing else will be considered a success this season.',
    kind: 'TROPHY', target: 1,
    rewards: [{ kind: 'CASH', amount: 4_000_000, label: 'Title bonus' }, { kind: 'PREMIUM', amount: 250, label: 'Premium' }],
    durationCycles: null, source: 'BOARD', importance: 5, weight: 6,
    requires: { reputation_gte: 55 },
  },
  {
    id: 'ob_dyn_wins', title: 'Win {target} of the next matches',
    description: 'Build momentum while the fixtures allow it.',
    kind: 'WIN_MATCHES', target: { min: 1, max: 4 },
    rewards: [{ kind: 'CASH', amount: 250_000, label: 'Run bonus' }, { kind: 'RULE_CARD', amount: 1, ref: 'POWER_PLAY', label: 'Power Play card' }],
    durationCycles: 6, source: 'DYNAMIC', importance: 3, weight: 12,
  },
  {
    id: 'ob_dyn_goals', title: 'Score {target} goals', description: 'Entertain them.',
    kind: 'SCORE_GOALS', target: { min: 4, max: 14 },
    rewards: [{ kind: 'CASH', amount: 200_000, label: 'Attacking bonus' }],
    durationCycles: 6, source: 'DYNAMIC', importance: 2, weight: 12,
  },
  {
    id: 'ob_dyn_clean', title: 'Keep {target} clean sheets',
    description: 'Solidity first. The rest follows.',
    kind: 'CLEAN_SHEETS', target: { min: 1, max: 4 },
    rewards: [{ kind: 'CASH', amount: 220_000, label: 'Defensive bonus' }],
    durationCycles: 6, source: 'DYNAMIC', importance: 3, weight: 10,
  },
  {
    id: 'ob_dyn_derby', title: 'Win a rivalry match',
    description: 'Some fixtures count twice. This is one of them.',
    kind: 'WIN_DERBY', target: 1,
    rewards: [{ kind: 'CASH', amount: 350_000, label: 'Derby bonus' }, { kind: 'RULE_CARD', amount: 1, ref: 'LAST_STAND', label: 'Last Stand card' }],
    durationCycles: 8, source: 'FANS', importance: 4, weight: 10,
  },
  {
    id: 'ob_dyn_discipline', title: 'No more than {target} red cards',
    description: 'The board have noticed the disciplinary record.',
    kind: 'AVOID_RED_CARDS', target: { min: 0, max: 2 },
    rewards: [{ kind: 'CASH', amount: 150_000, label: 'Discipline bonus' }],
    durationCycles: 8, source: 'BOARD', importance: 2, weight: 8,
  },
  {
    id: 'ob_dyn_motm', title: '{target} man-of-the-match awards',
    description: 'Somebody has to drag this team along.',
    kind: 'MOTM_AWARDS', target: { min: 1, max: 5 },
    rewards: [{ kind: 'SCOUT_CREDIT', amount: 2, label: 'Scout credits' }],
    durationCycles: 8, source: 'DYNAMIC', importance: 2, weight: 8,
  },
  {
    id: 'ob_dev_players', title: 'Improve players by {target} points',
    description: 'Training ground work, measured honestly.',
    kind: 'DEVELOP_PLAYER', target: { min: 3, max: 12 },
    rewards: [{ kind: 'FACILITY_CREDIT', amount: 1, label: 'Facility credit' }],
    durationCycles: 10, source: 'DYNAMIC', importance: 3, weight: 10,
  },
  {
    id: 'ob_youth', title: 'Promote {target} academy players',
    description: 'The academy is not a decoration.',
    kind: 'YOUTH_MINUTES', target: { min: 1, max: 2 },
    rewards: [{ kind: 'CASH', amount: 180_000, label: 'Academy grant' }],
    durationCycles: 12, source: 'BOARD', importance: 3, weight: 8,
  },
  {
    id: 'ob_fans_sentiment', title: 'Get fan sentiment to {target}',
    description: 'They have been patient. Reward them.',
    kind: 'FAN_SENTIMENT', target: { min: 50, max: 90 },
    rewards: [{ kind: 'CASH', amount: 300_000, label: 'Matchday uplift' }, { kind: 'COSMETIC', amount: 1, ref: 'banner_terrace', label: 'Terrace banner' }],
    durationCycles: 10, source: 'FANS', importance: 3, weight: 10,
  },
  {
    id: 'ob_followers', title: 'Reach {target} followers',
    description: 'The club account is a commercial asset now.',
    kind: 'GAIN_FOLLOWERS', target: { min: 1, max: 10_000_000 },
    rewards: [{ kind: 'CASH', amount: 400_000, label: 'Commercial bonus' }],
    durationCycles: 12, source: 'SPONSOR', importance: 3, weight: 9,
  },
  {
    id: 'ob_sponsor', title: 'Sign {target} sponsorship deals',
    description: 'Commercial want movement before the next review.',
    kind: 'SPONSOR_DEALS', target: { min: 1, max: 2 },
    rewards: [{ kind: 'CASH', amount: 500_000, label: 'Signing incentive' }],
    durationCycles: 12, source: 'SPONSOR', importance: 2, weight: 8,
  },
  {
    id: 'ob_facility', title: 'Upgrade {target} facility',
    description: 'Invest in the infrastructure, not just the shirt.',
    kind: 'FACILITY_UPGRADE', target: { min: 1, max: 2 },
    rewards: [{ kind: 'FACILITY_CREDIT', amount: 1, label: 'Facility credit' }],
    durationCycles: 14, source: 'BOARD', importance: 2, weight: 7,
    requires: { balance_gte: 500_000 },
  },
  {
    id: 'ob_signings', title: 'Complete {target} signings',
    description: 'The squad has holes and the window is open.',
    kind: 'SIGN_PLAYERS', target: { min: 1, max: 3 },
    rewards: [{ kind: 'SCOUT_CREDIT', amount: 3, label: 'Scout credits' }],
    durationCycles: 8, source: 'DYNAMIC', importance: 2, weight: 9,
    requires: { windowOpen: 1 },
  },
];
