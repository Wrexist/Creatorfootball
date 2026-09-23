export const PRODUCT_IDS = ['cf_club_nights', 'cf_heritage_collection', 'cf_creator_stories'] as const;
export type ProductId = typeof PRODUCT_IDS[number];
export const PRODUCTS = [
  { id: 'cf_club_nights', name: 'Club Nights', art: 'environment.stadium-night',
    description: 'Three evening lighting looks for your interactive 3D stadium: floodlit, sunset and creator night.',
    contents: ['Three 3D lighting presets', 'Reusable across every local career'], packId: 'club-nights' },
  { id: 'cf_heritage_collection', name: 'Heritage Collection', art: 'kit.home',
    description: 'Three original shirt patterns and two trophy finishes for the 3D club collection.',
    contents: ['Sash, hoops and pinstripe shirt models', 'Antique gold and silver trophy finishes'], packId: 'heritage-collection' },
  { id: 'cf_creator_stories', name: 'Creator Stories', art: 'environment.media-studio',
    description: 'Original commentary and event-backed media stories that follow your real matches, signings and press decisions.',
    contents: ['16 match commentary lines', '12 event-backed media story templates'], packId: 'creator-stories' },
] as const satisfies readonly { id: ProductId; name: string; art: string; description: string; contents: readonly string[]; packId: string }[];
export function isProductId(id: string): id is ProductId { return PRODUCT_IDS.some(known => known === id); }
