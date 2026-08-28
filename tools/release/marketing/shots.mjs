/**
 * The eight App Store marketing frames, in conversion-ranked order.
 *
 * Copy leans on what actually makes this game different from every other
 * football manager on the store: the creator/influencer economy sitting on
 * top of the football. `source` names a capture in tools/release/store-shots/
 * produced by `pnpm shots:store` — the phone in each frame shows the real
 * product, which App Review guideline 2.3.1 requires.
 */
export const SHOTS = [
  { id: '01_matchday', source: '01_matchday_decision', eyebrow: 'LIVE MATCHDAY',
    line1: 'Two-all.', line2: 'One call.',
    sub: 'Timed decisions, taken live, that decide your season.',
    badge: '15s TO DECIDE', pill: 'Decide, or the bench does', emoji: ['⚡', '\u{1F525}'] },

  { id: '02_home', source: '02_home', eyebrow: 'YOUR CLUB',
    line1: 'Run the club.', line2: 'All of it.',
    sub: 'Fixtures, form, and everyone who wants something from you.',
    badge: 'MATCHWEEK 17', pill: '3 decisions waiting', emoji: ['\u{1F4CB}', '⭐'] },

  { id: '03_market', source: '03_market', eyebrow: 'TRANSFER MARKET',
    line1: 'Sign the striker.', line2: 'Or the streamer.',
    sub: 'Footballers and creators, competing for the same shirt.',
    badge: 'DEAL AGREED', pill: 'Reach +2.4M', emoji: ['\u{1F4B0}', '\u{1F3AC}'] },

  { id: '04_pitch', source: '04_pitch_live', eyebrow: 'WATCH IT UNFOLD',
    line1: 'Every match,', line2: 'played out.',
    sub: 'A real simulation you can actually sit and watch.',
    badge: '1–1 · 6′', pill: 'Momentum 62%', emoji: ['⚽', '\u{1F4C8}'] },

  { id: '05_social', source: '05_social', eyebrow: 'THE FEED',
    line1: 'They’re talking', line2: 'about you.',
    sub: 'Creators, rivals and press react to how you actually play.',
    badge: '180 POSTS', pill: 'The rivals are watching', emoji: ['\u{1F4F1}', '\u{1F525}'] },

  { id: '06_league', source: '06_league', eyebrow: 'THE SEASON',
    line1: 'Twenty-two games.', line2: 'One champion.',
    sub: 'Climb the Creator League and then stay there.',
    badge: 'TOP OF THE TABLE', pill: 'Six games to hold on', emoji: ['\u{1F3C6}', '\u{1F451}'] },

  { id: '07_training', source: '07_training', eyebrow: 'SQUAD & TRAINING',
    line1: 'Build them', line2: 'your way.',
    sub: 'Develop wonderkids. Shape the XI nobody expected.',
    badge: '+4 POTENTIAL', pill: 'Sharpness 94%', emoji: ['\u{1F4AA}', '✨'] },

  { id: '08_club', source: '08_club', eyebrow: 'YOUR IDENTITY',
    line1: 'Build something', line2: 'they remember.',
    sub: 'Badge, kit, culture — a club that is unmistakably yours.',
    badge: 'FANBASE +18%', pill: 'Your badge, your rules', emoji: ['\u{1F6E1}️', '\u{1F48E}'] },
];

/**
 * Apple's marketing sizes. Logical size x DPR lands exactly on the pixel size
 * App Store Connect expects, so nothing is ever resampled after the fact.
 */
export const SIZES = [
  { key: 'iphone-6.9', w: 1290, h: 2796, css: { width: 430, height: 932 }, dpr: 3, kind: 'phone' },
  { key: 'iphone-6.5', w: 1284, h: 2778, css: { width: 428, height: 926 }, dpr: 3, kind: 'phone' },
  { key: 'ipad-13',    w: 2064, h: 2752, css: { width: 1032, height: 1376 }, dpr: 2, kind: 'tablet' },
];
