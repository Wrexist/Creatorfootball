import type { SponsorTemplate } from '../../schema';

/**
 * Twenty fictional sponsors across four tiers.
 *
 * The gates are the point. A club at reputation 20 with fifty thousand
 * followers can sign a cider brand and a removals firm and nothing else, and
 * the jump to the tier-three brands is felt rather than announced. Creator-slot
 * sponsors gate on followers instead of reputation, which is what makes growing
 * an audience a distinct economic strategy from winning matches.
 *
 * Every brand here is invented. None refers to, resembles or trades on any real
 * company.
 */
export const BASE_SPONSORS: readonly SponsorTemplate[] = [
  /* ------------------------------------------------------------- tier 1 */
  {
    id: 'sponsor_pike_street_chippy', name: 'Pike Street Chippy', sector: 'FOOD', tier: 1,
    slots: ['SLEEVE'], baseValue: 2_400, accent: '#F0B429', requiresReputation: 1,
    blurb: 'Two hundred metres from the ground and open the second the whistle goes. Will pay in cash and occasionally in chips.',
  },
  {
    id: 'sponsor_marrow_valley_taxis', name: 'Marrow Valley Taxis', sector: 'TRANSPORT', tier: 1,
    slots: ['SLEEVE', 'STADIUM'], baseValue: 3_200, accent: '#7FD4C1', requiresReputation: 3,
    blurb: 'A local firm that has sponsored somebody in this league every year since 1994 and has never once asked for a report.',
  },
  {
    id: 'sponsor_grainhouse_coffee', name: 'Grainhouse Coffee', sector: 'FOOD', tier: 1,
    slots: ['TRAINING', 'SLEEVE'], baseValue: 4_500, accent: '#8C6239', requiresReputation: 8,
    blurb: 'Roasts four streets from the training ground. Wants the staff photographed holding the cups, which the staff resent.',
  },
  {
    id: 'sponsor_bootroom_sports', name: 'Bootroom Sports', sector: 'RETAIL', tier: 1,
    slots: ['TRAINING'], baseValue: 6_000, accent: '#34d399', requiresReputation: 10,
    blurb: 'An independent sports shop run by a man who will tell you exactly what he thought of the second half.',
  },
  {
    id: 'sponsor_halloway_and_sons', name: 'Halloway & Sons', sector: 'CONSTRUCTION', tier: 1,
    slots: ['SHIRT', 'STADIUM'], baseValue: 8_000, accent: '#E2570F', requiresReputation: 5,
    blurb: 'Builders who did the stand and would quite like everyone to know they did the stand.',
  },

  /* ------------------------------------------------------------- tier 2 */
  {
    id: 'sponsor_kestrel_print', name: 'Kestrel Print', sector: 'MEDIA', tier: 2,
    slots: ['SLEEVE'], baseValue: 14_000, accent: '#B9C2CE', requiresReputation: 15,
    blurb: 'Prints the programme, the posters and half the merchandise, and would like a sleeve for the trouble.',
  },
  {
    id: 'sponsor_northgate_removals', name: 'Northgate Removals', sector: 'LOGISTICS', tier: 2,
    slots: ['TRAINING'], baseValue: 16_500, accent: '#4A5568', requiresReputation: 18,
    blurb: 'Moves half the squad every transfer window and has made a running joke of it in every advert.',
  },
  {
    id: 'sponsor_fenwick_fitness', name: 'Fenwick Fitness', sector: 'HEALTH', tier: 2,
    slots: ['TRAINING', 'CREATOR'], baseValue: 19_000, accent: '#C8FF2E', requiresReputation: 20,
    requiresFollowers: 40_000,
    blurb: 'A gym chain that wants the players filming in its branches and is refreshingly upfront that this is the entire deal.',
  },
  {
    id: 'sponsor_coldharbour_insurance', name: 'Coldharbour Insurance', sector: 'FINANCE', tier: 2,
    slots: ['SLEEVE', 'STADIUM'], baseValue: 22_000, accent: '#1D6FA8', requiresReputation: 25,
    blurb: 'Cautious money. Reads every clause, pays exactly on time, and will walk the moment the club is in the news badly.',
  },
  {
    id: 'sponsor_tinderbrook_cider', name: 'Tinderbrook Cider', sector: 'DRINKS', tier: 2,
    slots: ['SHIRT', 'STADIUM'], baseValue: 26_000, accent: '#D8B24A', requiresReputation: 22,
    blurb: 'Regional cider with genuine affection for the competition and an advertising budget it cannot quite justify.',
  },

  /* ------------------------------------------------------------- tier 3 */
  {
    id: 'sponsor_sablewick_motors', name: 'Sablewick Motors', sector: 'AUTOMOTIVE', tier: 3,
    slots: ['SHIRT', 'STADIUM'], baseValue: 44_000, accent: '#2E3238', requiresReputation: 42,
    blurb: 'Puts a car in the concourse and a manager in an advert. The advert is always slightly worse than everyone expected.',
  },
  {
    id: 'sponsor_voltmark_energy', name: 'Voltmark Energy', sector: 'ENERGY', tier: 3,
    slots: ['SHIRT', 'STADIUM'], baseValue: 50_000, accent: '#F2A413', requiresReputation: 45,
    blurb: 'Wants the stand named after it by year two and has already had the signage designed.',
  },
  {
    id: 'sponsor_quarry_athletic_wear', name: 'Quarry Athletic Wear', sector: 'APPAREL', tier: 3,
    slots: ['SHIRT', 'TRAINING'], baseValue: 57_000, accent: '#6B1A34', requiresReputation: 48,
    blurb: 'A kit maker on the way up that wants a club on the way up, and will drop you the moment either stops being true.',
  },
  {
    id: 'sponsor_palisade_bank', name: 'Palisade Bank', sector: 'FINANCE', tier: 3,
    slots: ['SHIRT', 'SLEEVE'], baseValue: 65_000, accent: '#123B2E', requiresReputation: 52,
    blurb: 'Serious money with a compliance department attached. Every clause about conduct is in there for a reason.',
  },
  {
    id: 'sponsor_hexline_telecom', name: 'Hexline Telecom', sector: 'TELECOM', tier: 3,
    slots: ['SHIRT', 'STADIUM', 'CREATOR'], baseValue: 74_000, accent: '#7C8CFF', requiresReputation: 55,
    requiresFollowers: 250_000,
    blurb: 'Buys audience, not results, and says so in the meeting. Will renew after a relegation if the numbers held up.',
  },

  /* ------------------------------------------------------------- tier 4 */
  {
    id: 'sponsor_havelock_watches', name: 'Havelock Watches', sector: 'LUXURY', tier: 4,
    slots: ['SLEEVE', 'CREATOR'], baseValue: 110_000, accent: '#C9A227', requiresReputation: 76,
    requiresFollowers: 900_000,
    blurb: 'Does not care about the league table. Cares enormously about who is photographed wearing the watch and where.',
  },
  {
    id: 'sponsor_lanternhill_group', name: 'Lanternhill Group', sector: 'CONGLOMERATE', tier: 4,
    slots: ['STADIUM'], baseValue: 128_000, accent: '#B9C2CE', requiresReputation: 80,
    blurb: 'Wants its name on the building for fifteen years and has the legal team to make sure it stays there.',
  },
  {
    id: 'sponsor_ninefold_streaming', name: 'Ninefold Streaming', sector: 'MEDIA', tier: 4,
    slots: ['SHIRT', 'CREATOR'], baseValue: 148_000, accent: '#9B5DE5', requiresReputation: 72,
    requiresFollowers: 1_500_000,
    blurb: 'Pays for access, not exposure: cameras in the tunnel, cameras in the meeting, cameras on the day you are sacked.',
  },
  {
    id: 'sponsor_vaunt_air', name: 'Vaunt Air', sector: 'TRAVEL', tier: 4,
    slots: ['SHIRT', 'STADIUM'], baseValue: 172_000, accent: '#1E4FE0', requiresReputation: 78,
    blurb: 'The deal that tells the rest of the competition you have arrived, and the one that is hardest to survive losing.',
  },
  {
    id: 'sponsor_zephyr_athletic', name: 'Zephyr Athletic', sector: 'APPAREL', tier: 4,
    slots: ['SHIRT', 'TRAINING', 'CREATOR'], baseValue: 205_000, accent: '#FF2FA0', requiresReputation: 82,
    requiresFollowers: 2_500_000,
    blurb: 'The biggest deal available, and it comes with a content obligation that will consume a genuine amount of your week.',
  },
];

export const BASE_SPONSOR_IDS: readonly string[] = BASE_SPONSORS.map((s) => s.id);
