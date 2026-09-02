import type { ClubId, SeasonId, PlayerId } from '../core/brand';
import { asId } from '../core/brand';
import type { GameState, SeasonSummary } from './state';
import type { AnyDomainEvent } from '../core/events';
import type { Season, Fixture } from '../league/types';
import type { Rng } from '../core/rng';
import type { Ledger } from '../economy/ledger';
import { clamp } from '../core/math';
import { generateFixtures } from '../league/fixtures';
import { computeStandings } from '../league/standings';
import { summariseSeason } from '../progression/legacy';
import { emptyRecord } from '../clubs/club';
import { patchClub, patchPlayer, transferPlayer, setPlayer } from './mutations';
import { generatePlayer } from '../content/generators/playerGenerator';
import { generateCreator } from '../content/generators/creatorGenerator';
import { CREATOR_TIERS } from '../creators/creator';
import { CREATOR_BALANCE } from '../creators/balance';
import { facilityEffect } from '../facilities/facilities';
import type { ContentRegistry } from '../content';
import type { GameEventFactory } from './eventFactory';

/**
 * The end of a season, and the start of the next one.
 *
 * Without this the game simply stops: the fixture list runs out, the clock
 * keeps counting weeks that contain no football, and the world decays — clubs
 * shed players they never replace, sponsorship lapses with nothing to renew
 * against, and reputation drains toward zero. Every claim the product makes
 * about a dynasty depends on this function existing.
 *
 * Order matters here as much as it does inside a cycle: the table must be read
 * before records are cleared, prize money must be paid against the standings
 * that earned it, and the new fixture list must be built after promotions and
 * retirements have settled the squads that will play it.
 */

/**
 * Age past which a player may retire rather than decline further.
 *
 * Set against the intake so the league's population stays roughly stable. A
 * twelve-club league of eighteen-man squads holds ~216 players, and a career
 * lasting a dozen years means turning over roughly eighteen of them a season.
 * Retiring only from 34 produced about six a season against an intake of
 * thirty-four, and the world inflated toward five hundred players.
 */
const RETIREMENT_AGE = 31;
/** Ability below which an ageing player is more likely to stop. */
const RETIREMENT_ABILITY = 68;

export interface RolloverResult {
  readonly state: GameState;
  readonly events: readonly AnyDomainEvent[];
  readonly summary: SeasonSummary;
  readonly championClubId: ClubId | null;
  readonly retired: readonly PlayerId[];
  readonly promoted: readonly PlayerId[];
}

export function rolloverSeason(
  state: GameState,
  rng: Rng,
  ledger: Ledger,
  events: GameEventFactory,
  opts: { now: number; registry: ContentRegistry },
): RolloverResult {
  let next = state;
  const emitted: AnyDomainEvent[] = [];
  const competition = state.competitions[state.currentCompetitionId];
  const season = state.seasons[state.currentSeasonId];

  // --- 1. read the table before anything clears it ----------------------
  const clubIds = competition?.clubIds ?? (Object.keys(state.clubs) as ClubId[]);
  const table = computeStandings(
    clubIds,
    Object.values(state.fixtures).filter((f) => f.seasonId === state.currentSeasonId),
    {
      playoffSpots: competition?.playoffSpots ?? 4,
      relegationSpots: competition?.relegationSpots ?? 2,
    },
  );
  const champion = table[0]?.clubId ?? null;
  const playerPosition = table.findIndex((r) => r.clubId === state.playerClubId) + 1;
  const summary = summariseSeason(next);

  // --- 2. prize money, paid against the table that earned it ------------
  const prizes = competition?.prizeMoney ?? [];
  table.forEach((row, index) => {
    const prize = prizes[index] ?? prizes[prizes.length - 1] ?? 0;
    if (prize <= 0) return;
    ledger.credit(row.clubId, 'PRIZE_MONEY', prize,
      `${competition?.name ?? 'League'} — finished ${index + 1}`,
      { cycle: state.clock.cycle, season: state.clock.season, at: opts.now },
      // A season can only pay out once, however many times this runs.
      { idempotencyKey: `prize:${state.currentSeasonId}:${row.clubId}` });
  });

  if (champion) {
    emitted.push(events.make('TROPHY_WON', {
      clubId: champion,
      competition: competition?.name ?? 'League',
      season: state.clock.season,
    }, { importance: 5, entities: [events.clubRef(champion)] }));
  }

  emitted.push(events.make('SEASON_COMPLETED', {
    seasonId: state.currentSeasonId,
    season: state.clock.season,
    championClubId: champion ?? state.playerClubId,
    playerPosition: playerPosition > 0 ? playerPosition : table.length,
  }, { importance: 5 }));

  // --- 3. everyone gets a year older ------------------------------------
  const retired: PlayerId[] = [];
  const ageRng = rng.fork('ageing');

  for (const player of Object.values(state.players)) {
    const age = player.age + 1;

    // Retirement is likelier the older and the weaker he is. A 35-year-old
    // still playing at 80 keeps going; a 35-year-old at 60 does not.
    const overAge = Math.max(0, age - RETIREMENT_AGE);
    const abilityGap = Math.max(0, RETIREMENT_ABILITY - player.overall) / 40;
    const retireChance = clamp(overAge * 0.16 + abilityGap * overAge * 0.34, 0, 0.95);

    if (age > RETIREMENT_AGE && ageRng.chance(retireChance)) {
      retired.push(player.id);
      if (player.clubId) {
        emitted.push(events.make('PLAYER_RELEASED', {
          playerId: player.id,
          clubId: player.clubId,
        }, { importance: player.overall >= 74 ? 4 : 1, entities: [events.playerRef(player.id)] }));
      }
      next = transferPlayer(next, player.id, null);
      if (player.contractId) {
        const remaining = { ...next.contracts };
        delete remaining[player.contractId];
        next = { ...next, contracts: remaining };
      }
      // Leave the world entirely. Simply unemploying him kept every player who
      // ever retired in the save forever: the pool grew without bound and the
      // free-agent list filled with men who had stopped playing. Posts and
      // stories carry denormalised names, so nothing dangles.
      const withoutPlayer = { ...next.players };
      delete withoutPlayer[player.id];
      next = { ...next, players: withoutPlayer };
      continue;
    }

    next = patchPlayer(next, player.id, {
      age,
      // A fresh pre-season: everyone starts fit, and last year's form is gone.
      fitness: 100,
      suspensionMatches: 0,
      injury: null,
      form: { ...player.form, recentRatings: [], rating: player.form.rating * 0.4 },
      history: [
        ...player.history,
        {
          ...player.form,
          season: state.clock.season,
          clubId: player.clubId,
          averageRating:
            player.form.recentRatings.length > 0
              ? player.form.recentRatings.reduce((a, b) => a + b, 0) / player.form.recentRatings.length
              : 0,
          motm: 0,
        },
      ].slice(-12),
    });
  }

  // Season stats reset only after they have been folded into history.
  for (const player of Object.values(next.players)) {
    next = patchPlayer(next, player.id, {
      form: {
        rating: next.players[player.id]?.form.rating ?? 0,
        recentRatings: [],
        appearances: 0, goals: 0, assists: 0, cleanSheets: 0,
        yellowCards: 0, redCards: 0, minutes: 0,
      },
    });
  }

  // --- 4. the academy graduates -----------------------------------------
  const promoted: PlayerId[] = [];
  for (const club of Object.values(next.clubs)) {
    const ready = club.youthSquad
      .map((id) => next.players[id])
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .filter((p) => p.age >= 18 && p.overall >= 55)
      .sort((a, b) => b.potential - a.potential)
      .slice(0, 2);

    for (const prospect of ready) {
      next = transferPlayer(next, prospect.id, club.id);
      promoted.push(prospect.id);
      emitted.push(events.make('YOUTH_PROSPECT_PROMOTED', {
        playerId: prospect.id,
        clubId: club.id,
      }, { importance: 2, entities: [events.playerRef(prospect.id), events.clubRef(club.id)] }));
    }
  }

  const nextNumber = state.clock.season + 1;

  // --- 4b. the new intake ----------------------------------------------
  // Retirement removes players from the world permanently. Without an intake
  // to replace them the league runs out of footballers: after three seasons
  // clubs could not fill a squad because there was nobody left to sign. Every
  // club takes on a small academy group each summer, and a better academy
  // produces better prospects — which is what makes that facility worth money.
  const intakeRng = rng.fork('intake');
  const nameBank = opts.registry.nameBank();

  for (const club of Object.values(next.clubs)) {
    const academy = facilityEffect(club, 'youthQuality', opts.registry);
    // Roughly one and a half per club, which balances the retirement rate above.
    const intakeSize = 1 + (intakeRng.chance(0.45 + academy * 0.45) ? 1 : 0);
    const takenNumbers = [...club.squad, ...club.youthSquad]
      .map((id) => next.players[id]?.shirtNumber)
      .filter((n): n is number => typeof n === 'number');

    for (let i = 0; i < intakeSize; i++) {
      const prospect = generatePlayer(intakeRng, {
        targetOverall: clamp(42 + academy * 12 + intakeRng.normal(0, 4), 32, 62),
        ageRange: [16, 18],
        clubId: club.id,
        potentialBias: clamp(0.25 + academy * 0.5, -1, 1),
        allowWonderkid: true,
        idPrefix: `y${nextNumber}_${club.id}_${i}`,
        takenShirtNumbers: takenNumbers,
        nameBank,
      });
      next = setPlayer(next, prospect);
      next = patchClub(next, club.id, (c) => ({ youthSquad: [...c.youthSquad, prospect.id] }));
    }
  }

  // --- 4c. the creator scene turns over ---------------------------------
  // Players regenerate yearly; until now the pundits did not, so the pundit
  // scene froze on day one while the world it commented on replaced itself.
  // Every summer a handful of new voices arrive through the ordinary
  // generator, and small local accounts whose moment has passed leave it.
  // Both directions are real domain events, like everything else here.
  const LC = CREATOR_BALANCE.lifecycle;
  const lifeRng = rng.fork('creatorLifecycle');
  const handles = new Set(Object.values(next.creators).map((c) => c.handle.toLowerCase()));

  const spawnCount = lifeRng.int(LC.spawnsMin, LC.spawnsMax);
  for (let i = 0; i < spawnCount; i++) {
    const tier = lifeRng.weighted(CREATOR_TIERS, (_t, idx) => LC.spawnTierWeights[CREATOR_TIERS[idx]!]);
    let creator = generateCreator(lifeRng.fork(`spawn:${i}`), {
      tier,
      idPrefix: `gc${nextNumber}_${i}`,
      spawnedSeason: nextNumber,
      nameBank,
    });
    // A player label without a player behind it is a UI lie; fresh voices are
    // media faces, not squad members.
    const roles = creator.roles.includes('PLAYER') ? (['INFLUENCER'] as const) : creator.roles;
    if (handles.has(creator.handle.toLowerCase())) {
      creator = { ...creator, handle: `${creator.handle}${nextNumber}` };
    }
    handles.add(creator.handle.toLowerCase());
    creator = { ...creator, roles };
    next = { ...next, creators: { ...next.creators, [creator.id]: creator } };
    emitted.push(events.make('CREATOR_EMERGED', {
      creatorId: creator.id,
      displayName: creator.displayName,
      followers: creator.followers,
    }, { importance: 2, entities: [{ kind: 'creator', id: creator.id, name: creator.displayName }] }));
  }

  const retiring = Object.values(next.creators)
    .filter((c) => c.tier === 'LOCAL'
      && c.spawnedSeason !== undefined
      && !c.playerId
      && nextNumber - c.spawnedSeason >= LC.localSpanSeasons)
    .sort((a, b) => a.followers - b.followers);
  for (const spent of retiring) {
    const remaining = { ...next.creators };
    delete remaining[spent.id];
    next = { ...next, creators: remaining };
    emitted.push(events.make('CREATOR_RETIRED', {
      creatorId: spent.id,
      displayName: spent.displayName,
      followers: spent.followers,
      seasonsActive: nextNumber - (spent.spawnedSeason ?? nextNumber),
    }, { importance: 1, entities: [{ kind: 'creator', id: spent.id, name: spent.displayName }] }));
  }

  // --- 5. clubs reset, and their standing follows what they achieved ----
  // Simply being in the division is worth something, and no single bad season
  // should be able to start an unrecoverable slide.
  const LEAGUE_REPUTATION_FLOOR = 22;

  next = Object.values(next.clubs).reduce((acc, club) => {
    const row = table.find((r) => r.clubId === club.id);
    const position = row?.position ?? table.length;
    const half = Math.max(1, table.length / 2);

    // Reputation moves toward what this season's finish deserves rather than
    // accumulating without limit. An earlier version applied a flat delta of up
    // to nine points a season, which meant a club that finished bottom twice
    // fell to the floor, stopped qualifying for any sponsor, lost its income
    // and could never climb back — a death spiral disguised as a difficulty
    // curve. Mean reversion keeps a bad run painful but survivable.
    const deserved = clamp(LEAGUE_REPUTATION_FLOOR + ((half - position) / half) * 34 + 24, 1, 100);
    const moved = club.reputation + (deserved - club.reputation) * 0.28;

    return patchClub(acc, club.id, {
      seasonRecord: emptyRecord(),
      reputation: clamp(moved, LEAGUE_REPUTATION_FLOOR, 100),
    });
  }, next);

  // --- 6. next season's calendar ----------------------------------------
  // Scoped to this career, like every other id it creates. A career made
  // before tokens existed carries its seed here, so its later seasons are
  // still distinct from another career's.
  const nextSeasonId = asId<SeasonId>(`${state.idToken}_season_${nextNumber}`);
  const totalWeeks = (clubIds.length - 1) * (competition?.rounds ?? 2);

  const rivalPairs: (readonly [ClubId, ClubId])[] = Object.values(next.rivalries)
    .map((r) => [r.clubAId, r.clubBId] as const);

  const fixtureList = generateFixtures(
    {
      competitionId: state.currentCompetitionId,
      seasonId: nextSeasonId,
      clubIds,
      rounds: competition?.rounds ?? 2,
      rivalPairs,
      enabledSpecialRules: competition?.enabledSpecialRules ?? [],
      specialRuleWeeks: [3, 7, 11, 15, 19, totalWeeks],
    },
    rng.fork(`fixtures:${nextNumber}`),
  );

  // Keep only the season just gone, so a twenty-season save does not carry
  // every fixture it has ever played.
  const fixtures: Record<string, Fixture> = {};
  for (const fixture of Object.values(next.fixtures)) {
    if (fixture.seasonId === state.currentSeasonId) fixtures[fixture.id] = fixture;
  }
  for (const fixture of fixtureList) fixtures[fixture.id] = fixture;

  const newSeason: Season = {
    id: nextSeasonId,
    number: nextNumber,
    competitionId: state.currentCompetitionId,
    totalWeeks,
    currentWeek: 0,
    phase: 'PRE_SEASON',
    completed: false,
    championClubId: null,
    playerFinalPosition: null,
  };

  const closedSeason: Season | undefined = season
    ? {
        ...season,
        completed: true,
        championClubId: champion,
        playerFinalPosition: playerPosition > 0 ? playerPosition : null,
      }
    : undefined;

  next = {
    ...next,
    fixtures,
    seasons: {
      ...(closedSeason ? { ...next.seasons, [closedSeason.id]: closedSeason } : next.seasons),
      [nextSeasonId]: newSeason,
    },
    currentSeasonId: nextSeasonId,
    clock: {
      cycle: next.clock.cycle,
      season: nextNumber,
      week: 0,
      phase: 'PRE_SEASON',
      updatedAt: opts.now,
    },
    legacy: {
      ...next.legacy,
      seasonSummaries: [...next.legacy.seasonSummaries, summary].slice(-30),
      trophies: champion === state.playerClubId
        ? [...next.legacy.trophies, {
            competition: competition?.name ?? 'League',
            season: state.clock.season,
            clubId: state.playerClubId,
          }]
        : next.legacy.trophies,
    },
    // Season objectives belong to the season that set them.
    objectives: {
      active: next.objectives.active.filter((o) => o.source !== 'SEASON'),
      completed: [...next.objectives.completed, ...next.objectives.active.filter((o) => o.status === 'COMPLETED')].slice(-60),
      seasonTargets: [],
    },
    transfers: { ...next.transfers, windowOpen: true },
  };

  emitted.push(events.make('SEASON_STARTED', {
    seasonId: nextSeasonId,
    season: nextNumber,
  }, { importance: 4 }));

  return { state: next, events: emitted, summary, championClubId: champion, retired, promoted };
}
