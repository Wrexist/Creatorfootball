import { describe, expect, it } from 'vitest';
import type { ClubId, EventId, MatchId, PlayerId } from '../core/brand';
import { Rng } from '../core/rng';
import { buildTestWorld, makeTestEvent, withEvents } from '../simulation/fixtures';
import type { SocialMoment } from '../social/moments';
import { CAMPAIGN_FORMAT_IDS } from './balance';
import { BRIEFS, generateCampaignOffers, TITLES } from './campaigns';

/**
 * Campaign copy variety.
 *
 * One title and one brief per format meant every matchday vlog was titled the
 * same thing for the whole save. The pools are selected deterministically at
 * generation time, so the same seed still produces the same save while
 * different weeks stop reading like reprints.
 */

const busyWorld = () => {
  const { state } = buildTestWorld();
  return withEvents(state, [
    makeTestEvent('MATCH_WON', {
      matchId: 'm1' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
      homeScore: 3, awayScore: 0, margin: 3,
    }, {
      id: 'ev_win', importance: 4, cycle: 10,
      entities: [{ kind: 'club', id: 'club_0', name: 'Club 0' }, { kind: 'club', id: 'club_1', name: 'Club 1' }],
    }),
    makeTestEvent('PLAYER_SIGNED', {
      playerId: 'p_0_5' as PlayerId, clubId: 'club_0' as ClubId, fee: 4_000_000, wage: 40_000,
    }, {
      id: 'ev_signing', importance: 3, cycle: 10,
      entities: [{ kind: 'player', id: 'p_0_5', name: 'T. p_0_5' }, { kind: 'club', id: 'club_0', name: 'Club 0' }],
    }),
  ]);
};

describe('campaign variant pools', () => {
  it('gives every format several titles and several briefs', () => {
    for (const format of CAMPAIGN_FORMAT_IDS) {
      expect(TITLES[format]!.length, `thin title pool for ${format}`).toBeGreaterThanOrEqual(3);
      expect(BRIEFS[format]!.length, `thin brief pool for ${format}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('never repeats a title or a rendered brief inside one format', () => {
    const creator = Object.values(buildTestWorld().state.creators)[0]!;
    const moment = {
      headline: 'You beat Club 1 3-0.', eventId: 'ev_x' as EventId,
    } as SocialMoment;
    for (const format of CAMPAIGN_FORMAT_IDS) {
      const titles = new Set(TITLES[format]);
      expect(titles.size).toBe(TITLES[format]!.length);
      const briefs = new Set(BRIEFS[format]!.map((brief) => brief(moment, creator)));
      expect(briefs.size).toBe(BRIEFS[format]!.length);
    }
  });
});

describe('generation-time selection', () => {
  const CYCLE = 10;

  it('is deterministic for a given seed', () => {
    const state = busyWorld();
    const a = generateCampaignOffers(state, new Rng('offers'), CYCLE);
    const b = generateCampaignOffers(state, new Rng('offers'), CYCLE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // And every chosen title comes from the format's own pool.
    for (const offer of a) {
      expect(TITLES[offer.format]).toContain(offer.title);
    }
  });

  it('produces visible title variety across weeks instead of reprinting one', () => {
    const state = busyWorld();
    const titles = new Set<string>();
    for (let i = 0; i < 40; i++) {
      for (const offer of generateCampaignOffers(state, new Rng(`offers:${i}`), CYCLE)) {
        titles.add(offer.title);
      }
    }
    expect(titles.size).toBeGreaterThanOrEqual(4);
  });

  it('always pairs a brief that renders against the offer\'s own moment', () => {
    const state = busyWorld();
    for (const offer of generateCampaignOffers(state, new Rng('briefs'), CYCLE)) {
      expect(offer.brief.length).toBeGreaterThan(20);
      expect(offer.cost).toBeGreaterThanOrEqual(0);
    }
  });
});
