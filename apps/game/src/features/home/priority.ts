import {
  claimableObjectives, clubById, contractFor, expiringContracts, injuredPlayers, lastFixture,
  leaguePosition, nextFixture, playerById, playerClub, recentForm, rivalryFor, squadOf, standings,
  starPlayer, suspendedPlayers, wageBudgetUsage,
  type Club, type Fixture, type GameState, type Objective, type Player, type StandingRow,
} from '@cf/engine';

/**
 * The home screen's priority engine.
 *
 * Home must never be a fixed dashboard. The same six panels every week is what
 * makes a management game feel like admin: the screen should re-prioritise
 * itself as the season moves, so that an injury crisis, a derby, a closing
 * transfer window and a title run-in each produce a visibly different page.
 *
 * Rather than hand-authoring a layout per scenario — which does not scale and
 * always misses the case nobody thought of — every candidate is scored on four
 * independent axes and the top few are rendered:
 *
 *   urgency     how soon this stops being actionable. A contract with two weeks
 *               left is urgent; a mid-table position is not.
 *   importance  how much it changes the season if handled or ignored.
 *   novelty     how new it is. Everything decays: the same warning shown for
 *               six weeks running has stopped being information.
 *   emotion     how much a supporter would actually *feel* it. A rival signing
 *               a striker is not urgent and barely important, but it matters.
 *
 * IMPORTANT: nothing here simulates or derives a game outcome. Every number is
 * read from an engine selector (`standings`, `leaguePosition`, `topConcern`,
 * `recentForm`, `wageBudgetUsage`, …) or straight off state. This module only
 * decides *which truths get the player's attention this week*, and phrases them
 * in plain language.
 */

/* --- shape ------------------------------------------------------------ */

export type Tone = 'volt' | 'danger' | 'warning' | 'positive' | 'neutral';

/** Icon identities, resolved to components by the screen — this file stays TS. */
export type Glyph =
  | 'injury' | 'contract' | 'money' | 'fans' | 'trophy' | 'market' | 'star' | 'flame'
  | 'calendar' | 'ball' | 'warning' | 'social' | 'scout' | 'league' | 'training';

/** Which part of the game a card belongs to — used to keep the feed varied. */
export type Family = 'SQUAD' | 'LEAGUE' | 'MARKET' | 'CLUB' | 'WORLD';

export interface PriorityScore {
  readonly urgency: number;
  readonly importance: number;
  readonly novelty: number;
  readonly emotion: number;
  readonly total: number;
}

export interface PriorityCard {
  readonly id: string;
  readonly family: Family;
  readonly tone: Tone;
  readonly glyph: Glyph;
  /** What happened. Sentence case, plain language, never jargon. */
  readonly headline: string;
  /** Why the player should care, in one line they do not have to decode. */
  readonly meaning: string;
  readonly actionLabel: string;
  readonly route: string;
  readonly score: PriorityScore;
  /** Renders the player's face and name inline as evidence. */
  readonly playerId?: string;
  readonly progress?: { readonly value: number; readonly max: number; readonly label: string };
  /** A single figure worth showing large next to the headline. */
  readonly metric?: { readonly value: string; readonly caption: string };
}

export interface Beat {
  readonly id: string;
  readonly glyph: Glyph;
  readonly tone: Tone;
  readonly text: string;
}

export type Lead =
  | {
    readonly kind: 'RESULT';
    readonly fixture: Fixture;
    readonly opponent: Club;
    readonly us: number;
    readonly them: number;
    readonly outcome: 'W' | 'D' | 'L';
    readonly headline: string;
    readonly meaning: string;
    readonly matchId: string | null;
  }
  | {
    readonly kind: 'MATCH';
    readonly fixture: Fixture;
    readonly opponent: Club;
    readonly home: boolean;
    /** "Win and you move into the playoffs." Always a full sentence. */
    readonly stake: string;
    readonly beats: readonly Beat[];
  }
  | {
    readonly kind: 'IDLE';
    readonly headline: string;
    readonly meaning: string;
    readonly actionLabel: string;
    readonly route: string;
  };

export interface HomeFeed {
  readonly club: Club;
  readonly lead: Lead;
  /** The next fixture, even when the lead is a result — the primary action. */
  readonly upcoming: { readonly fixture: Fixture; readonly opponent: Club; readonly home: boolean } | null;
  readonly cards: readonly PriorityCard[];
  /** Everything scored, for the "show all" affordance and for debugging. */
  readonly allCards: readonly PriorityCard[];
}

/* --- scoring ---------------------------------------------------------- */

const W = { urgency: 0.32, importance: 0.30, novelty: 0.14, emotion: 0.24 };

/** Below this a card is not worth a slot; the screen is better off shorter. */
const FLOOR = 0.26;
const MAX_CARDS = 5;
/** Two from any one part of the game — otherwise a bad week is six squad cards. */
const MAX_PER_FAMILY = 2;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

const score = (urgency: number, importance: number, novelty: number, emotion: number): PriorityScore => {
  const u = clamp01(urgency);
  const i = clamp01(importance);
  const n = clamp01(novelty);
  const e = clamp01(emotion);
  return { urgency: u, importance: i, novelty: n, emotion: e, total: u * W.urgency + i * W.importance + n * W.novelty + e * W.emotion };
};

/** Novelty decays over roughly six cycles, floored so old news is not invisible. */
const freshness = (cycle: number, since: number): number => clamp01(1 - (cycle - since) / 6);

/* --- language --------------------------------------------------------- */

const ordinal = (n: number): string => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

const ZONE_WORD: Record<StandingRow['zone'], string> = {
  CHAMPION: 'the title places',
  PLAYOFF: 'the playoff places',
  MID: 'mid-table',
  RELEGATION: 'the drop zone',
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

function streakWord(form: readonly ('W' | 'D' | 'L')[]): { run: number; kind: 'W' | 'D' | 'L' } | null {
  if (form.length < 3) return null;
  const last = form[form.length - 1];
  if (!last) return null;
  let run = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === last; i--) run++;
  return run >= 3 ? { run, kind: last } : null;
}

/**
 * What is actually at stake in the next match, said the way a commentator would.
 * Read entirely from the table: the zone of the club immediately above is what
 * turns "3 points behind" into "win and you move into the playoffs".
 */
function stakeLine(state: GameState, fixture: Fixture, opponent: Club, club: Club): string {
  const table = standings(state);
  const context = leaguePosition(state);
  const played = table.find((r) => r.clubId === club.id)?.played ?? 0;

  if (fixture.isDerby) {
    return `It is the derby. ${opponent.shortName} away days are the ones your supporters remember.`;
  }
  if (!context || played === 0) {
    return `First points of the season are on the table against ${opponent.shortName}.`;
  }

  const index = table.findIndex((r) => r.clubId === club.id);
  const above = index > 0 ? table[index - 1] : undefined;
  const below = index < table.length - 1 ? table[index + 1] : undefined;

  if (above && context.pointsToAbove !== null && context.pointsToAbove <= 3 && above.zone !== context.zone) {
    return `Win and you move into ${ZONE_WORD[above.zone]}.`;
  }
  if (context.zone === 'RELEGATION') {
    return 'You are in the drop zone. Every point from here is survival.';
  }
  if (below && context.pointsFromBelow !== null && context.pointsFromBelow <= 2) {
    const rival = clubById(state, below.clubId);
    return `Lose and ${rival?.shortName ?? ordinal(context.position + 1)} go above you.`;
  }
  if (above && context.pointsToAbove !== null && context.pointsToAbove <= 3) {
    return `A win closes the gap to ${ordinal(context.position - 1)}.`;
  }
  if (context.zone === 'CHAMPION') {
    return 'You are top. Everybody in this league is chasing you.';
  }
  return `Three points would lift you clear in ${ZONE_WORD[context.zone]}.`;
}

/**
 * The two or three lines that make this opponent a *specific* team this week
 * rather than a badge and a name. Everything is read from state, so a beat can
 * never claim something that did not happen.
 */
function matchBeats(state: GameState, fixture: Fixture, us: Club, them: Club): Beat[] {
  const beats: Beat[] = [];
  const rivalry = rivalryFor(state, us.id, them.id);

  if (rivalry && (fixture.isDerby || rivalry.intensity >= 45)) {
    const ourWins = rivalry.clubAId === us.id ? rivalry.aWins : rivalry.bWins;
    const theirWins = rivalry.clubAId === us.id ? rivalry.bWins : rivalry.aWins;
    beats.push({
      id: 'rivalry',
      glyph: 'flame',
      tone: 'volt',
      text: rivalry.meetings > 0
        ? `${rivalry.origin} You have won ${ourWins} of ${rivalry.meetings}, they have won ${theirWins}.`
        : rivalry.origin,
    });
  }

  const signing = state.transfers.completed
    .filter((t) => t.toClubId === them.id && state.clock.cycle - t.cycle <= 6)
    .sort((a, b) => b.fee - a.fee)[0];
  if (signing) {
    const player = playerById(state, signing.playerId);
    if (player) {
      beats.push({
        id: 'signing',
        glyph: 'market',
        tone: 'warning',
        text: `They have just signed ${player.displayName}, a ${player.overall}-rated ${player.position}.`,
      });
    }
  }

  const streak = streakWord(recentForm(state, them.id, 6));
  if (streak) {
    beats.push({
      id: 'streak',
      glyph: 'calendar',
      tone: streak.kind === 'W' ? 'danger' : 'neutral',
      text: streak.kind === 'W'
        ? `They arrive on ${streak.run} straight wins.`
        : streak.kind === 'L'
          ? `They have lost their last ${streak.run}.`
          : `They have drawn their last ${streak.run}.`,
    });
  }

  const danger = starPlayer(state, them.id);
  if (danger) {
    beats.push({
      id: 'danger',
      glyph: 'star',
      tone: 'neutral',
      text: danger.form.goals > 0
        ? `Watch ${danger.displayName}: ${danger.overall} rated, ${danger.form.goals} ${plural(danger.form.goals, 'goal', 'goals')} this season.`
        : `Their best player is ${danger.displayName}, rated ${danger.overall}.`,
    });
  }

  const previous = Object.values(state.fixtures)
    .filter((f) => f.status === 'COMPLETED'
      && ((f.homeClubId === us.id && f.awayClubId === them.id) || (f.homeClubId === them.id && f.awayClubId === us.id)))
    .sort((a, b) => b.week - a.week)[0];
  if (previous && previous.homeScore !== null && previous.awayScore !== null) {
    const home = previous.homeClubId === us.id;
    const ours = home ? previous.homeScore : previous.awayScore;
    const theirs = home ? previous.awayScore : previous.homeScore;
    beats.push({
      id: 'lastmeeting',
      glyph: 'ball',
      tone: ours > theirs ? 'positive' : ours < theirs ? 'danger' : 'neutral',
      text: ours > theirs
        ? `You won the last meeting ${ours}–${theirs}.`
        : ours < theirs
          ? `They won the last meeting ${theirs}–${ours}.`
          : `The last meeting finished ${ours}–${theirs}.`,
    });
  }

  return beats.slice(0, 3);
}

/* --- the lead --------------------------------------------------------- */

/**
 * A result only leads while it is still news — the cycle it happened in. After
 * that the player has read it, and the next fixture takes the screen back.
 */
function freshResult(state: GameState, club: Club): Lead | null {
  const fixture = lastFixture(state, club.id);
  if (!fixture || fixture.homeScore === null || fixture.awayScore === null) return null;

  const event = [...state.eventLog]
    .reverse()
    .find((e) => (e.type === 'MATCH_WON' || e.type === 'MATCH_LOST' || e.type === 'MATCH_DRAWN')
      && e.entities.some((ref) => ref.kind === 'club' && ref.id === club.id));
  if (!event || state.clock.cycle - event.cycle > 0) return null;

  const home = fixture.homeClubId === club.id;
  const us = home ? fixture.homeScore : fixture.awayScore;
  const them = home ? fixture.awayScore : fixture.homeScore;
  const opponent = clubById(state, home ? fixture.awayClubId : fixture.homeClubId);
  if (!opponent) return null;

  const outcome: 'W' | 'D' | 'L' = us > them ? 'W' : us < them ? 'L' : 'D';
  const context = leaguePosition(state);
  const position = context ? `You sit ${ordinal(context.position)} in ${ZONE_WORD[context.zone]}.` : '';

  const headline = outcome === 'W'
    ? `You beat ${opponent.shortName} ${us}–${them}.`
    : outcome === 'L'
      ? `${opponent.shortName} beat you ${them}–${us}.`
      : `${us}–${them} away to nobody's satisfaction against ${opponent.shortName}.`;

  return {
    kind: 'RESULT',
    fixture,
    opponent,
    us,
    them,
    outcome,
    headline: outcome === 'D' ? `You drew ${us}–${them} with ${opponent.shortName}.` : headline,
    meaning: position || 'The table updates as the rest of the league plays.',
    matchId: fixture.matchId,
  };
}

/* --- candidates -------------------------------------------------------- */

function objectiveCard(state: GameState, objective: Objective, claimable: boolean): PriorityCard {
  const ratio = objective.progress / Math.max(1, objective.target);
  const reward = objective.rewards[0];
  const cyclesLeft = objective.expiresCycle === null ? null : objective.expiresCycle - state.clock.cycle;
  return {
    id: `objective:${objective.id}`,
    family: 'CLUB',
    tone: claimable ? 'volt' : 'neutral',
    glyph: 'trophy',
    headline: claimable ? `${objective.title} is done.` : objective.title,
    meaning: claimable
      ? `Collect ${reward ? reward.label.toLowerCase() : 'your reward'} before it lapses.`
      : `${objective.description} ${reward ? `It pays ${reward.label.toLowerCase()}.` : ''}`.trim(),
    actionLabel: claimable ? 'Claim it' : 'See objectives',
    route: claimable ? '/rewards' : '/objectives',
    progress: { value: objective.progress, max: Math.max(1, objective.target), label: `${Math.round(objective.progress)} of ${objective.target}` },
    score: score(
      claimable ? 0.85 : cyclesLeft !== null && cyclesLeft <= 3 ? 0.7 : 0.2 + ratio * 0.3,
      0.3 + objective.importance * 0.12,
      claimable ? 0.9 : 0.35,
      claimable ? 0.6 : 0.25 + ratio * 0.3,
    ),
  };
}

/**
 * Builds every candidate the current state can justify. A candidate that has
 * nothing to say is simply not created — the feed never pads.
 */
function candidates(state: GameState, club: Club): PriorityCard[] {
  const out: PriorityCard[] = [];
  const cycle = state.clock.cycle;
  const squad = squadOf(state, club.id);

  /* --- squad health ------------------------------------------------- */
  const injured = injuredPlayers(state, club.id).sort((a, b) => b.overall - a.overall);
  const suspended = suspendedPlayers(state, club.id);
  const unavailable = injured.length + suspended.length;

  if (injured.length >= 3) {
    const weeks = Math.max(...injured.map((p) => p.injury?.weeksRemaining ?? 0));
    out.push({
      id: 'crisis:injuries',
      family: 'SQUAD',
      tone: 'danger',
      glyph: 'injury',
      headline: `${injured.length} players are in the treatment room.`,
      meaning: `You are picking from ${squad.length - unavailable} fit players. The longest absence is ${weeks} ${plural(weeks, 'week', 'weeks')}.`,
      actionLabel: 'Check the squad',
      route: '/squad',
      metric: { value: String(injured.length), caption: 'out injured' },
      score: score(0.9, 0.55 + Math.min(0.3, injured.length * 0.06), 0.6, 0.6),
    });
  } else {
    const key = injured[0];
    if (key) {
      const weeks = key.injury?.weeksRemaining ?? 0;
      out.push({
        id: `injury:${key.id}`,
        family: 'SQUAD',
        tone: 'danger',
        glyph: 'injury',
        headline: `${key.displayName} is injured.`,
        meaning: `${key.injury?.description ?? 'Injured'} — out for about ${weeks} ${plural(weeks, 'week', 'weeks')}. He is rated ${key.overall}.`,
        actionLabel: 'Open his profile',
        route: `/squad/player/${key.id}`,
        playerId: key.id,
        score: score(
          0.5 + Math.min(0.35, weeks * 0.06),
          0.2 + key.overall / 200,
          freshness(cycle, key.injury?.sustainedCycle ?? cycle),
          0.35 + key.overall / 250,
        ),
      });
    }
  }

  /* --- contracts ----------------------------------------------------- */
  const expiring = expiringContracts(state, club.id, 8).sort((a, b) => b.overall - a.overall);
  const keyExpiry = expiring[0];
  if (keyExpiry) {
    const contract = contractFor(state, keyExpiry.id);
    const left = contract?.weeksRemaining ?? 0;
    out.push({
      id: `contract:${keyExpiry.id}`,
      family: 'SQUAD',
      tone: left <= 4 ? 'danger' : 'warning',
      glyph: 'contract',
      headline: expiring.length > 1
        ? `${keyExpiry.displayName} and ${expiring.length - 1} ${plural(expiring.length - 1, 'other', 'others')} are out of contract soon.`
        : `${keyExpiry.displayName}'s contract is running out.`,
      meaning: `${left} ${plural(left, 'week', 'weeks')} left. Renew him or he walks away for nothing and you get no fee.`,
      actionLabel: 'Open his profile',
      route: `/squad/player/${keyExpiry.id}`,
      playerId: keyExpiry.id,
      metric: { value: `${left}w`, caption: 'left to run' },
      score: score(clamp01(1 - left / 10), 0.25 + keyExpiry.overall / 180, 0.5, 0.3 + keyExpiry.overall / 250),
    });
  }

  /* --- morale -------------------------------------------------------- */
  const unhappy = squad.filter((p) => p.mental.morale < 38).sort((a, b) => a.mental.morale - b.mental.morale);
  const keyUnhappy = unhappy[0];
  if (keyUnhappy) {
    const contract = contractFor(state, keyUnhappy.id);
    const shortOfMinutes = contract !== undefined && contract.minutesAvailable > 0
      && contract.minutesPlayed / contract.minutesAvailable < 0.3;
    out.push({
      id: `morale:${keyUnhappy.id}`,
      family: 'SQUAD',
      tone: 'warning',
      glyph: 'warning',
      headline: shortOfMinutes
        ? `${keyUnhappy.displayName} is unhappy with his minutes.`
        : `${keyUnhappy.displayName} is unhappy.`,
      meaning: unhappy.length > 1
        ? `He and ${unhappy.length - 1} ${plural(unhappy.length - 1, 'teammate', 'teammates')} are down. Unhappy players play worse and ask to leave.`
        : 'Unhappy players play worse, and eventually they ask to leave.',
      actionLabel: 'Open his profile',
      route: `/squad/player/${keyUnhappy.id}`,
      playerId: keyUnhappy.id,
      progress: { value: keyUnhappy.mental.morale, max: 100, label: `${Math.round(keyUnhappy.mental.morale)} morale` },
      score: score(0.4, 0.3 + keyUnhappy.overall / 220, 0.45, 0.55),
    });
  }

  /* --- money --------------------------------------------------------- */
  const usage = wageBudgetUsage(state, club.id);
  if (usage > 0.95) {
    out.push({
      id: 'finance:wages',
      family: 'CLUB',
      tone: usage > 1 ? 'danger' : 'warning',
      glyph: 'money',
      headline: usage > 1 ? 'Your wage bill is over budget.' : 'Your wage bill is nearly at the limit.',
      meaning: usage > 1
        ? `You are spending ${Math.round(usage * 100)}% of what the board allows. Overspending eats into the transfer budget every week.`
        : `You are at ${Math.round(usage * 100)}% of your allowance, so there is almost no room to sign anybody.`,
      actionLabel: 'Open finances',
      route: '/club/finances',
      progress: { value: Math.min(150, usage * 100), max: 150, label: `${Math.round(usage * 100)}% of budget` },
      score: score(usage > 1 ? 0.7 : 0.4, 0.55, 0.3, 0.25),
    });
  }

  if (club.finance.debt > 0) {
    out.push({
      id: 'finance:debt',
      family: 'CLUB',
      tone: 'warning',
      glyph: 'money',
      headline: 'The club is carrying debt.',
      meaning: 'It is repaid out of your income every cycle, which is money you cannot spend on players.',
      actionLabel: 'Open finances',
      route: '/club/finances',
      score: score(0.35, 0.45, 0.2, 0.2),
    });
  }

  /* --- fans ---------------------------------------------------------- */
  const mood = club.fans.sentiment - club.fans.expectation;
  if (club.fans.sentiment < 40) {
    out.push({
      id: 'fans:low',
      family: 'CLUB',
      tone: 'warning',
      glyph: 'fans',
      headline: 'The stands are turning on you.',
      meaning: `Sentiment is ${Math.round(club.fans.sentiment)} out of 100. Fewer fans through the gate means less matchday money and a flatter atmosphere.`,
      actionLabel: 'See the fans',
      route: '/club/fans',
      progress: { value: club.fans.sentiment, max: 100, label: `${Math.round(club.fans.sentiment)} sentiment` },
      score: score(0.45, 0.4, 0.35, 0.6),
    });
  } else if (mood >= 18) {
    out.push({
      id: 'fans:high',
      family: 'CLUB',
      tone: 'positive',
      glyph: 'fans',
      headline: 'Your supporters are loving this.',
      meaning: `Sentiment is running ${Math.round(mood)} points above what they expected of you this season.`,
      actionLabel: 'See the fans',
      route: '/club/fans',
      score: score(0.1, 0.2, 0.5, 0.55),
    });
  }

  /* --- the table ------------------------------------------------------ */
  const context = leaguePosition(state);
  const table = standings(state);
  const row = table.find((r) => r.clubId === club.id);
  if (context && row && row.played > 0) {
    const tight = context.pointsToAbove !== null && context.pointsToAbove <= 3;
    const threatened = context.pointsFromBelow !== null && context.pointsFromBelow <= 2;
    const index = table.findIndex((r) => r.clubId === club.id);
    const above = index > 0 ? table[index - 1] : undefined;
    const meaning = above && tight && above.zone !== context.zone
      ? `${context.pointsToAbove === 0 ? 'You are level on points with' : `You are ${context.pointsToAbove} ${plural(context.pointsToAbove ?? 0, 'point', 'points')} behind`} ${clubById(state, above.clubId)?.shortName ?? ordinal(context.position - 1)}, and ${ZONE_WORD[above.zone]} start there.`
      : threatened
        ? `Only ${context.pointsFromBelow} ${plural(context.pointsFromBelow ?? 0, 'point', 'points')} separate you from ${ordinal(context.position + 1)}.`
        : `${row.points} ${plural(row.points, 'point', 'points')} from ${row.played} ${plural(row.played, 'game', 'games')}, sitting in ${ZONE_WORD[context.zone]}.`;
    out.push({
      id: 'league:position',
      family: 'LEAGUE',
      tone: context.zone === 'RELEGATION' ? 'danger' : context.zone === 'MID' ? 'neutral' : 'volt',
      glyph: 'league',
      headline: `You are ${ordinal(context.position)} in the league.`,
      meaning,
      actionLabel: 'Open the table',
      route: '/league/standings',
      metric: { value: ordinal(context.position), caption: ZONE_WORD[context.zone] },
      score: score(
        (tight ? 0.5 : 0.15) + (threatened ? 0.25 : 0),
        0.45 + (context.zone === 'RELEGATION' ? 0.35 : 0) + (context.zone === 'CHAMPION' ? 0.2 : 0),
        0.4,
        0.35 + (context.zone === 'RELEGATION' ? 0.3 : 0),
      ),
    });
  }

  /* --- form ------------------------------------------------------------ */
  const form = recentForm(state, club.id, 6);
  const streak = streakWord(form);
  if (streak) {
    out.push({
      id: 'league:form',
      family: 'LEAGUE',
      tone: streak.kind === 'W' ? 'positive' : streak.kind === 'L' ? 'danger' : 'neutral',
      glyph: 'flame',
      headline: streak.kind === 'W'
        ? `${streak.run} wins in a row.`
        : streak.kind === 'L'
          ? `${streak.run} defeats in a row.`
          : `${streak.run} draws in a row.`,
      meaning: streak.kind === 'W'
        ? 'Confidence is high and your players are carrying form into training.'
        : streak.kind === 'L'
          ? 'Morale drops with every one of these, and the fans notice before the board does.'
          : 'Draws keep you unbeaten and keep you exactly where you are.',
      actionLabel: 'See the fixtures',
      route: '/league/fixtures',
      score: score(streak.kind === 'L' ? 0.55 : 0.2, 0.35, 0.75, streak.kind === 'D' ? 0.3 : 0.7),
    });
  }

  /* --- the market ------------------------------------------------------ */
  const listing = Object.values(state.transfers.listings)
    .filter((l) => l.availability !== 'UNAVAILABLE' && l.clubId !== club.id)
    .map((l) => ({ listing: l, player: playerById(state, l.playerId) }))
    .filter((entry): entry is { listing: typeof entry.listing; player: Player } => entry.player !== undefined)
    .sort((a, b) => b.player.overall - a.player.overall)[0];
  if (listing) {
    const wanted = listing.listing.availability === 'WANTED_BY_OTHERS';
    const affordable = listing.listing.askingPrice <= club.finance.transferBudget;
    out.push({
      id: `market:${listing.player.id}`,
      family: 'MARKET',
      tone: 'neutral',
      glyph: 'market',
      headline: `${listing.player.displayName} is available.`,
      meaning: `${listing.player.overall}-rated ${listing.player.position}, age ${listing.player.age}. ${affordable ? 'You can afford him.' : 'He is above your transfer budget as it stands.'}${wanted ? ` ${listing.listing.interestedClubIds.length} other ${plural(listing.listing.interestedClubIds.length, 'club is', 'clubs are')} interested.` : ''}`,
      actionLabel: 'Open the market',
      route: '/market',
      playerId: listing.player.id,
      score: score(
        state.transfers.windowOpen ? (wanted ? 0.6 : 0.4) : 0.1,
        0.2 + listing.player.overall / 220 + (affordable ? 0.15 : 0),
        freshness(cycle, listing.listing.listedCycle),
        0.3 + listing.player.overall / 260,
      ),
    });
  }

  const rivalSigning = [...state.transfers.completed]
    .filter((t) => t.toClubId !== club.id && cycle - t.cycle <= 4)
    .sort((a, b) => b.fee - a.fee)[0];
  if (rivalSigning) {
    const player = playerById(state, rivalSigning.playerId);
    const buyer = clubById(state, rivalSigning.toClubId);
    const rivalry = buyer ? rivalryFor(state, club.id, buyer.id) : undefined;
    if (player && buyer) {
      out.push({
        id: `rival:${rivalSigning.playerId}`,
        family: 'MARKET',
        tone: 'warning',
        glyph: 'flame',
        headline: `${buyer.shortName} have signed a ${player.overall}-rated ${player.position}.`,
        meaning: `${player.displayName}, age ${player.age}. ${rivalry ? 'Your rivals just got stronger.' : 'A team you have to play twice just got stronger.'}`,
        actionLabel: 'See his profile',
        route: `/squad/player/${player.id}`,
        playerId: player.id,
        score: score(0.1, 0.25 + player.overall / 260, freshness(cycle, rivalSigning.cycle), 0.5 + (rivalry ? 0.3 : 0)),
      });
    }
  }

  if (state.transfers.windowOpen) {
    out.push({
      id: 'market:window',
      family: 'MARKET',
      tone: 'volt',
      glyph: 'market',
      headline: 'The transfer window is open.',
      meaning: `You have ${club.finance.transferBudget > 0 ? 'a transfer budget to spend' : 'no transfer budget, so any deal has to be funded by a sale'}. It will not stay open.`,
      actionLabel: 'Open the market',
      route: '/market',
      score: score(0.65, 0.5, 0.55, 0.4),
    });
  }

  /* --- scouting -------------------------------------------------------- */
  const readyReports = state.scouting.assignments.filter((a) => a.cyclesRemaining <= 0);
  if (readyReports.length > 0) {
    out.push({
      id: 'scout:ready',
      family: 'MARKET',
      tone: 'volt',
      glyph: 'scout',
      headline: `${readyReports.length} scout ${plural(readyReports.length, 'report is', 'reports are')} back.`,
      meaning: 'Scouted players show real numbers instead of a range, so you know what you are buying.',
      actionLabel: 'Read them',
      route: '/market/scouting',
      score: score(0.6, 0.4, 0.8, 0.3),
    });
  }

  /* --- objectives ------------------------------------------------------ */
  for (const objective of claimableObjectives(state).slice(0, 2)) {
    out.push(objectiveCard(state, objective, true));
  }
  const nextObjective = [...state.objectives.active]
    .filter((o) => o.status === 'ACTIVE')
    .sort((a, b) => (b.progress / Math.max(1, b.target)) - (a.progress / Math.max(1, a.target)))[0];
  if (nextObjective) out.push(objectiveCard(state, nextObjective, false));

  /* --- the world ------------------------------------------------------- */
  const story = [...state.media.stories].sort((a, b) => b.importance - a.importance || b.cycle - a.cycle)[0];
  if (story) {
    out.push({
      id: `story:${story.id}`,
      family: 'WORLD',
      tone: story.sentiment < -20 ? 'warning' : 'neutral',
      glyph: 'social',
      headline: story.headline,
      meaning: `${story.outlet} · ${story.body.split('. ')[0] ?? ''}`.trim(),
      actionLabel: 'Read the story',
      route: '/social/media',
      score: score(0.1, 0.15 + story.importance * 0.08, freshness(cycle, story.cycle), 0.25 + story.importance * 0.1),
    });
  }

  const post = [...state.social.posts].sort((a, b) => b.weight - a.weight || b.cycle - a.cycle)[0];
  if (post) {
    out.push({
      id: `post:${post.id}`,
      family: 'WORLD',
      tone: post.sentiment < -20 ? 'warning' : 'neutral',
      glyph: 'social',
      headline: `${post.authorName} is talking about your club.`,
      meaning: post.text,
      actionLabel: 'Open the feed',
      route: '/social',
      score: score(0.05, 0.1 + post.weight * 0.06, freshness(cycle, post.cycle), 0.3 + post.weight * 0.08),
    });
  }

  /* --- a good thing, so the feed is not only bad news ------------------ */
  const inForm = squad
    .filter((p) => p.form.rating >= 0.45 && p.form.appearances >= 2)
    .sort((a, b) => b.form.rating - a.form.rating)[0];
  if (inForm) {
    out.push({
      id: `form:${inForm.id}`,
      family: 'SQUAD',
      tone: 'positive',
      glyph: 'star',
      headline: `${inForm.displayName} is in the form of his life.`,
      meaning: `${inForm.form.goals} ${plural(inForm.form.goals, 'goal', 'goals')} and ${inForm.form.assists} ${plural(inForm.form.assists, 'assist', 'assists')} in ${inForm.form.appearances} ${plural(inForm.form.appearances, 'appearance', 'appearances')}. Keep him on the pitch.`,
      actionLabel: 'Open his profile',
      route: `/squad/player/${inForm.id}`,
      playerId: inForm.id,
      score: score(0.1, 0.25, 0.6, 0.6),
    });
  }

  const breakout = [...state.eventLog]
    .reverse()
    .find((e) => e.type === 'PLAYER_BREAKOUT' && cycle - e.cycle <= 3);
  if (breakout && breakout.type === 'PLAYER_BREAKOUT') {
    const player = playerById(state, breakout.payload.playerId);
    if (player && player.clubId === club.id) {
      out.push({
        id: `breakout:${player.id}`,
        family: 'SQUAD',
        tone: 'volt',
        glyph: 'star',
        headline: `${player.displayName} has taken a big step forward.`,
        meaning: `He is now rated ${player.overall}. Players who jump like this are usually worth building around.`,
        actionLabel: 'Open his profile',
        route: `/squad/player/${player.id}`,
        playerId: player.id,
        score: score(0.2, 0.4, freshness(cycle, breakout.cycle), 0.75),
      });
    }
  }

  return out;
}

/* --- assembly ---------------------------------------------------------- */

/**
 * Ranks the candidates, then applies two editorial rules that a raw sort will
 * not give you: nothing below the floor is shown at all, and no single part of
 * the game may take more than two of the slots.
 */
function rank(all: readonly PriorityCard[]): PriorityCard[] {
  const sorted = [...all].sort((a, b) => b.score.total - a.score.total);
  const perFamily = new Map<Family, number>();
  const picked: PriorityCard[] = [];
  for (const card of sorted) {
    if (picked.length >= MAX_CARDS) break;
    if (card.score.total < FLOOR) continue;
    const used = perFamily.get(card.family) ?? 0;
    if (used >= MAX_PER_FAMILY) continue;
    perFamily.set(card.family, used + 1);
    picked.push(card);
  }
  return picked;
}

/**
 * Day one has no history, no results, no injuries and no news, so the ranked
 * feed is legitimately empty — and an empty "what matters now" is the worst
 * possible first impression of a game a player has just started. These cards
 * are never ranked against real events; they only backfill the section when
 * there genuinely is nothing else, and they say what to do rather than what
 * has happened.
 */
function orientation(state: GameState, club: Club): PriorityCard[] {
  const squad = squadOf(state, club.id).length;
  const flat = score(0.15, 0.2, 0.2, 0.15);
  return [
    {
      id: 'start:tactics',
      family: 'SQUAD',
      tone: 'volt',
      glyph: 'training',
      headline: 'Decide how your team plays.',
      meaning: 'Pick a shape and choose who starts. If you never look at this, the game picks for you and it picks safely.',
      actionLabel: 'Set your tactics',
      route: '/squad/tactics',
      score: flat,
    },
    {
      id: 'start:squad',
      family: 'SQUAD',
      tone: 'neutral',
      glyph: 'star',
      headline: `Get to know your ${squad} players.`,
      meaning: 'Tap anyone in the squad to see what he is good at, how fit he is and how long his contract has left.',
      actionLabel: 'Open the squad',
      route: '/squad',
      score: flat,
    },
    {
      id: 'start:market',
      family: 'MARKET',
      tone: 'neutral',
      glyph: 'market',
      headline: 'See who you could sign.',
      meaning: `You have ${club.finance.transferBudget > 0 ? 'money to spend' : 'no budget yet, so start by watching the market'}. Scouting a player turns his ranges into real numbers.`,
      actionLabel: 'Open the market',
      route: '/market',
      score: flat,
    },
  ];
}

export function homeFeed(state: GameState): HomeFeed {
  const club = playerClub(state);
  const fixture = nextFixture(state);
  const opponentId = fixture
    ? (fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId)
    : null;
  const opponent = opponentId ? clubById(state, opponentId) : undefined;

  const upcoming = fixture && opponent
    ? { fixture, opponent, home: fixture.homeClubId === club.id }
    : null;

  const result = freshResult(state, club);
  const lead: Lead = result
    ?? (upcoming
      ? {
        kind: 'MATCH' as const,
        fixture: upcoming.fixture,
        opponent: upcoming.opponent,
        home: upcoming.home,
        stake: stakeLine(state, upcoming.fixture, upcoming.opponent, club),
        beats: matchBeats(state, upcoming.fixture, club, upcoming.opponent),
      }
      : lastFixture(state, club.id)
        ? {
          kind: 'IDLE' as const,
          headline: 'The season is over.',
          meaning: 'Every fixture has been played. Look back at how it went, then start building the next one.',
          actionLabel: 'Season review',
          route: '/league/season',
        }
        : {
          kind: 'IDLE' as const,
          headline: 'Pre-season.',
          meaning: 'No fixtures yet. Pick a shape, set your team up and get your squad in order before the first whistle.',
          actionLabel: 'Set your tactics',
          route: '/squad/tactics',
        });

  const allCards = [...candidates(state, club)].sort((a, b) => b.score.total - a.score.total);
  const picked = rank(allCards);
  if (picked.length < 3) {
    const seen = new Set(picked.map((c) => c.id));
    for (const card of orientation(state, club)) {
      if (picked.length >= 3) break;
      if (seen.has(card.id)) continue;
      picked.push(card);
    }
  }
  return { club, lead, upcoming, cards: picked, allCards };
}
