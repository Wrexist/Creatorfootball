import type { StoreOfferDef } from '../../schema';

/**
 * Store offers on a four-week rotation, six per week.
 *
 * The rule this file exists to enforce: nothing here sells competitive
 * advantage. There are no attribute boosts, no rule cards, no instant training
 * completions, no pay-to-win squad slots. The catalogue is cosmetics, presentation
 * content and a small amount of genuine convenience — and the convenience items
 * (scouting credits) accelerate information you would have obtained anyway,
 * never the result of a match.
 *
 * Prices are in minor currency units. `rotationWeek` is 1-4 and cycles for the
 * life of the save; `startCycle`/`endCycle` are reserved for genuinely
 * time-limited events and are null for the standing catalogue.
 */

const cosmetic = (ref: string, label: string) => ({ kind: 'COSMETIC', amount: 1, ref, label });
const premium = (amount: number) => ({ kind: 'PREMIUM', amount, label: `${amount} tokens` });
const scoutCredit = (amount: number) => ({ kind: 'SCOUT_CREDIT', amount, label: `${amount} scouting credits` });

export const BASE_OFFERS: readonly StoreOfferDef[] = [
  /* ------------------------------------------------------------- week 1 */
  {
    sku: 'kit_foundry_retro', name: 'Foundry Retro Kit', rotationWeek: 1,
    description: 'A heavy cotton throwback with the old chain-and-anvil placement. Purely cosmetic.',
    priceMinor: 499, currency: 'USD', contents: [cosmetic('kit_foundry_retro', 'Foundry retro kit')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#E2570F',
  },
  {
    sku: 'badge_pack_heritage', name: 'Heritage Badge Set', rotationWeek: 1,
    description: 'Six crest treatments in the old style, for clubs that would like to look older than they are.',
    priceMinor: 399, currency: 'USD', contents: [cosmetic('badge_pack_heritage', 'Heritage badge set')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#C9A227',
  },
  {
    sku: 'broadcast_pack_latenight', name: 'Late Night Broadcast Package', rotationWeek: 1,
    description: 'An alternate presentation skin: warmer lighting, slower graphics, a different scoreboard.',
    priceMinor: 699, currency: 'USD', contents: [cosmetic('broadcast_latenight', 'Late Night broadcast package')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'FEATURED', accent: '#9B5DE5',
  },
  {
    sku: 'tokens_small', name: 'Pocket of Tokens', rotationWeek: 1,
    description: 'A small token bundle. Tokens buy cosmetics and convenience, never advantage.',
    priceMinor: 199, currency: 'USD', contents: [premium(120)],
    startCycle: null, endCycle: null, purchaseLimit: null, discountPercent: 0,
    treatment: 'STANDARD', accent: '#C8FF2E',
  },
  {
    sku: 'manager_look_touchline', name: 'Touchline Wardrobe', rotationWeek: 1,
    description: 'Eight outfits, four accessories. Your manager will look considerably more employable.',
    priceMinor: 449, currency: 'USD', contents: [cosmetic('manager_wardrobe_touchline', 'Touchline wardrobe')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#7C8CFF',
  },
  {
    sku: 'scout_credits_5', name: 'Scouting Credits ×5', rotationWeek: 1,
    description: 'Five credits toward reports you could complete anyway, sooner. Convenience only.',
    priceMinor: 299, currency: 'USD', contents: [scoutCredit(5)],
    startCycle: null, endCycle: null, purchaseLimit: null, discountPercent: 0,
    treatment: 'STANDARD', accent: '#1D6FA8',
  },

  /* ------------------------------------------------------------- week 2 */
  {
    sku: 'kit_neon_gradient', name: 'Gradient Away Kit', rotationWeek: 2,
    description: 'A full-bleed gradient shirt for clubs who have decided subtlety is somebody else\'s problem.',
    priceMinor: 499, currency: 'USD', contents: [cosmetic('kit_neon_gradient', 'Gradient away kit')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#FF2FA0',
  },
  {
    sku: 'tifo_pack_terrace', name: 'Terrace Tifo Pack', rotationWeek: 2,
    description: 'Four animated crowd displays that fire on big fixtures. Visual only.',
    priceMinor: 599, currency: 'USD', contents: [cosmetic('tifo_pack_terrace', 'Terrace tifo pack')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'FEATURED', accent: '#F2A413',
  },
  {
    sku: 'stadium_skin_floodlit', name: 'Floodlit Ground Skin', rotationWeek: 2,
    description: 'Re-dresses your ground for evening fixtures. Same capacity, same everything, better night.',
    priceMinor: 649, currency: 'USD', contents: [cosmetic('stadium_skin_floodlit', 'Floodlit ground skin')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#F0B429',
  },
  {
    sku: 'tokens_medium', name: 'Handful of Tokens', rotationWeek: 2,
    description: 'A mid-size token bundle with a small bonus.',
    priceMinor: 499, currency: 'USD', contents: [premium(340)],
    startCycle: null, endCycle: null, purchaseLimit: null, discountPercent: 10,
    treatment: 'STANDARD', accent: '#C8FF2E',
  },
  {
    sku: 'celebration_pack_classic', name: 'Celebration Pack: Classic', rotationWeek: 2,
    description: 'Six goal celebrations, including the one where nobody celebrates at all.',
    priceMinor: 349, currency: 'USD', contents: [cosmetic('celebration_classic', 'Classic celebration pack')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#34d399',
  },
  {
    sku: 'lore_pack_league_history', name: 'League History Archive', rotationWeek: 2,
    description: 'Written content: forty years of invented league history, records and photographs to read at your leisure.',
    priceMinor: 399, currency: 'USD', contents: [cosmetic('lore_league_history', 'League history archive')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#B9C2CE',
  },

  /* ------------------------------------------------------------- week 3 */
  {
    sku: 'kit_hoops_saltglass', name: 'Saltglass Hooped Kit', rotationWeek: 3,
    description: 'Wide hoops in a washed sea palette. Looks better in the rain, which is convenient.',
    priceMinor: 499, currency: 'USD', contents: [cosmetic('kit_hoops_saltglass', 'Saltglass hooped kit')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#1D6FA8',
  },
  {
    sku: 'broadcast_pack_minimal', name: 'Minimal Broadcast Package', rotationWeek: 3,
    description: 'Thin type, no music, almost no graphics. For people who find the normal presentation loud.',
    priceMinor: 699, currency: 'USD', contents: [cosmetic('broadcast_minimal', 'Minimal broadcast package')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#F7F9FC',
  },
  {
    sku: 'manager_look_streetwear', name: 'Streetwear Wardrobe', rotationWeek: 3,
    description: 'Ten outfits from the half of this league that has never owned a suit.',
    priceMinor: 449, currency: 'USD', contents: [cosmetic('manager_wardrobe_street', 'Streetwear wardrobe')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#FF2FA0',
  },
  {
    sku: 'tokens_large', name: 'Crate of Tokens', rotationWeek: 3,
    description: 'The large token bundle. Best value; still buys nothing that wins a match.',
    priceMinor: 999, currency: 'USD', contents: [premium(760)],
    startCycle: null, endCycle: null, purchaseLimit: null, discountPercent: 15,
    treatment: 'FEATURED', accent: '#C8FF2E',
  },
  {
    sku: 'scout_credits_15', name: 'Scouting Credits ×15', rotationWeek: 3,
    description: 'Fifteen credits. Pure convenience: it buys time, not information you could not otherwise get.',
    priceMinor: 799, currency: 'USD', contents: [scoutCredit(15)],
    startCycle: null, endCycle: null, purchaseLimit: null, discountPercent: 10,
    treatment: 'STANDARD', accent: '#1D6FA8',
  },
  {
    sku: 'badge_pack_modern', name: 'Modern Badge Set', rotationWeek: 3,
    description: 'Six flat, geometric crest treatments. Two of them are honestly quite ugly, and that is the point.',
    priceMinor: 399, currency: 'USD', contents: [cosmetic('badge_pack_modern', 'Modern badge set')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#1E4FE0',
  },

  /* ------------------------------------------------------------- week 4 */
  {
    sku: 'kit_sash_ember', name: 'Ember Sash Kit', rotationWeek: 4,
    description: 'A single diagonal sash in a colour that was voted on and should not have been.',
    priceMinor: 499, currency: 'USD', contents: [cosmetic('kit_sash_ember', 'Ember sash kit')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#FF9F1C',
  },
  {
    sku: 'bundle_founders', name: 'Founders Bundle', rotationWeek: 4,
    description: 'Two kits, a badge set and a broadcast package, together for less than the parts. Cosmetics only.',
    priceMinor: 1_299, currency: 'USD',
    contents: [
      cosmetic('kit_founders_home', 'Founders home kit'),
      cosmetic('kit_founders_away', 'Founders away kit'),
      cosmetic('badge_pack_founders', 'Founders badge set'),
      cosmetic('broadcast_founders', 'Founders broadcast package'),
    ],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 25,
    treatment: 'LIMITED', accent: '#C9A227',
  },
  {
    sku: 'celebration_pack_chaos', name: 'Celebration Pack: Chaos', rotationWeek: 4,
    description: 'Six celebrations of escalating poor judgement, including one that will get you booked.',
    priceMinor: 349, currency: 'USD', contents: [cosmetic('celebration_chaos', 'Chaos celebration pack')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#f4525a',
  },
  {
    sku: 'tokens_small_repeat', name: 'Pocket of Tokens', rotationWeek: 4,
    description: 'The small token bundle, back on the shelf.',
    priceMinor: 199, currency: 'USD', contents: [premium(120)],
    startCycle: null, endCycle: null, purchaseLimit: null, discountPercent: 0,
    treatment: 'STANDARD', accent: '#C8FF2E',
  },
  {
    sku: 'stadium_skin_winter', name: 'Winter Ground Skin', rotationWeek: 4,
    description: 'Frost on the roof, breath in the air, a thinner crowd on the far side. Visual only.',
    priceMinor: 649, currency: 'USD', contents: [cosmetic('stadium_skin_winter', 'Winter ground skin')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'STANDARD', accent: '#B9C2CE',
  },
  {
    sku: 'lore_pack_creator_files', name: 'The Creator Files', rotationWeek: 4,
    description: 'Long-form written profiles of all twenty-eight league creators, including four they would rather you did not read.',
    priceMinor: 399, currency: 'USD', contents: [cosmetic('lore_creator_files', 'The Creator Files')],
    startCycle: null, endCycle: null, purchaseLimit: 1, discountPercent: 0,
    treatment: 'FEATURED', accent: '#9B5DE5',
  },
];

export const BASE_OFFER_SKUS: readonly string[] = BASE_OFFERS.map((o) => o.sku);
