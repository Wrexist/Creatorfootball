import type { ObjectiveTemplate } from '../../schema';

/**
 * Objective templates.
 *
 * Five voices ask you for things and they want different things, which is the
 * whole design: the board wants solvency, the fans want a derby win, a sponsor
 * wants impressions, and the season target wants a league position. They pull
 * against each other on purpose. `requires` gates keep a template from being
 * offered where it would be trivial or impossible — a survival objective must
 * never land on the runaway leader.
 */

const cash = (amount: number, label: string) => ({ kind: 'CASH', amount, label });
const rep = (amount: number) => ({ kind: 'REPUTATION', amount, label: `+${amount} reputation` });
const scout = (amount: number) => ({ kind: 'SCOUT_CREDIT', amount, label: `${amount} scouting credits` });
const card = (ref: string, label: string) => ({ kind: 'RULE_CARD', amount: 1, ref, label });
const facility = (amount: number) => ({ kind: 'FACILITY_CREDIT', amount, label: 'Facility credit' });
const cosmetic = (ref: string, label: string) => ({ kind: 'COSMETIC', amount: 1, ref, label });

export const BASE_OBJECTIVES: readonly ObjectiveTemplate[] = [
  /* ------------------------------------------------------- SEASON targets */
  {
    id: 'obj_season_title', title: 'Win the league', kind: 'LEAGUE_POSITION',
    description: 'Finish first. Nothing else about this season will be remembered.',
    target: 1, durationCycles: null, source: 'SEASON', importance: 5, weight: 10,
    requires: { minReputation: 70 },
    rewards: [cash(1_800_000, 'Title bonus'), rep(14), cosmetic('cosmetic_champion_crest', 'Champion crest')],
  },
  {
    id: 'obj_season_playoffs', title: 'Reach the playoffs', kind: 'LEAGUE_POSITION',
    description: 'A top-four finish. The board has said it plainly and will not say it twice.',
    target: 4, durationCycles: null, source: 'SEASON', importance: 5, weight: 14,
    requires: { minReputation: 45 },
    rewards: [cash(700_000, 'Playoff qualification'), rep(8), facility(120_000)],
  },
  {
    id: 'obj_season_top_half', title: 'Finish in the top half', kind: 'LEAGUE_POSITION',
    description: 'Sixth or better. Modest, achievable, and the difference between a plan and a panic.',
    target: 6, durationCycles: null, source: 'SEASON', importance: 4, weight: 16,
    rewards: [cash(320_000, 'Top-half finish'), rep(5)],
  },
  {
    id: 'obj_season_survival', title: 'Stay in this league', kind: 'AVOID_RELEGATION',
    description: 'Tenth or above. Everyone in the building knows what the alternative costs.',
    target: 10, durationCycles: null, source: 'SEASON', importance: 5, weight: 16,
    requires: { maxReputation: 55 },
    rewards: [cash(240_000, 'Survival payment'), rep(4), facility(60_000)],
  },
  {
    id: 'obj_season_points_haul', title: 'Bank forty points', kind: 'POINTS',
    description: 'Forty points across the season. It is not glamorous and it is almost always enough.',
    target: 40, durationCycles: null, source: 'SEASON', importance: 3, weight: 12,
    rewards: [cash(180_000, 'Points bonus'), rep(3)],
  },
  {
    id: 'obj_season_goal_difference', title: 'Positive goal difference', kind: 'GOAL_DIFFERENCE',
    description: 'Score more than you concede across the whole season. In this format that is harder than it sounds.',
    target: 1, durationCycles: null, source: 'SEASON', importance: 3, weight: 10,
    rewards: [cash(140_000, 'Board bonus'), rep(2)],
  },
  {
    id: 'obj_season_trophy', title: 'Win a trophy', kind: 'TROPHY',
    description: 'Any trophy. The cabinet has been embarrassing for long enough.',
    target: 1, durationCycles: null, source: 'SEASON', importance: 5, weight: 8,
    rewards: [cash(900_000, 'Trophy bonus'), rep(12), cosmetic('cosmetic_trophy_banner', 'Trophy banner')],
  },
  {
    id: 'obj_season_home_fortress', title: 'Unbeaten at home', kind: 'HOME_UNBEATEN',
    description: 'Do not lose a single home fixture. Make the trip somewhere nobody wants to make.',
    target: 11, durationCycles: null, source: 'SEASON', importance: 4, weight: 7,
    rewards: [cash(360_000, 'Home record bonus'), rep(6), cosmetic('cosmetic_fortress_tifo', 'Fortress tifo')],
  },

  /* ------------------------------------------------------- BOARD demands */
  {
    id: 'obj_board_balance_books', title: 'End the window in the black', kind: 'TRANSFER_PROFIT',
    description: 'Sell more than you buy. The board has heard your plan and would like the money back first.',
    target: 250_000, durationCycles: 8, source: 'BOARD', importance: 4, weight: 12,
    rewards: [cash(150_000, 'Prudence bonus'), rep(3)],
  },
  {
    id: 'obj_board_wage_control', title: 'Hold the wage bill', kind: 'WAGE_RATIO',
    description: 'Keep wages under seventy per cent of income for a full quarter of the season.',
    target: 70, durationCycles: 6, source: 'BOARD', importance: 3, weight: 11,
    rewards: [cash(120_000, 'Wage discipline bonus'), facility(80_000)],
  },
  {
    id: 'obj_board_facility_investment', title: 'Upgrade a facility', kind: 'FACILITY_LEVEL',
    description: 'The board has released funds on condition they are spent on the building, not the squad.',
    target: 1, durationCycles: 10, source: 'BOARD', importance: 3, weight: 13,
    rewards: [facility(200_000), rep(2)],
  },
  {
    id: 'obj_board_sponsor_portfolio', title: 'Sign three sponsors', kind: 'SPONSOR_COUNT',
    description: 'Three active deals on the books. The board would like the club to look like a going concern.',
    target: 3, durationCycles: 12, source: 'BOARD', importance: 3, weight: 12,
    rewards: [cash(200_000, 'Commercial bonus'), rep(4)],
  },
  {
    id: 'obj_board_reduce_debt', title: 'Clear the debt', kind: 'DEBT',
    description: 'Get the club back to zero. Every conversation about ambition is stuck behind this one.',
    target: 0, durationCycles: 16, source: 'BOARD', importance: 4, weight: 8,
    requires: { minDebt: 1 },
    rewards: [rep(7), facility(150_000)],
  },
  {
    id: 'obj_board_squad_size', title: 'Trim the squad', kind: 'SQUAD_SIZE',
    description: 'Down to eighteen registered. The board is paying people who will not play a minute.',
    target: 18, durationCycles: 6, source: 'BOARD', importance: 2, weight: 10,
    rewards: [cash(90_000, 'Efficiency bonus')],
  },
  {
    id: 'obj_board_sell_star', title: 'Cash in on an asset', kind: 'SELL_VALUE',
    description: 'Raise a serious fee from a single sale. The board has already spent it in their heads.',
    target: 1_200_000, durationCycles: 8, source: 'BOARD', importance: 4, weight: 7,
    requires: { minSquadValue: 6_000_000 },
    rewards: [cash(200_000, 'Sale commission'), facility(100_000)],
  },
  {
    id: 'obj_board_youth_minutes', title: 'Play the academy', kind: 'YOUTH_MINUTES',
    description: 'Nine hundred minutes to players under twenty-one. The academy costs money either way.',
    target: 900, durationCycles: 14, source: 'BOARD', importance: 3, weight: 11,
    rewards: [cash(160_000, 'Academy return'), rep(4), scout(2)],
  },
  {
    id: 'obj_board_avoid_sackings', title: 'Survive the review', kind: 'BOARD_CONFIDENCE',
    description: 'Keep board confidence above forty until the mid-season review. That is the whole objective.',
    target: 40, durationCycles: 11, source: 'BOARD', importance: 5, weight: 6,
    requires: { maxBoardConfidence: 55 },
    rewards: [rep(5), cash(100_000, 'Vote of confidence')],
  },

  /* --------------------------------------------------------- FAN demands */
  {
    id: 'obj_fans_derby_win', title: 'Beat them', kind: 'DERBY_WIN',
    description: 'Win the derby. The supporters have made clear that nothing else this season substitutes for it.',
    target: 1, durationCycles: 6, source: 'FANS', importance: 5, weight: 15,
    rewards: [rep(6), cosmetic('cosmetic_derby_flag', 'Derby flag'), cash(120_000, 'Bragging rights fund')],
  },
  {
    id: 'obj_fans_sentiment', title: 'Win the room back', kind: 'FAN_SENTIMENT',
    description: 'Get fan sentiment above seventy. Right now the walk to the car park is not enjoyable.',
    target: 70, durationCycles: 8, source: 'FANS', importance: 4, weight: 14,
    requires: { maxFanSentiment: 60 },
    rewards: [cash(140_000, 'Season ticket surge'), rep(4)],
  },
  {
    id: 'obj_fans_attendance', title: 'Fill the ground', kind: 'ATTENDANCE',
    description: 'Ninety per cent of capacity for four consecutive home fixtures.',
    target: 4, durationCycles: 10, source: 'FANS', importance: 3, weight: 12,
    rewards: [cash(180_000, 'Matchday uplift'), rep(3)],
  },
  {
    id: 'obj_fans_keep_the_hero', title: 'Do not sell him', kind: 'RETAIN_PLAYER',
    description: 'Keep the cult hero through the window. The supporters have been extremely clear about the consequences.',
    target: 1, durationCycles: 8, source: 'FANS', importance: 4, weight: 9,
    requires: { hasCultHero: 1 },
    rewards: [rep(5), cash(60_000, 'Loyalty fund')],
  },
  {
    id: 'obj_fans_entertainment', title: 'Give them a show', kind: 'GOALS_SCORED',
    description: 'Twenty-five goals in ten fixtures. The terrace does not want a clean sheet, it wants a night out.',
    target: 25, durationCycles: 10, source: 'FANS', importance: 3, weight: 13,
    rewards: [cash(130_000, 'Entertainment bonus'), rep(3), card('DOUBLE_GOAL', 'Double Goal card')],
  },
  {
    id: 'obj_fans_local_hero', title: 'Start a local lad', kind: 'ACADEMY_DEBUT',
    description: 'Give an academy graduate a competitive debut. It matters here more than the table does.',
    target: 1, durationCycles: 12, source: 'FANS', importance: 3, weight: 11,
    rewards: [rep(4), cash(70_000, 'Community fund'), cosmetic('cosmetic_academy_banner', 'Academy banner')],
  },
  {
    id: 'obj_fans_away_days', title: 'Win on the road', kind: 'AWAY_WINS',
    description: 'Three away wins. The travelling support has paid for a lot of nothing lately.',
    target: 3, durationCycles: 12, source: 'FANS', importance: 3, weight: 12,
    rewards: [cash(150_000, 'Away support levy'), rep(3)],
  },
  {
    id: 'obj_fans_no_capitulation', title: 'Stop the collapses', kind: 'LEADS_HELD',
    description: 'Hold on to a lead in five consecutive matches. They have stopped celebrating first goals.',
    target: 5, durationCycles: 9, source: 'FANS', importance: 4, weight: 10,
    rewards: [rep(4), cash(110_000, 'Composure bonus')],
  },

  /* ----------------------------------------------------- SPONSOR demands */
  {
    id: 'obj_sponsor_impressions', title: 'Deliver the impressions', kind: 'IMPRESSIONS',
    description: 'Two million impressions across the club channels this quarter, as contracted.',
    target: 2_000_000, durationCycles: 8, source: 'SPONSOR', importance: 3, weight: 14,
    rewards: [cash(220_000, 'Sponsor activation bonus')],
  },
  {
    id: 'obj_sponsor_follower_growth', title: 'Grow the audience', kind: 'FOLLOWER_GROWTH',
    description: 'Add fifty thousand followers. The sponsor is buying reach and will audit it.',
    target: 50_000, durationCycles: 10, source: 'SPONSOR', importance: 3, weight: 14,
    rewards: [cash(190_000, 'Reach bonus'), rep(2)],
  },
  {
    id: 'obj_sponsor_creator_signing', title: 'Bring in a creator', kind: 'CREATOR_SIGNED',
    description: 'Attach a creator of Established tier or above to the club. The sponsor asked for it by name of tier.',
    target: 1, durationCycles: 9, source: 'SPONSOR', importance: 3, weight: 12,
    rewards: [cash(240_000, 'Creator activation'), rep(3)],
  },
  {
    id: 'obj_sponsor_merch', title: 'Move the merchandise', kind: 'MERCH_REVENUE',
    description: 'Three hundred thousand in retail. There is a warehouse involved and the sponsor knows how full it is.',
    target: 300_000, durationCycles: 10, source: 'SPONSOR', importance: 2, weight: 12,
    rewards: [cash(160_000, 'Retail bonus'), cosmetic('cosmetic_sponsor_kit', 'Sponsor edition kit')],
  },
  {
    id: 'obj_sponsor_clean_conduct', title: 'Keep it clean', kind: 'CARDS_UNDER',
    description: 'Fewer than twelve cards over eight fixtures. The morality clause is not decorative.',
    target: 12, durationCycles: 8, source: 'SPONSOR', importance: 3, weight: 11,
    rewards: [cash(170_000, 'Conduct bonus'), rep(2)],
  },
  {
    id: 'obj_sponsor_star_moment', title: 'Give them a highlight', kind: 'CREATOR_MOMENTS',
    description: 'Six creator moments in matches this quarter. They are paying for the clip, not the result.',
    target: 6, durationCycles: 8, source: 'SPONSOR', importance: 2, weight: 12,
    rewards: [cash(140_000, 'Highlight package'), card('CREATOR_MOMENT', 'Creator Moment card')],
  },
  {
    id: 'obj_sponsor_matchday_activation', title: 'Sell out the fan zone', kind: 'FANZONE_ATTENDANCE',
    description: 'Three sold-out fan-zone activations. Somebody will be counting at the gate.',
    target: 3, durationCycles: 9, source: 'SPONSOR', importance: 2, weight: 10,
    rewards: [cash(130_000, 'Activation fee'), facility(70_000)],
  },

  /* ----------------------------------------------------- DYNAMIC (world) */
  {
    id: 'obj_dyn_win_streak', title: 'Three in a row', kind: 'WIN_STREAK',
    description: 'Win three consecutive fixtures while the run is live.',
    target: 3, durationCycles: 5, source: 'DYNAMIC', importance: 3, weight: 16,
    rewards: [cash(110_000, 'Streak bonus'), rep(2)],
  },
  {
    id: 'obj_dyn_clean_sheets', title: 'Shut the door', kind: 'CLEAN_SHEETS',
    description: 'Four clean sheets. In a thirty-minute format that is a genuine achievement.',
    target: 4, durationCycles: 10, source: 'DYNAMIC', importance: 3, weight: 14,
    rewards: [cash(120_000, 'Defensive bonus'), card('LOCKDOWN', 'Lockdown card')],
  },
  {
    id: 'obj_dyn_striker_form', title: 'Feed the striker', kind: 'PLAYER_GOALS',
    description: 'Eight goals from one forward. He has told the press he is being starved and he is not entirely wrong.',
    target: 8, durationCycles: 12, source: 'DYNAMIC', importance: 3, weight: 13,
    rewards: [cash(140_000, 'Bonus triggered'), rep(2)],
  },
  {
    id: 'obj_dyn_develop_prospect', title: 'Raise a prospect', kind: 'DEVELOP_PLAYER',
    description: 'Add six overall points to a player under twenty-one.',
    target: 6, durationCycles: 14, source: 'DYNAMIC', importance: 3, weight: 13,
    rewards: [scout(3), rep(3), cash(90_000, 'Development grant')],
  },
  {
    id: 'obj_dyn_scout_network', title: 'File the reports', kind: 'SCOUT_REPORTS',
    description: 'Complete five full scouting reports. You are recruiting on guesswork and it shows.',
    target: 5, durationCycles: 10, source: 'DYNAMIC', importance: 2, weight: 12,
    rewards: [scout(4), cash(60_000, 'Network expansion')],
  },
  {
    id: 'obj_dyn_upset', title: 'Beat somebody above you', kind: 'UPSET_WIN',
    description: 'Take three points off a club in the top three.',
    target: 1, durationCycles: 7, source: 'DYNAMIC', importance: 4, weight: 14,
    rewards: [rep(5), cash(150_000, 'Giant-killing fund'), card('LAST_STAND', 'Last Stand card')],
  },
  {
    id: 'obj_dyn_response', title: 'Respond to a hammering', kind: 'BOUNCE_BACK',
    description: 'Win the next fixture after a defeat by three or more. The dressing room is watching how this is handled.',
    target: 1, durationCycles: 3, source: 'DYNAMIC', importance: 4, weight: 12,
    requires: { recentHeavyDefeat: 1 },
    rewards: [rep(3), cash(100_000, 'Reaction bonus')],
  },
  {
    id: 'obj_dyn_motm_run', title: 'Own the headlines', kind: 'MOTM',
    description: 'Three player-of-the-match awards for your squad inside six fixtures.',
    target: 3, durationCycles: 6, source: 'DYNAMIC', importance: 2, weight: 12,
    rewards: [cash(95_000, 'Media bonus'), rep(2)],
  },
  {
    id: 'obj_dyn_rule_card_master', title: 'Play the moment right', kind: 'SPECIAL_RULE_WINS',
    description: 'Win three matches in which a special rule fired in your favour.',
    target: 3, durationCycles: 10, source: 'DYNAMIC', importance: 3, weight: 11,
    rewards: [card('POWER_PLAY', 'Power Play card'), cash(85_000, 'Showcase bonus')],
  },
  {
    id: 'obj_dyn_injury_crisis', title: 'Cope without them', kind: 'WINS_SHORTHANDED',
    description: 'Take four points while three or more first-teamers are unavailable.',
    target: 4, durationCycles: 6, source: 'DYNAMIC', importance: 4, weight: 9,
    requires: { minInjuries: 3 },
    rewards: [cash(130_000, 'Depth bonus'), facility(90_000), rep(3)],
  },
  {
    id: 'obj_dyn_wildcard_impact', title: 'Pick the right wildcard', kind: 'WILDCARD_CONTRIBUTION',
    description: 'Get four goal contributions from the weekly wildcard slot. That slot is a decision, not a formality.',
    target: 4, durationCycles: 9, source: 'DYNAMIC', importance: 3, weight: 12,
    rewards: [cash(115_000, 'Wildcard bonus'), rep(2)],
  },
  {
    id: 'obj_dyn_rivalry_flashpoint', title: 'Do not lose your head', kind: 'DERBY_DISCIPLINE',
    description: 'Get through the derby without a red card. History suggests this is not a given.',
    target: 0, durationCycles: 4, source: 'DYNAMIC', importance: 3, weight: 10,
    rewards: [rep(3), cash(70_000, 'Discipline bonus')],
  },
  {
    id: 'obj_dyn_creator_harmony', title: 'Keep the creator onside', kind: 'CREATOR_SENTIMENT',
    description: 'Get an attached creator\'s club sentiment above sixty. They are currently posting through it.',
    target: 60, durationCycles: 8, source: 'DYNAMIC', importance: 3, weight: 11,
    requires: { hasCreator: 1 },
    rewards: [cash(105_000, 'Partnership bonus'), rep(2)],
  },
  {
    id: 'obj_dyn_unbeaten_run', title: 'Stop losing', kind: 'UNBEATEN_RUN',
    description: 'Six fixtures without defeat. Not pretty. Just necessary.',
    target: 6, durationCycles: 8, source: 'DYNAMIC', importance: 3, weight: 12,
    rewards: [cash(160_000, 'Stability bonus'), rep(4)],
  },
];

export const BASE_OBJECTIVE_IDS: readonly string[] = BASE_OBJECTIVES.map((o) => o.id);
