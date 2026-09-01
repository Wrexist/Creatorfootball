import type { ClubId, MatchId, PlayerId } from '../core/brand';
import { Rng } from '../core/rng';
import { clamp, clamp01, round } from '../core/math';
import { invariant } from '../core/invariant';
import type { CommentaryLine } from '../content/schema';
import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import type { TraitCondition } from '../players/traits';
import { traitModifier } from '../players/traits';
import type { Formation, FormationSlot, TacticSetup, TacticVector } from '../tactics/tactics';
import { formationById, formationsFor, autoLineup } from '../tactics/formations';
import { applyVectorModifiers, toTacticVector } from '../tactics/vector';
import { decideAdaptation, observeAttack, sampleOf, type AttackSample } from './adaptation';
import type { MatchEvent, MatchEventType, PitchFrame, PitchPoint, PlayPhase, Side } from './events';
import type { DecisionPrompt, DecisionOption, DecisionOutcome, DecisionTrigger } from './decisions';
import type { ActiveSpecialRule, SpecialRuleId } from './specialRules';
import type { MatchResult, PlayerMatchStats, TeamMatchStats } from './result';
import { BALANCE } from './balance';
import {
  buildChance, computeAggregates, crowdFactor, defensivePressure, effectiveAttribute,
  fatigueDelta, foulChance, injuryChance, progressionChance, resolveCard, resolveShot,
  rollInjury, shotChance, throughBallChance, turnoverChance,
} from './model';
import type { EffectiveContext, SlotRole, TeamAggregates, UnitView } from './model';
import { MomentumTracker, momentumBoost } from './momentum';
import { CommentaryBook } from './commentary';
import type { CommentaryContext } from './commentary';
import { PositionEngine } from './positioning';
import type { PositioningUnit } from './positioning';
import { SpecialRuleEngine, specialRuleById } from './specialRuleEngine';
import { DecisionEngine, evaluateDecisions } from './decisionEngine';
import type { DecisionSituation, XgTimeline } from './decisionEngine';
import { pickManOfTheMatch, ratePlayer } from './ratings';

/**
 * The match simulator.
 *
 * A match is 300 ticks of six seconds each. On every tick exactly one team has
 * the ball at a position on a 0-1 attacking axis, and the tick resolves into
 * one of: a foul, an offside, a shot, a turnover, or a progression attempt.
 * Phases (build-up -> progression -> final third -> shot / turnover / set
 * piece) fall out of where the ball is rather than being scripted, which is why
 * the same tick loop produces both a nervy 1-0 and a 6-5.
 *
 * Everything a consumer needs comes out as `MatchEvent`s. The renderer, the
 * commentary, the media engine, analytics and history all read that array and
 * nothing else — there is no second channel, and the simulation never knows
 * which of them exist. That decoupling is what lets one match be presented as
 * an animated pitch, a broadcast ticker, or a commentary-only feed without a
 * single outcome changing.
 *
 * Determinism is absolute: `simulateMatch(setup)` twice with the same setup
 * produces byte-identical output. No `Math.random`, no `Date.now`, no ambient
 * state.
 *
 * Units note: `possession` and `passAccuracy` in the stats blocks are
 * percentages (0-100).
 */

// ---------------------------------------------------------------- contract ---

export interface MatchSetup {
  readonly matchId: MatchId;
  readonly seed: string;
  readonly home: MatchTeam;
  readonly away: MatchTeam;
  readonly config: MatchConfig;
  /** 1-5. Feeds the pressure term and the BIG_MATCH trait condition at >= 4. */
  readonly importance: number;
  readonly isDerby: boolean;
  readonly rivalryIntensity: number;
  readonly attendance: number;
  /**
   * 0-1. This competition plays every match at one shared venue, so this field
   * is not a home advantage — it carries the share of the arena backing the
   * nominal home side (`arenaSupportShare`), and the engine caps what it can
   * do to the result. Defaults to 0.
   */
  readonly homeAdvantage: number;
  readonly enabledSpecialRules: readonly SpecialRuleId[];
  readonly neutralVenue?: boolean;
  /** Optional theatrical tie-break. Off by default; the league decides. */
  readonly tieBreak?: 'NONE' | 'SHOOTOUT';
  /**
   * Registry commentary to merge into the live book, passed in rather than
   * reached for so the simulator stays runnable headless with no pack loaded.
   */
  readonly commentaryLines?: readonly CommentaryLine[];
  /**
   * Triggers served in the player's recent matches, newest last. Fed to the
   * decision engine's recency dampener; absent means a fresh memory.
   */
  readonly recentDecisionTriggers?: readonly DecisionTrigger[];
}

export interface MatchTeam {
  readonly clubId: ClubId;
  readonly name: string;
  readonly shortName: string;
  readonly players: readonly Player[];
  readonly tactics: TacticSetup;
  readonly managerBonus: ManagerMatchBonus;
  readonly creatorPresence: number;
  readonly ruleCards: readonly SpecialRuleId[];
  readonly isPlayerControlled: boolean;
}

export interface MatchConfig {
  readonly minutes: number;
  readonly halves: number;
  readonly playersOnPitch: number;
  readonly benchSize: number;
  readonly substitutions: number;
  readonly liveDecisions: boolean;
  readonly maxDecisions: number;
  /**
   * Whether AI sides may adapt mid-match to the shape the other side keeps
   * attacking in. On in every real match; switchable off so a test or an audit
   * can hold everything else equal and measure exactly what the adaptation
   * changed.
   */
  readonly adaptation: boolean;
}

export interface ManagerMatchBonus {
  readonly tactical: number;
  readonly motivation: number;
  readonly adaptability: number;
  readonly discipline: number;
}

/** The competition default: 30 minutes, two halves, GK + 6 outfield. */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  minutes: 30,
  halves: 2,
  playersOnPitch: 7,
  benchSize: 7,
  substitutions: 5,
  liveDecisions: false,
  maxDecisions: 3,
  adaptation: true,
};

export const NEUTRAL_MANAGER_BONUS: ManagerMatchBonus = {
  tactical: 50, motivation: 50, adaptability: 50, discipline: 50,
};

// ----------------------------------------------------------------- runtime ---

interface MutableStats {
  minutes: number; goals: number; assists: number; shots: number; shotsOnTarget: number;
  xg: number; passes: number; passesCompleted: number; keyPasses: number; tackles: number;
  interceptions: number; duelsWon: number; duelsLost: number; saves: number; fouls: number;
  yellowCards: number; redCards: number; distanceCovered: number; bigChancesMissed: number;
  goalsConcededWhileOn: number;
}

const emptyStats = (): MutableStats => ({
  minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, passes: 0,
  passesCompleted: 0, keyPasses: 0, tackles: 0, interceptions: 0, duelsWon: 0,
  duelsLost: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, distanceCovered: 0,
  bigChancesMissed: 0, goalsConcededWhileOn: 0,
});

interface PlayerRuntime {
  readonly player: Player;
  readonly side: Side;
  slot: FormationSlot;
  onPitch: boolean;
  /** Temporarily withdrawn by a rule window rather than substituted. */
  parked: boolean;
  fatigue: number;
  ticksOn: number;
  capacity: number;
  down: number;
  injured: boolean;
  yellow: number;
  sentOff: boolean;
  used: boolean;
  ctx: EffectiveContext;
  stats: MutableStats;
}

interface MutableTeamStats {
  goals: number; possessionTicks: number; shots: number; shotsOnTarget: number; xg: number;
  passes: number; passesCompleted: number; tackles: number; interceptions: number;
  corners: number; fouls: number; offsides: number; yellowCards: number; redCards: number;
  bigChances: number; bigChancesMissed: number;
}

const emptyTeamStats = (): MutableTeamStats => ({
  goals: 0, possessionTicks: 0, shots: 0, shotsOnTarget: 0, xg: 0, passes: 0,
  passesCompleted: 0, tackles: 0, interceptions: 0, corners: 0, fouls: 0, offsides: 0,
  yellowCards: 0, redCards: 0, bigChances: 0, bigChancesMissed: 0,
});

interface TimedModifier {
  readonly modifiers: Readonly<Record<string, number>>;
  readonly untilTick: number;
}

interface TeamRuntime {
  readonly side: Side;
  readonly team: MatchTeam;
  tactics: TacticSetup;
  formation: Formation;
  baseVector: TacticVector;
  readonly all: PlayerRuntime[];
  onPitch: PlayerRuntime[];
  bench: PlayerRuntime[];
  subsUsed: number;
  agg: TeamAggregates;
  aggTick: number;
  readonly stats: MutableTeamStats;
  modifiers: TimedModifier[];
  captain: PlayerRuntime | null;
  squadQuality: number;
  readonly xgFor: number[];
  readonly xgAgainst: number[];
  /** How well this side turned up today. Drawn once, applied to every aggregate. */
  readonly performance: number;
  /** Mean fatigue of the players on the pitch, refreshed every tick. */
  meanFatigue: number;
  /** Squad cohesion from `chemistry` and `teammateMorale`, -1..1. */
  readonly cohesion: number;
  creatorBoostUntil: number;
  lastCreatorMinute: number;
  lastSubTick: number;
  shapeChangedTick: number;
  usedCards: Set<SpecialRuleId>;
}

const SHOOTER_WEIGHT: Record<SlotRole, number> = { GK: 0, DEF: 0.5, MID: 2.2, ATT: 5 };
const CREATOR_WEIGHT: Record<SlotRole, number> = { GK: 0.12, DEF: 1, MID: 4, ATT: 2.5 };
const CARRIER_WEIGHT: Record<SlotRole, number> = { GK: 0.1, DEF: 1.4, MID: 3.5, ATT: 2.2 };
const STOPPER_WEIGHT: Record<SlotRole, number> = { GK: 0.15, DEF: 4, MID: 2.6, ATT: 0.7 };

/**
 * The two stances a trailing AI can take for its one scripted call.
 *
 * These are discrete choices between engine enums rather than tuning scalars,
 * so they live here and not in the balance table — there is no number to move,
 * only a decision to make.
 */
const TRAILING_PUSH_UP: Partial<TacticSetup> = {
  line: 'HIGH', press: 'HIGH_PRESS', tempo: 'QUICK', risk: 'BOLD',
};
const TRAILING_DROP_DEEPER: Partial<TacticSetup> = {
  line: 'DEEP', press: 'LOW_BLOCK', counter: 'ALWAYS', risk: 'CAUTIOUS',
};

// -------------------------------------------------------------- simulator ---

export class MatchSimulator {
  readonly setup: MatchSetup;

  private readonly rng: Rng;
  private readonly commentary: CommentaryBook;
  private readonly momentumTracker = new MomentumTracker();
  private readonly rules: SpecialRuleEngine;
  private readonly decisions: DecisionEngine;
  private readonly positions = new PositionEngine();

  private readonly home: TeamRuntime;
  private readonly away: TeamRuntime;

  private tick = 0;
  private period = 1;
  private periodStartTick = 0;
  private periodEndTick: number;
  private addedApplied = false;
  private stoppageTicksThisPeriod = 0;
  private totalPlannedTicks: number;

  private possession: Side = 'home';
  private zone: number = BALANCE.RESTART_ZONE;
  private channel = 0.5;
  private phase: PlayPhase = 'BUILD_UP';
  private stoppage = 0;
  private counterUntil = -1;
  private celebrating: Side | null = null;
  private ballHolder: PlayerId | null = null;

  private homeScore = 0;
  private awayScore = 0;
  private eventSeq = 0;
  private playTicks = 0;

  private readonly events: MatchEvent[] = [];
  private readonly momentumTimeline: number[] = [];
  private readonly injuries: { playerId: PlayerId; weeksOut: number; severity: string }[] = [];
  private readonly promptSides = new Map<string, Side>();
  private readonly cardsPlayed: { side: Side; ruleId: SpecialRuleId; minute: number }[] = [];
  private pending: DecisionPrompt | null = null;
  private autoResolve = false;
  private opponentChangedFor: Side | null = null;
  private creatorMomentFor: Side | null = null;
  private halfTimePrompt = false;
  /** Sides that have already spent their one scripted trailing response. */
  private readonly trailingResponseDone = new Set<Side>();
  /**
   * What each side has been attacking *in*, as the other bench sees it: the
   * shape and focus of its last few attacks, oldest first, bounded. Filed only
   * when an attack actually happens, so a change of setup is invisible until
   * it has been played — and has to out-vote what was seen before it.
   */
  private attackLog: Record<Side, readonly AttackSample[]> = { home: [], away: [] };
  /** `${side}:${period}` for every half in which that side changed shape at all. */
  private readonly shapeChangedInPeriod = new Set<string>();
  /** `${side}:${period}` for every half in which that side adapted. */
  private readonly adaptedInPeriod = new Set<string>();

  /** Per-match openness. Shared by both sides, which is what overdisperses the scorelines. */
  private readonly openness: number;
  private readonly support: number;
  private readonly rivalry: number;
  private readonly pressure: number;

  private complete = false;
  private cachedResult: MatchResult | null = null;

  constructor(setup: MatchSetup) {
    this.setup = setup;
    this.rng = new Rng(`${setup.seed}|${setup.matchId}`);
    this.commentary = new CommentaryBook(this.rng.fork('commentary'), setup.commentaryLines);

    const tpm = BALANCE.TICKS_PER_MINUTE;
    this.totalPlannedTicks = setup.config.minutes * tpm;
    this.periodEndTick = Math.round(this.totalPlannedTicks / Math.max(1, setup.config.halves));

    this.rivalry = clamp01(setup.rivalryIntensity / 100);
    // The crowd term is the arena-share channel, not a home advantage: every
    // match is played at the league's single venue and `homeAdvantage` carries
    // the share of supporters in the building (see `arenaSupportShare`). It is
    // thinned by how full the ground actually ran against the reference crowd.
    this.support = clamp01(setup.homeAdvantage)
      * clamp01(setup.attendance / BALANCE.ATTENDANCE_REFERENCE);
    this.pressure = clamp01(
      0.12
      + ((clamp(setup.importance, 1, 5) - 1) / 4) * (BALANCE.IMPORTANCE_PRESSURE * 4)
      + this.rivalry * 0.22,
    );

    const opennessStream = this.rng.fork('openness');
    // The clamp is deliberately asymmetric. The bottom of the range is a dull
    // match, which nobody complains about; the top is a fourteen-goal one,
    // which costs the competition its credibility.
    this.openness = clamp(1 + opennessStream.normal(0, BALANCE.MATCH_OPENNESS_SIGMA), 0.58, 1.42);

    this.home = this.buildTeam('home', setup.home);
    this.away = this.buildTeam('away', setup.away);

    this.rules = new SpecialRuleEngine(this.rng.fork('rules'), {
      matchMinutes: setup.config.minutes,
      halves: setup.config.halves,
      enabled: setup.enabledSpecialRules,
    });

    const decisionSides: Side[] = setup.config.liveDecisions
      ? ([setup.home.isPlayerControlled ? 'home' : null, setup.away.isPlayerControlled ? 'away' : null]
        .filter((s): s is Side => s !== null))
      : ['home', 'away'];
    this.decisions = new DecisionEngine(this.rng.fork('decisions'), {
      matchId: setup.matchId,
      maxDecisions: Math.max(0, setup.config.maxDecisions),
      matchMinutes: setup.config.minutes,
      sides: decisionSides,
      adaptability: (setup.home.managerBonus.adaptability + setup.away.managerBonus.adaptability) / 2,
      ...(setup.recentDecisionTriggers?.length ? { recentTriggers: setup.recentDecisionTriggers } : {}),
    });

    this.possession = this.rng.chance(0.5) ? 'home' : 'away';
    this.emit('MATCH_START', { importance: 3, side: 'home' });
    this.emit('KICK_OFF', { importance: 2, side: this.possession });
  }

  // ------------------------------------------------------------- public API ---

  get isComplete(): boolean { return this.complete; }

  score(): { home: number; away: number } { return { home: this.homeScore, away: this.awayScore }; }

  minute(): number { return Math.floor(this.tick / BALANCE.TICKS_PER_MINUTE); }

  momentum(): number { return this.momentumTracker.current; }

  pendingDecision(): DecisionPrompt | null { return this.pending; }

  step(): readonly MatchEvent[] {
    if (this.complete || this.pending) return [];
    const from = this.events.length;
    this.advance();
    return this.events.slice(from);
  }

  frame(): PitchFrame {
    const units: PositioningUnit[] = [];
    for (const team of [this.home, this.away]) {
      for (const rt of team.onPitch) {
        units.push({
          playerId: rt.player.id,
          side: rt.side,
          slot: rt.slot,
          stamina: (1 - rt.fatigue) * 100,
          pace: rt.player.attributes.pace,
          hasBall: this.ballHolder === rt.player.id,
          teamInPossession: this.possession === rt.side,
          down: rt.down > 0,
        });
      }
    }
    return this.positions.frame({
      tick: this.tick,
      minute: this.minute(),
      phase: this.phase,
      possession: this.stoppage > 0 ? null : this.possession,
      zone: this.zone,
      channel: this.channel,
      ballHolder: this.ballHolder,
      units,
      celebratingSide: this.celebrating,
    });
  }

  resolveDecision(promptId: string, optionId: string): void {
    const prompt = this.pending;
    if (!prompt || prompt.id !== promptId) return;
    const option = prompt.options.find((o) => o.id === optionId)
      ?? prompt.options.find((o) => o.id === prompt.defaultOptionId)
      ?? (prompt.options[0] as DecisionOption);
    this.applyDecision(prompt, option);
    this.pending = null;
  }

  applyTacticalChange(
    side: Side,
    change: Partial<TacticSetup>,
    detail?: Readonly<Record<string, string | number | boolean>>,
    commentaryTags?: readonly string[],
  ): void {
    const team = this.teamFor(side);
    team.tactics = { ...team.tactics, ...change };
    if (change.formationId) {
      team.formation = formationById(change.formationId);
      this.reslot(team);
    }
    team.baseVector = this.vectorFor(team);
    this.noteShapeChange(side);
    this.emit('TACTICAL_CHANGE', {
      side,
      importance: 2,
      ...(detail ? { detail } : {}),
      ...(commentaryTags ? { tags: commentaryTags, exclusiveTags: true } : {}),
    });
  }

  /**
   * Every change of shape, by either mechanism, does two things: it marks the
   * tick and it tells the other side's decision engine. It deliberately does
   * NOT touch what the other bench has observed: the record still says what
   * this side was doing, and only attacks played in the new setup can change
   * it. That is what stops an opponent countering a change made seconds ago,
   * and what stops a change from wiping the slate for free.
   */
  private noteShapeChange(side: Side): void {
    const team = this.teamFor(side);
    team.shapeChangedTick = this.tick;
    this.shapeChangedInPeriod.add(`${side}:${this.period}`);
    this.opponentChangedFor = side === 'home' ? 'away' : 'home';
  }

  /** Re-seat the players already on the pitch into a changed formation's slots. */
  private reslot(team: TeamRuntime): void {
    const available = team.onPitch.slice();
    const slots = team.formation.slots.slice(0, available.length);
    for (const slot of slots) {
      let best: PlayerRuntime | null = null;
      let bestScore = -Infinity;
      for (const rt of available) {
        const fit = rt.player.position === slot.position ? 1.2
          : rt.player.secondaryPositions.includes(slot.position) ? 1 : 0.6;
        const score = rt.player.overall * fit;
        if (score > bestScore) { bestScore = score; best = rt; }
      }
      if (!best) continue;
      best.slot = slot;
      available.splice(available.indexOf(best), 1);
    }
    this.refreshAggregates(team, true);
  }

  makeSubstitution(side: Side, out: PlayerId, in_: PlayerId): boolean {
    const team = this.teamFor(side);
    if (team.subsUsed >= this.setup.config.substitutions) return false;
    const off = team.onPitch.find((p) => p.player.id === out);
    const on = team.bench.find((p) => p.player.id === in_ && !p.used && !p.sentOff);
    if (!off || !on) return false;
    this.performSub(team, off, on);
    return true;
  }

  playRuleCard(side: Side, ruleId: SpecialRuleId): boolean {
    const team = this.teamFor(side);
    if (!team.team.ruleCards.includes(ruleId)) return false;
    if (team.usedCards.has(ruleId)) return false;
    const active = this.rules.playCard(side, ruleId, {
      minute: this.nominalMinute(),
      homeScore: this.homeScore,
      awayScore: this.awayScore,
    });
    if (!active) return false;
    team.usedCards.add(ruleId);
    this.cardsPlayed.push({ side, ruleId, minute: Math.floor(this.nominalMinute()) });
    this.announceRuleStart(active);
    return true;
  }

  finish(): MatchResult {
    this.autoResolve = true;
    if (this.pending) {
      const prompt = this.pending;
      this.applyDecision(prompt, this.aiChoice(prompt));
      this.pending = null;
    }
    let guard = 0;
    while (!this.complete && guard < 100000) {
      this.advance();
      guard += 1;
    }
    return this.result();
  }

  /**
   * Ratings as they stand right now, for the live pitch labels.
   *
   * The same `ratePlayer` the final result uses, applied to the tally so far,
   * so the number a player watches climb during a match is the number he is
   * given at full time. Computing a separate live rating in the interface
   * would have been two models disagreeing in front of the user.
   */
  liveRatings(): Readonly<Record<string, number>> {
    const out: Record<string, number> = {};
    const elapsed = Math.max(1, this.minute());

    for (const team of [this.home, this.away]) {
      const conceded = team.side === 'home' ? this.awayScore : this.homeScore;
      for (const rt of team.all) {
        if (rt.ticksOn === 0) continue;
        const minutes = Math.max(1, Math.round(rt.ticksOn / BALANCE.TICKS_PER_MINUTE));
        out[rt.player.id] = ratePlayer({
          playerId: rt.player.id,
          role: rt.slot.role as SlotRole,
          minutes,
          goals: rt.stats.goals,
          assists: rt.stats.assists,
          shots: rt.stats.shots,
          shotsOnTarget: rt.stats.shotsOnTarget,
          keyPasses: rt.stats.keyPasses,
          passes: rt.stats.passes,
          passesCompleted: rt.stats.passesCompleted,
          tackles: rt.stats.tackles,
          interceptions: rt.stats.interceptions,
          duelsWon: rt.stats.duelsWon,
          duelsLost: rt.stats.duelsLost,
          saves: rt.stats.saves,
          yellowCards: rt.stats.yellowCards,
          redCards: rt.stats.redCards,
          bigChancesMissed: rt.stats.bigChancesMissed,
          goalsConcededWhileOn: rt.stats.goalsConcededWhileOn,
          // A clean sheet only means something once there is a match behind it.
          cleanSheet: conceded === 0 && elapsed >= this.setup.config.minutes * 0.6,
          matchMinutes: this.setup.config.minutes,
        });
      }
    }
    return out;
  }

  result(): MatchResult {
    invariant(this.complete, 'MATCH_INCOMPLETE', 'result() called before the match finished');
    if (this.cachedResult) return this.cachedResult;
    this.cachedResult = this.buildResult();
    return this.cachedResult;
  }

  // ------------------------------------------------------------ construction ---

  private buildTeam(side: Side, team: MatchTeam): TeamRuntime {
    const wanted = this.setup.config.playersOnPitch;
    let formation = formationById(team.tactics.formationId);
    if (formation.slots.length !== wanted) {
      const alternatives = formationsFor(wanted);
      formation = (alternatives[0] as Formation | undefined) ?? formation;
    }

    let tactics = team.tactics;
    const assigned = formation.slots.filter((s) => tactics.lineup[s.id]).length;
    if (assigned < formation.slots.length) {
      // A partial team sheet is completed rather than rejected: the sim must
      // never refuse to play a fixture because a slot was left empty.
      const auto = autoLineup(team.players, formation);
      tactics = { ...tactics, lineup: { ...auto.lineup, ...tactics.lineup }, bench: tactics.bench.length ? tactics.bench : auto.bench };
      if (!tactics.captainId) tactics = { ...tactics, captainId: auto.captainId };
      if (!tactics.penaltyTakerId) tactics = { ...tactics, penaltyTakerId: auto.penaltyTakerId };
      if (!tactics.setPieceTakerId) tactics = { ...tactics, setPieceTakerId: auto.setPieceTakerId };
    }

    const byId = new Map<string, Player>(team.players.map((p) => [p.id, p]));
    const all: PlayerRuntime[] = [];
    const onPitch: PlayerRuntime[] = [];
    const taken = new Set<string>();

    for (const slot of formation.slots) {
      const id = tactics.lineup[slot.id];
      const player = id ? byId.get(id) : undefined;
      const chosen = player ?? team.players.find((p) => !taken.has(p.id));
      if (!chosen) continue;
      taken.add(chosen.id);
      const rt = this.makeRuntime(chosen, side, slot, true);
      all.push(rt);
      onPitch.push(rt);
    }

    const benchIds = tactics.bench.length ? tactics.bench : [];
    const benchPlayers: Player[] = [];
    for (const id of benchIds) {
      const p = byId.get(id);
      if (p && !taken.has(p.id)) { benchPlayers.push(p); taken.add(p.id); }
    }
    for (const p of team.players) {
      if (benchPlayers.length >= this.setup.config.benchSize) break;
      if (taken.has(p.id)) continue;
      benchPlayers.push(p);
      taken.add(p.id);
    }

    const bench = benchPlayers.map((p) => {
      const slot = formation.slots.find((s) => s.position === p.position)
        ?? (formation.slots[formation.slots.length - 1] as FormationSlot);
      const rt = this.makeRuntime(p, side, slot, false);
      rt.fatigue = BALANCE.SUB_START_FATIGUE;
      all.push(rt);
      return rt;
    });

    const squadQuality = onPitch.length
      ? onPitch.reduce((a, p) => a + p.player.overall, 0) / onPitch.length
      : 50;

    const captain = onPitch.find((p) => p.player.id === tactics.captainId) ?? onPitch[1] ?? onPitch[0] ?? null;

    const baseVector = toTacticVector(tactics, {
      squadQuality,
      managerTactical: team.managerBonus.tactical,
    });

    // Squad cohesion. `chemistry` and `teammateMorale` were labelled on the
    // player profile and read by nothing anywhere in the engine; this is their
    // consumer. A dressing room that works turns up nearer its ceiling.
    const cohesion = onPitch.length
      ? onPitch.reduce((a, p) => a
        + traitModifier(p.player.traitIds, 'chemistry', p.ctx.conditions)
        + 0.5 * traitModifier(p.player.traitIds, 'teammateMorale', p.ctx.conditions), 0) / onPitch.length
      : 0;

    // `volatility` widens the performance draw rather than shifting it: a bold
    // setup is not better, it is less predictable, in both directions.
    const swing = Math.max(0.35, 1 + BALANCE.VOLATILITY_PERFORMANCE_WEIGHT * (baseVector.volatility - 1));
    const performance = clamp(
      1 + BALANCE.COHESION_WEIGHT * clamp(cohesion, -1, 1)
      + this.rng.fork(`performance:${side}`).normal(0, BALANCE.TEAM_PERFORMANCE_SIGMA * swing),
      0.6, 1.4,
    );

    const runtime: TeamRuntime = {
      side,
      team,
      tactics,
      formation,
      baseVector,
      all,
      onPitch,
      bench,
      subsUsed: 0,
      agg: computeAggregates([], wanted - 1),
      aggTick: -999,
      stats: emptyTeamStats(),
      modifiers: [],
      captain,
      squadQuality,
      xgFor: [],
      xgAgainst: [],
      performance,
      meanFatigue: 0,
      cohesion,
      creatorBoostUntil: -1,
      lastCreatorMinute: -999,
      lastSubTick: -999,
      shapeChangedTick: -999,
      usedCards: new Set(),
    };

    for (const rt of onPitch) this.positions.place(rt.player.id, side, rt.slot);
    this.refreshAggregates(runtime, true);
    return runtime;
  }

  private makeRuntime(player: Player, side: Side, slot: FormationSlot, onPitch: boolean): PlayerRuntime {
    return {
      player,
      side,
      slot,
      onPitch,
      parked: false,
      fatigue: 0,
      ticksOn: 0,
      capacity: 1,
      down: 0,
      injured: false,
      yellow: 0,
      sentOff: false,
      used: onPitch,
      ctx: {
        conditions: [],
        slotPosition: slot.position,
        fatigue: 0,
        capacity: 1,
        atmosphere: 0,
        pressure: this.pressure,
      },
      stats: emptyStats(),
    };
  }

  // ----------------------------------------------------------------- ticking ---

  private advance(): void {
    if (this.complete) return;

    this.tick += 1;
    const tpm = BALANCE.TICKS_PER_MINUTE;
    const minute = Math.floor(this.tick / tpm);

    this.accrueFatigue();
    this.handleRuleWindows();
    this.maybeCreatorMoment();

    if (this.stoppage > 0) {
      this.stoppage -= 1;
      if (this.stoppage === 0) { this.celebrating = null; this.phase = 'RESTART'; }
      this.momentumTimeline.push(this.momentumTracker.tick(this.tick, null, 0, 0));
      this.checkPeriodBoundary(minute);
      return;
    }

    this.playTicks += 1;
    const xgThisTick = this.playPossessionTick(minute);
    this.momentumTimeline.push(this.momentumTracker.tick(
      this.tick, this.possession, xgThisTick.home, xgThisTick.away,
    ));

    if (this.momentumTracker.shouldAnnounce()) {
      const dominant: Side = this.momentumTracker.current >= 0 ? 'home' : 'away';
      this.emit('MOMENTUM_SHIFT', { side: dominant, importance: 2 });
    }

    this.maybeInjury();
    this.maybeSubstitution(minute);
    this.maybeDecision(minute, false);
    this.maybeScriptedResponse();
    this.maybeAdaptation();
    this.checkPeriodBoundary(minute);
  }

  /**
   * The one scripted call. A TRAILING AI gets exactly one response per match,
   * from the threshold onward: push up if it set out bold, drop deeper and
   * counter if it did not. The choice reads off the tactics the club walked
   * out with — the profile itself does not travel into the match, so its risk
   * setting is the honest proxy for how its manager thinks. Deterministic by
   * construction: no rng is consumed, only the scoreline and the setup.
   */
  private maybeScriptedResponse(): void {
    if (this.elapsedFraction() < BALANCE.TRAILING_RESPONSE_FRACTION) return;
    for (const team of [this.home, this.away]) {
      if (team.team.isPlayerControlled) continue;
      if (this.trailingResponseDone.has(team.side)) continue;
      const scoreFor = team.side === 'home' ? this.homeScore : this.awayScore;
      const scoreAgainst = team.side === 'home' ? this.awayScore : this.homeScore;
      if (scoreFor >= scoreAgainst) continue;

      this.trailingResponseDone.add(team.side);
      const pushUp = team.tactics.risk === 'BOLD' || team.tactics.risk === 'RECKLESS';
      const change = pushUp ? TRAILING_PUSH_UP : TRAILING_DROP_DEEPER;
      this.applyTacticalChange(team.side, change, {
        trigger: 'AI_TRAILING_RESPONSE',
        stance: pushUp ? 'PUSH_UP' : 'DROP_DEEPER',
      });
    }
  }

  /** File one attack for the bench on the other side to think about. */
  private observe(team: TeamRuntime): AttackSample {
    const sample = sampleOf(team.tactics);
    this.attackLog = { ...this.attackLog, [team.side]: observeAttack(this.attackLog[team.side], sample) };
    return sample;
  }

  /**
   * The other manager solving you.
   *
   * OBSERVE → IDENTIFY → DECIDE → ADAPT, once per half at most, from what has
   * actually been seen. The decision is a pure function that consumes no
   * randomness and is never told the score; see `adaptation.ts`. It is run
   * after the scripted trailing response on purpose: a side that has just made
   * its one scoreline call has changed shape this half, and does not also get
   * to adapt — one change per half is what a manager gets.
   */
  private maybeAdaptation(): void {
    if (!this.setup.config.adaptation) return;
    for (const team of [this.home, this.away]) {
      if (team.team.isPlayerControlled) continue;
      const key = `${team.side}:${this.period}`;
      const other: Side = team.side === 'home' ? 'away' : 'home';
      const decision = decideAdaptation({
        observed: this.attackLog[other],
        current: team.tactics,
        adaptability: team.team.managerBonus.adaptability,
        changedShapeThisPeriod: this.shapeChangedInPeriod.has(key),
        adaptedThisPeriod: this.adaptedInPeriod.has(key),
      });
      if (!decision) continue;

      this.adaptedInPeriod.add(key);
      this.applyTacticalChange(team.side, decision.change, {
        trigger: 'AI_ADAPTATION',
        read: decision.read,
        pattern: decision.pattern,
        changes: Object.entries(decision.change).map(([k, v]) => `${k}=${String(v)}`).join(' '),
        matching: decision.matching,
        samples: decision.samples,
        recap: decision.recap,
      }, [decision.tag]);
    }
  }

  private checkPeriodBoundary(minute: number): void {
    if (this.tick < this.periodEndTick) return;

    // Added time is granted once, at the end of regulation for the period.
    if (!this.addedApplied) {
      const added = Math.min(
        BALANCE.MAX_ADDED_MINUTES * BALANCE.TICKS_PER_MINUTE,
        Math.round(this.stoppageTicksThisPeriod * BALANCE.ADDED_TIME_RECOVERY),
      );
      this.addedApplied = true;
      if (added > 0) {
        this.periodEndTick += added;
        this.totalPlannedTicks += added;
        return;
      }
    }

    // The whistle closes any window still running through added time.
    this.handleRuleWindows(this.period * (this.setup.config.minutes / this.setup.config.halves));

    if (this.period >= this.setup.config.halves) {
      this.emit('FULLTIME', { importance: 5, tags: this.fullTimeTags() });
      this.resolveTieBreak();
      this.complete = true;
      return;
    }

    this.emit(this.period === 1 ? 'HALFTIME' : 'PERIOD_END', { importance: 3 });
    this.momentumTracker.halfTime(
      (this.setup.home.managerBonus.motivation + this.setup.away.managerBonus.motivation) / 2,
    );
    this.halfTimePrompt = true;
    this.maybeDecision(minute, true);
    this.halfTimePrompt = false;

    this.period += 1;
    this.periodStartTick = this.tick;
    this.periodEndTick = this.tick + Math.round(
      (this.setup.config.minutes * BALANCE.TICKS_PER_MINUTE) / this.setup.config.halves,
    );
    this.addedApplied = false;
    this.stoppageTicksThisPeriod = 0;
    this.possession = this.possession === 'home' ? 'away' : 'home';
    this.zone = BALANCE.RESTART_ZONE;
    this.phase = 'BUILD_UP';
    this.emit('PERIOD_START', { importance: 2, side: this.possession });
  }

  // ------------------------------------------------------------------- play ---

  private playPossessionTick(minute: number): { home: number; away: number } {
    const atk = this.teamFor(this.possession);
    const def = this.teamFor(this.possession === 'home' ? 'away' : 'home');
    this.refreshAggregates(atk, false);
    this.refreshAggregates(def, false);

    const va = this.effectiveVector(atk);
    const vd = this.effectiveVector(def);
    const finalThird = this.zone >= BALANCE.FINAL_THIRD_ZONE;
    atk.stats.possessionTicks += 1;

    const boost = momentumBoost(this.momentumTracker.current, atk.side);
    const input = {
      attack: atk.agg,
      defence: def.agg,
      attackVector: va,
      defenceVector: vd,
      zone: this.zone,
      finalThird,
      momentumBoost: boost,
      homeBoost: this.supportFactor(atk.side),
      defenceFatigue: def.meanFatigue,
      leadMargin: atk.side === 'home' ? this.homeScore - this.awayScore : this.awayScore - this.homeScore,
      goalsScored: atk.side === 'home' ? this.homeScore : this.awayScore,
    };

    this.phase = finalThird ? 'FINAL_THIRD' : this.zone > 0.45 ? 'PROGRESSION' : 'BUILD_UP';
    if (this.tick <= this.counterUntil) this.phase = 'TRANSITION';

    const inWindow = this.rules.inSwingWindow(this.nominalMinute()) !== null;
    const xgHome = 0;
    const xgAway = 0;

    // 1. A foul stops everything else this tick.
    const foulP = foulChance({
      defenceVector: vd,
      rivalry: this.rivalry,
      pressure: clamp01(this.zone),
      finalThird,
    });
    if (this.rng.chance(foulP)) {
      const xg = this.handleFoul(atk, def, minute, va, vd);
      return this.attribute(atk.side, xg);
    }

    // 2. Offside against a high line.
    if (finalThird && this.rng.chance(
      BALANCE.OFFSIDE_RATE * (1 + BALANCE.OFFSIDE_LINE_WEIGHT * vd.spaceBehind),
    )) {
      const flagged = this.pick(atk, SHOOTER_WEIGHT);
      atk.stats.offsides += 1;
      this.emit('OFFSIDE', { side: atk.side, player: flagged, importance: 1 });
      this.turnover(atk, def, false);
      return { home: 0, away: 0 };
    }

    // 2b. The ball over the top.
    //
    // This is where `spaceBehind` is charged. Outside the final third the side
    // in possession can try to play a runner in behind the last line; when it
    // comes off the defence is bypassed entirely and what follows is a run at
    // the keeper. It is the counterplay to a high line and a high press, and
    // the reason DIRECT passing, `counterWeight` and a quick forward matter.
    if (!finalThird && this.rng.chance(throughBallChance({
      spaceBehind: vd.spaceBehind,
      counterWeight: va.counterWeight,
      attackPace: atk.agg.pace,
      defencePace: def.agg.pace,
      traitThreat: atk.agg.traits.counterThreat,
      counterWindow: this.tick <= this.counterUntil,
    }))) {
      const xg = this.playThroughBall(atk, def, va, vd, minute);
      return this.attribute(atk.side, xg);
    }

    // 3. Shot.
    if (finalThird) {
      let p = shotChance(input, this.tick <= this.counterUntil);
      p *= this.rules.shotRateScale(atk.side);
      if (inWindow) p *= BALANCE.SWING_WINDOW_SHOT_MULTIPLIER * this.rules.windowShotScale(atk.side);
      // The ceiling stops the window multiplier from turning a final third into
      // a shooting gallery on every tick.
      p = Math.min(p, BALANCE.SHOT_CHANCE_CEILING);
      if (this.rng.chance(clamp01(p))) {
        // A wide shape puts the ball into the box more often; a narrow one
        // works it through the middle. This is what makes width a real choice.
        const cross = this.rng.chance(clamp01(
          BALANCE.CROSS_RATE * (1 + BALANCE.CROSS_WIDTH_WEIGHT * va.widthBias),
        ));
        const xg = this.takeShot(atk, def, va, vd, {
          counter: this.tick <= this.counterUntil,
          header: cross,
          setPiece: false,
          penalty: false,
          cross,
          minute,
        });
        return this.attribute(atk.side, xg);
      }
    }

    // 4. Turnover.
    if (this.rng.chance(turnoverChance(input))) {
      this.recordPass(atk, false);
      this.turnover(atk, def, true);
      return { home: 0, away: 0 };
    }

    // 5. Progression.
    this.recordPass(atk, true);
    if (this.rng.chance(progressionChance(input))) {
      const step = BALANCE.PROGRESSION_STEP * this.rng.float(0.6, 1.4);
      this.zone = clamp(this.zone + step, 0.05, 0.96);
      this.channel = clamp(this.channel + this.rng.normal(0, 0.12) + va.widthBias * 0.05, 0.05, 0.95);
      if (this.rng.chance(0.16)) {
        const carrier = this.pick(atk, CARRIER_WEIGHT);
        this.ballHolder = carrier.player.id;
        this.emit(this.rng.chance(0.5) ? 'CARRY' : 'PASS', { side: atk.side, player: carrier, importance: 1 });
      }
    } else {
      this.zone = clamp(this.zone - BALANCE.RECYCLE_STEP, 0.05, 0.96);
    }

    return { home: xgHome, away: xgAway };
  }

  private attribute(side: Side, xg: number): { home: number; away: number } {
    return side === 'home' ? { home: xg, away: 0 } : { home: 0, away: xg };
  }

  private handleFoul(
    atk: TeamRuntime, def: TeamRuntime, minute: number,
    va: TacticVector, vd: TacticVector,
  ): number {
    // A booked player pulls out of the next one. That is both realistic and the
    // reason second yellows stay as rare as the reference data says they are.
    const offender = this.pick(def, STOPPER_WEIGHT, (p) =>
      (1 + (60 - p.player.mental.discipline) / 90) * (p.yellow >= 1 ? 0.4 : 1));
    const victim = this.pick(atk, CARRIER_WEIGHT);
    def.stats.fouls += 1;
    offender.stats.fouls += 1;

    const clearChance = this.zone >= BALANCE.FINAL_THIRD_ZONE && this.rng.chance(0.3);
    this.emit('FOUL', {
      side: def.side, player: offender, secondary: victim, importance: 1,
      tags: this.rivalry > 0.55 ? ['heated'] : undefined,
    });

    const card = resolveCard(this.rng, {
      offender: offender.player,
      conditions: offender.ctx.conditions,
      rivalry: this.rivalry,
      managerDiscipline: def.team.managerBonus.discipline,
      stoppedClearChance: clearChance,
      alreadyBooked: offender.yellow >= 1,
    });
    if (card === 'YELLOW') {
      offender.yellow += 1;
      offender.stats.yellowCards += 1;
      this.stopClock(BALANCE.CARD_STOPPAGE_TICKS);
      def.stats.yellowCards += 1;
      this.momentumTracker.impulse('YELLOW_CARD', def.side);
      this.emit('YELLOW_CARD', { side: def.side, player: offender, importance: 2 });
    } else if (card === 'RED') {
      offender.stats.redCards += 1;
      def.stats.redCards += 1;
      this.stopClock(BALANCE.CARD_STOPPAGE_TICKS);
      this.sendOff(def, offender);
      this.momentumTracker.impulse('RED_CARD', def.side);
      this.emit('RED_CARD', { side: def.side, player: offender, importance: 5 });
    }

    // Penalty in this format is a one-on-one run at the keeper, not a spot kick.
    if (this.zone >= BALANCE.PENALTY_ZONE && this.rng.chance(BALANCE.PENALTY_FROM_BOX_FOUL)) {
      this.emit('PENALTY_AWARDED', { side: atk.side, player: victim, importance: 4 });
      this.momentumTracker.impulse('PENALTY_AWARDED', atk.side);
      return this.takeShot(atk, def, va, vd, {
        counter: false, header: false, setPiece: true, penalty: true, cross: false, minute,
      });
    }

    if (this.zone >= BALANCE.FINAL_THIRD_ZONE) {
      this.phase = 'SET_PIECE';
      this.emit('FREE_KICK', { side: atk.side, importance: 1 });
      if (this.rng.chance(BALANCE.FREE_KICK_SHOT_CHANCE)) {
        return this.takeShot(atk, def, va, vd, {
          counter: false, header: this.rng.chance(0.55), setPiece: true, penalty: false, cross: false, minute,
        });
      }
    }
    this.zone = clamp(this.zone + 0.04, 0.05, 0.96);
    return 0;
  }

  /**
   * A runner goes in behind. The ball is already past the defensive line, so
   * the chance is built from a high zone with the through-ball bonus, and the
   * runner is chosen for pace and for the `counterThreat` trait rather than for
   * where he happens to stand.
   */
  private playThroughBall(
    atk: TeamRuntime, def: TeamRuntime, va: TacticVector, vd: TacticVector, minute: number,
  ): number {
    const runner = this.rng.weighted(atk.onPitch, (rt) => {
      const base = SHOOTER_WEIGHT[rt.slot.role as SlotRole] ?? 1;
      if (base <= 0) return 0.01;
      const pace = effectiveAttribute(rt.player, 'pace', rt.ctx)
        + effectiveAttribute(rt.player, 'acceleration', rt.ctx);
      const trait = Math.max(0.3, 1 + 2 * traitModifier(rt.player.traitIds, 'counterThreat', rt.ctx.conditions));
      return base * (0.3 + pace / 120) * trait;
    });

    this.zone = clamp(0.86 + this.rng.float(0, 0.08), 0.05, 0.96);
    this.phase = 'TRANSITION';
    this.ballHolder = runner.player.id;
    this.momentumTracker.impulse('BIG_CHANCE', atk.side);
    this.emit('CHANCE_CREATED', {
      side: atk.side, player: runner, importance: 3, tags: ['throughBall'],
    });
    return this.takeShot(atk, def, va, vd, {
      counter: true, header: false, setPiece: false, penalty: false, cross: false,
      throughBall: true, minute,
    });
  }

  private takeShot(
    atk: TeamRuntime, def: TeamRuntime, va: TacticVector, vd: TacticVector,
    opts: {
      counter: boolean; header: boolean; setPiece: boolean; penalty: boolean; cross: boolean;
      minute: number; throughBall?: boolean; shooter?: PlayerRuntime;
    },
  ): number {
    // A delivery into the box is attacked by whoever is best in the air, not by
    // whoever happens to be furthest forward.
    // Armband: while the card is live everything runs through the captain. The
    // rule engine exposed `captainFocus` for exactly this and nothing called
    // it, so the card's whole first clause — "everything runs through your
    // captain" — was doing nothing and only the goal multiplier survived.
    const focus = this.rules.captainFocus(atk.side) ? atk.captain : null;
    const shooter = opts.shooter
      ?? (focus && this.rng.chance(0.55) ? focus : null)
      ?? (opts.penalty
        ? (atk.onPitch.find((p) => p.player.id === atk.tactics.penaltyTakerId) ?? this.pick(atk, SHOOTER_WEIGHT))
        : opts.header
          ? this.pick(atk, SHOOTER_WEIGHT, (p) =>
            Math.max(0.3, 1 + 2.2 * traitModifier(p.player.traitIds, 'aerialThreat', p.ctx.conditions)))
          : this.pick(atk, SHOOTER_WEIGHT));

    const assister = !opts.penalty && !opts.counter && this.rng.chance(0.72)
      ? this.pickOther(atk, CREATOR_WEIGHT, shooter)
      : null;

    const keeper = def.onPitch.find((p) => p.slot.role === 'GK') ?? null;
    const keeperTrait = keeper
      ? traitModifier(keeper.player.traitIds, 'saveChance', keeper.ctx.conditions)
      : 0;

    const pressure = defensivePressure(def.agg, vd, this.zone);
    const finishing = effectiveAttribute(shooter.player, 'finishing', shooter.ctx);
    const composure = effectiveAttribute(shooter.player, 'composure', shooter.ctx);
    const assistQuality = assister
      ? clamp01(((effectiveAttribute(assister.player, 'vision', assister.ctx)
        + effectiveAttribute(assister.player, 'passing', assister.ctx)) / 2) / 88)
      : 0.24;

    // Who wins the ball in the box, plus how exposed a narrow block is to a
    // delivery from the flank. This is the read site for the `aerial` aggregate
    // and, through it, for the `aerialThreat` trait.
    const aerialEdge = opts.header
      ? clamp((atk.agg.aerial - def.agg.aerial) / 55, -0.8, 0.8)
        + BALANCE.AERIAL_NARROW_EXPOSURE * Math.max(0, -vd.widthBias)
      : 0;

    const inWindow = this.rules.inSwingWindow(this.nominalMinute()) !== null;
    // Support is applied once, to shot volume, and deliberately not again here:
    // compounding it through xG as well doubles a modifier that is capped by
    // design at a swing smaller than a real home advantage.
    //
    // The same argument applies to the match's openness draw, and it was NOT
    // being honoured: openness multiplied the shot rate in the tick loop and
    // then multiplied xG again here, so an open match was hit with the same
    // draw twice — up to 2.25x on the goal rate from a single number, which is
    // where the twenty-goal fixtures lived. It is applied exactly once now, and
    // here rather than on the shot rate, because the shot rate is
    // self-limiting: raising it ends possessions sooner, so most of the draw
    // was cancelling itself out and the scoreline distribution had collapsed to
    // Poisson. Conversion is where an open game actually shows up.
    let multiplier = this.opennessFactor()
      * (1 + momentumBoost(this.momentumTracker.current, atk.side));
    if (this.tick <= atk.creatorBoostUntil) multiplier *= 1 + BALANCE.CREATOR_MOMENT_BOOST;
    // The ceiling bounds the ACCIDENTAL compounding of the per-match draws.
    // The swing window is a designed, pre-announced multiplier and is applied
    // after it, so capping the noise does not quietly cap the format.
    multiplier = Math.min(multiplier, BALANCE.XG_MULTIPLIER_CEILING);
    if (inWindow) multiplier *= BALANCE.SWING_WINDOW_XG_MULTIPLIER;

    const chance = buildChance(this.rng, {
      zone: this.zone,
      widthBias: va.widthBias,
      chanceQuality: va.chanceQuality,
      counter: opts.counter,
      header: opts.header,
      setPiece: opts.setPiece,
      penalty: opts.penalty,
      throughBall: opts.throughBall === true,
      aerialEdge,
      shooterConversion: traitModifier(shooter.player.traitIds, 'shotConversion', shooter.ctx.conditions),
      creatorFlair: assister
        ? traitModifier(assister.player.traitIds, 'creativity', assister.ctx.conditions)
        : 0,
      volatility: va.volatility,
      pressure,
      finishing,
      composure,
      assistQuality,
      keeper: def.agg.keeper,
      keeperTrait,
      multiplier,
    });

    this.phase = 'SHOT';
    this.ballHolder = shooter.player.id;
    atk.stats.shots += 1;
    atk.stats.xg += chance.xg;
    shooter.stats.shots += 1;
    shooter.stats.xg += chance.xg;
    if (chance.big) {
      atk.stats.bigChances += 1;
      this.momentumTracker.impulse('BIG_CHANCE', atk.side);
    }
    if (assister) {
      assister.stats.keyPasses += 1;
      this.emit('CHANCE_CREATED', { side: atk.side, player: assister, secondary: shooter, xg: chance.xg, importance: chance.big ? 3 : 2 });
    }
    // The shape this attack was played in, as the other bench sees it.
    // Observed here — the one place every attack ends — and stamped on the
    // event from the same value, so what the opposition has logged and what
    // the replay shows can never disagree.
    const seen = this.observe(atk);
    this.emit('SHOT', {
      side: atk.side, player: shooter, xg: chance.xg, at: this.pointFor(atk.side, chance.x, chance.y),
      importance: chance.big ? 3 : 2,
      detail: { shape: seen.shape, focus: seen.focus },
    });
    this.momentumTracker.impulse('SHOT', atk.side);

    const outcome = opts.penalty
      ? (this.rng.chance(chance.xg) ? 'GOAL' : this.rng.chance(0.6) ? 'SAVE' : 'MISS')
      : resolveShot(this.rng, chance.xg, def.agg.keeper, pressure, keeperTrait);

    switch (outcome) {
      case 'GOAL': {
        atk.stats.shotsOnTarget += 1;
        shooter.stats.shotsOnTarget += 1;
        this.scoreGoal(atk, def, shooter, assister, chance, opts);
        break;
      }
      case 'SAVE': {
        atk.stats.shotsOnTarget += 1;
        shooter.stats.shotsOnTarget += 1;
        if (keeper) { keeper.stats.saves += 1; }
        this.momentumTracker.impulse('SAVE', def.side);
        this.emit('SAVE', {
          side: def.side, player: keeper ?? shooter, xg: chance.xg,
          importance: chance.big ? 3 : 2, tags: chance.big ? ['big'] : undefined,
        });
        this.afterBlockedShot(atk, def);
        break;
      }
      case 'BLOCK': {
        const blocker = this.pickOther(def, STOPPER_WEIGHT, keeper);
        blocker.stats.duelsWon += 1;
        this.emit('BLOCK', { side: def.side, player: blocker, xg: chance.xg, importance: 2 });
        this.afterBlockedShot(atk, def);
        break;
      }
      case 'POST': {
        this.momentumTracker.impulse('POST', atk.side);
        this.emit('POST', { side: atk.side, player: shooter, xg: chance.xg, importance: 3 });
        this.afterBlockedShot(atk, def);
        break;
      }
      default: {
        if (chance.big) {
          shooter.stats.bigChancesMissed += 1;
          atk.stats.bigChancesMissed += 1;
        }
        if (opts.penalty) {
          this.emit('PENALTY_MISSED', { side: atk.side, player: shooter, xg: chance.xg, importance: 4 });
          this.momentumTracker.impulse('PENALTY_MISSED', atk.side);
        } else {
          this.emit('MISS', {
            side: atk.side, player: shooter, xg: chance.xg,
            importance: chance.big ? 3 : 1, tags: chance.big ? ['big'] : undefined,
          });
        }
        this.turnover(atk, def, false);
        break;
      }
    }

    return chance.xg;
  }

  private scoreGoal(
    atk: TeamRuntime, def: TeamRuntime, shooter: PlayerRuntime,
    assister: PlayerRuntime | null,
    chance: { xg: number; distance: number; x: number; y: number; big: boolean },
    opts: { penalty: boolean; header: boolean; counter: boolean; setPiece: boolean },
  ): void {
    const multiplier = this.rules.goalMultiplier(atk.side, {
      distance: chance.distance,
      byCaptain: atk.captain !== null && atk.captain.player.id === shooter.player.id,
    });

    const before = { home: this.homeScore, away: this.awayScore };
    if (atk.side === 'home') this.homeScore += multiplier;
    else this.awayScore += multiplier;

    atk.stats.goals += multiplier;
    shooter.stats.goals += 1;
    if (assister) assister.stats.assists += 1;
    for (const rt of def.onPitch) rt.stats.goalsConcededWhileOn += multiplier;

    this.momentumTracker.impulse('GOAL', atk.side);

    const tags: string[] = [];
    if (opts.penalty) tags.push('penalty');
    if (opts.header) tags.push('header');
    if (opts.counter) tags.push('counter');
    if (opts.setPiece) tags.push('setPiece');
    if (multiplier > 1) tags.push('doubled');
    if (chance.distance > 0.24) tags.push('longRange');
    else if (chance.distance < 0.1 && chance.xg > 0.4) tags.push('tapIn');
    const wasBehind = atk.side === 'home' ? before.home < before.away : before.away < before.home;
    const nowLevel = this.homeScore === this.awayScore;
    if (wasBehind && nowLevel) tags.push('equaliser');
    else if (wasBehind && !nowLevel) tags.push('leadTaken');
    else if (before.home === before.away) tags.push('leadTaken');
    if (this.elapsedFraction() > 0.85) tags.push('late');

    this.emit(opts.penalty ? 'PENALTY_SCORED' : 'GOAL', {
      side: atk.side, player: shooter, secondary: assister, xg: chance.xg,
      at: this.pointFor(atk.side, chance.x, chance.y),
      importance: 5, tags,
      detail: {
        multiplier,
        distance: round(chance.distance, 3),
        // Flagged so the UI can badge it and the balance audit can measure the
        // two scoring regimes separately, as the reference data requires.
        window: this.rules.inSwingWindow(this.nominalMinute()) !== null,
      },
    });

    this.phase = 'CELEBRATION';
    this.celebrating = atk.side;
    this.stopClock(BALANCE.GOAL_RESTART_TICKS);
    this.possession = def.side;
    this.zone = BALANCE.RESTART_ZONE;
    this.channel = 0.5;
    this.counterUntil = -1;
    this.ballHolder = null;
  }

  private afterBlockedShot(atk: TeamRuntime, def: TeamRuntime): void {
    if (this.rng.chance(BALANCE.CORNER_FROM_BLOCK)) {
      atk.stats.corners += 1;
      this.phase = 'SET_PIECE';
      this.emit('CORNER', { side: atk.side, importance: 1 });
      if (this.rng.chance(BALANCE.CORNER_SHOT_CHANCE)) {
        this.zone = 0.88;
        this.takeShot(atk, def, this.effectiveVector(atk), this.effectiveVector(def), {
          counter: false, header: true, setPiece: true, penalty: false, cross: true,
          minute: this.minute(),
        });
        return;
      }
      this.zone = 0.78;
      return;
    }
    this.turnover(atk, def, false);
  }

  private turnover(atk: TeamRuntime, def: TeamRuntime, credited: boolean): void {
    if (credited) {
      const winner = this.pick(def, STOPPER_WEIGHT);
      const loser = this.pick(atk, CARRIER_WEIGHT);
      winner.stats.duelsWon += 1;
      loser.stats.duelsLost += 1;
      if (this.rng.chance(BALANCE.TACKLE_SHARE)) {
        winner.stats.tackles += 1;
        def.stats.tackles += 1;
        this.emit('TACKLE', { side: def.side, player: winner, secondary: loser, importance: 1 });
      } else {
        winner.stats.interceptions += 1;
        def.stats.interceptions += 1;
        this.emit('INTERCEPTION', { side: def.side, player: winner, secondary: loser, importance: 1 });
      }
    }

    const wonHigh = this.zone < 0.45;
    let next = 1 - this.zone;
    if (wonHigh) {
      next += BALANCE.COUNTER_ZONE_BONUS;
      this.momentumTracker.impulse('TURNOVER_HIGH', def.side);
      this.emit('POSSESSION_CHANGE', { side: def.side, importance: 1, tags: ['high'] });
    } else if (this.rng.chance(0.12)) {
      this.emit('POSSESSION_CHANGE', { side: def.side, importance: 1 });
    }

    this.possession = def.side;
    this.zone = clamp(next, 0.08, 0.9);
    this.channel = clamp(1 - this.channel, 0.05, 0.95);
    this.counterUntil = this.tick + BALANCE.COUNTER_WINDOW_TICKS;
    this.phase = 'TRANSITION';
    this.ballHolder = null;
  }

  private recordPass(team: TeamRuntime, completed: boolean): void {
    const passer = this.pick(team, CARRIER_WEIGHT);
    team.stats.passes += 1;
    passer.stats.passes += 1;
    if (completed) {
      team.stats.passesCompleted += 1;
      passer.stats.passesCompleted += 1;
    }
  }

  // -------------------------------------------------------------- systems ---

  private accrueFatigue(): void {
    for (const team of [this.home, this.away]) {
      const vector = this.effectiveVector(team);
      const inPossession = this.possession === team.side;
      let total = 0;
      for (const rt of team.onPitch) {
        rt.ticksOn += 1;
        rt.fatigue = clamp01(rt.fatigue + fatigueDelta({
          player: rt.player,
          conditions: rt.ctx.conditions,
          vector,
          inPossession,
          fatigue: rt.fatigue,
        }));
        rt.stats.distanceCovered += 0.0105 * (0.75 + 0.5 * clamp01(rt.player.attributes.stamina / 99)) * (1 - 0.25 * rt.fatigue);
        if (rt.down > 0) rt.down -= 1;
        total += rt.fatigue;
      }
      team.meanFatigue = team.onPitch.length ? total / team.onPitch.length : 0;
    }
  }

  private maybeInjury(): void {
    for (const team of [this.home, this.away]) {
      const meanFatigue = team.onPitch.length
        ? team.onPitch.reduce((a, p) => a + p.fatigue, 0) / team.onPitch.length
        : 0;
      const p = injuryChance({
        vector: this.effectiveVector(team),
        meanFatigue,
        rivalry: this.rivalry,
      });
      if (!this.rng.chance(p)) continue;

      const victim = this.rng.weighted(team.onPitch, (rt) =>
        (0.3 + rt.fatigue) * Math.max(0.3, 1 + traitModifier(rt.player.traitIds, 'injuryRisk', rt.ctx.conditions)));
      if (victim.injured) continue;

      const { severity, weeksOut } = rollInjury(this.rng, victim.player, victim.ctx.conditions);
      victim.injured = true;
      victim.down = 2;
      this.injuries.push({ playerId: victim.player.id, weeksOut, severity });
      this.momentumTracker.impulse('INJURY', team.side);
      this.stopClock(BALANCE.INJURY_STOPPAGE_TICKS);
      this.emit('INJURY', { side: team.side, player: victim, importance: severity === 'KNOCK' ? 2 : 4 });

      const replacement = this.bestSubFor(team, victim);
      if (severity !== 'KNOCK' && replacement && team.subsUsed < this.setup.config.substitutions) {
        this.performSub(team, victim, replacement);
      } else {
        // No bench left: he stays on, and the team carries the cost all match.
        victim.capacity = BALANCE.INJURED_CAPACITY;
        this.refreshAggregates(team, true);
      }
    }
  }

  private maybeSubstitution(minute: number): void {
    if (this.elapsedFraction() < BALANCE.SUB_EARLIEST_FRACTION) return;
    for (const team of [this.home, this.away]) {
      if (team.subsUsed >= this.setup.config.substitutions) continue;
      if (this.tick - team.lastSubTick < BALANCE.TICKS_PER_MINUTE * 2) continue;

      const threshold = team.tactics.subStrategy === 'AGGRESSIVE' ? BALANCE.SUB_FATIGUE_THRESHOLD - 0.08
        : team.tactics.subStrategy === 'CONSERVATIVE' ? BALANCE.SUB_FATIGUE_THRESHOLD + 0.1
        : BALANCE.SUB_FATIGUE_THRESHOLD;

      let worst: PlayerRuntime | null = null;
      for (const rt of team.onPitch) {
        if (rt.slot.role === 'GK') continue;
        if (rt.fatigue < threshold) continue;
        if (!worst || rt.fatigue > worst.fatigue) worst = rt;
      }
      if (!worst) continue;

      const replacement = this.bestSubFor(team, worst);
      if (!replacement) continue;
      // Only worth it if the fresh man is actually better right now.
      const currentValue = worst.player.overall * (1 - BALANCE.FATIGUE_ATTR_PENALTY * worst.fatigue);
      const freshValue = replacement.player.overall * (1 - BALANCE.FATIGUE_ATTR_PENALTY * replacement.fatigue);
      if (freshValue <= currentValue) continue;

      this.performSub(team, worst, replacement);
      if (minute >= 0) team.lastSubTick = this.tick;
    }
  }

  private bestSubFor(team: TeamRuntime, out: PlayerRuntime): PlayerRuntime | null {
    let best: PlayerRuntime | null = null;
    let bestScore = -Infinity;
    for (const rt of team.bench) {
      if (rt.used || rt.sentOff || rt.injured) continue;
      const fit = rt.player.position === out.slot.position ? 1
        : rt.player.secondaryPositions.includes(out.slot.position) ? 0.9 : 0.72;
      const score = rt.player.overall * fit;
      if (score > bestScore) { bestScore = score; best = rt; }
    }
    return best;
  }

  private performSub(team: TeamRuntime, off: PlayerRuntime, on: PlayerRuntime): void {
    off.onPitch = false;
    on.onPitch = true;
    on.used = true;
    on.slot = off.slot;
    team.onPitch = team.onPitch.map((p) => (p === off ? on : p));
    team.bench = team.bench.filter((p) => p !== on);
    team.subsUsed += 1;
    team.lastSubTick = this.tick;
    this.positions.remove(off.player.id);
    this.positions.place(on.player.id, team.side, on.slot);
    this.stopClock(BALANCE.SUB_STOPPAGE_TICKS);
    this.refreshAggregates(team, true);
    this.momentumTracker.impulse('SUBSTITUTION', team.side);
    this.emit('SUBSTITUTION', { side: team.side, player: off, secondary: on, importance: 2 });
  }

  private sendOff(team: TeamRuntime, rt: PlayerRuntime): void {
    rt.sentOff = true;
    rt.onPitch = false;
    team.onPitch = team.onPitch.filter((p) => p !== rt);
    this.positions.remove(rt.player.id);
    // If the keeper goes, somebody has to go in goal — and it shows.
    if (rt.slot.role === 'GK' && team.onPitch.length > 0) {
      const outfielder = team.onPitch.reduce((a, b) => (a.player.attributes.reflexes >= b.player.attributes.reflexes ? a : b));
      outfielder.slot = { ...rt.slot };
    }
    this.refreshAggregates(team, true);
  }

  private handleRuleWindows(minute?: number): void {
    const transition = this.rules.tick({
      minute: minute ?? this.nominalMinute(),
      homeScore: this.homeScore,
      awayScore: this.awayScore,
    });
    for (const active of transition.started) {
      this.announceRuleStart(active);
      this.applyPlayerReduction(active);
    }
    for (const active of transition.ended) {
      this.restorePlayerReduction(active);
      const rule = specialRuleById(active.ruleId);
      this.emit('SPECIAL_RULE_END', {
        side: active.side === 'both' ? undefined : active.side,
        importance: 3,
        ruleName: rule.name,
        detail: { ruleId: active.ruleId, reason: active.reason },
      });
    }
  }

  private announceRuleStart(active: ActiveSpecialRule): void {
    const rule = specialRuleById(active.ruleId);
    this.emit('SPECIAL_RULE_START', {
      side: active.side === 'both' ? undefined : active.side,
      importance: 4,
      ruleName: rule.name,
      detail: { ruleId: active.ruleId, reason: active.reason, counterplay: rule.counterplay, accent: rule.accent },
    });
  }

  private applyPlayerReduction(active: ActiveSpecialRule): void {
    for (const team of [this.home, this.away]) {
      const n = this.rules.playerReduction(team.side);
      if (n <= 0) continue;
      for (let i = 0; i < n; i++) {
        const outfield = team.onPitch.filter((p) => p.slot.role !== 'GK' && !p.parked);
        if (outfield.length <= 2) break;
        const weakest = outfield.reduce((a, b) => (a.player.overall <= b.player.overall ? a : b));
        weakest.parked = true;
        weakest.onPitch = false;
        team.onPitch = team.onPitch.filter((p) => p !== weakest);
        this.positions.remove(weakest.player.id);
      }
      this.refreshAggregates(team, true);
    }
    void active;
  }

  private restorePlayerReduction(active: ActiveSpecialRule): void {
    if (specialRuleById(active.ruleId).id !== 'NUMBERS_GAME') return;
    for (const team of [this.home, this.away]) {
      for (const rt of team.all) {
        if (!rt.parked) continue;
        rt.parked = false;
        rt.onPitch = true;
        team.onPitch.push(rt);
        this.positions.place(rt.player.id, team.side, rt.slot);
      }
      this.refreshAggregates(team, true);
    }
  }

  private maybeCreatorMoment(): void {
    for (const team of [this.home, this.away]) {
      const presence = clamp01(team.team.creatorPresence);
      if (presence <= 0) continue;
      const minute = this.minute();
      if (minute - team.lastCreatorMinute < BALANCE.CREATOR_MOMENT_GAP_MINUTES) continue;
      if (!this.rng.chance(BALANCE.CREATOR_MOMENT_RATE * presence)) continue;

      team.lastCreatorMinute = minute;
      team.creatorBoostUntil = this.tick + BALANCE.CREATOR_MOMENT_TICKS;
      this.creatorMomentFor = team.side;
      const star = this.rng.weighted(team.onPitch, (rt) =>
        1 + Math.max(0, traitModifier(rt.player.traitIds, 'fanAppeal', rt.ctx.conditions)) * 6 + rt.player.reputation / 40);
      this.momentumTracker.impulse('CREATOR_MOMENT', team.side);
      this.emit('CREATOR_MOMENT', { side: team.side, player: star, importance: 3 });
    }
  }

  private maybeDecision(minute: number, atHalfTime: boolean): void {
    if (this.setup.config.maxDecisions <= 0) return;
    for (const team of [this.home, this.away]) {
      if (this.pending) return;
      const opponent = team.side === 'home' ? this.away : this.home;
      const totalPossession = this.home.stats.possessionTicks + this.away.stats.possessionTicks;
      const tired = team.onPitch
        .filter((p) => p.slot.role !== 'GK')
        .sort((a, b) => b.fatigue - a.fatigue)[0] ?? null;
      const booked = team.onPitch.find((p) => p.yellow >= 1) ?? null;
      const nextWindow = this.rules.windows().find((w) => w.startMinute > this.nominalMinute()) ?? null;

      const situation: DecisionSituation = {
        minute,
        tick: this.tick,
        side: team.side,
        matchId: this.setup.matchId,
        scoreFor: team.side === 'home' ? this.homeScore : this.awayScore,
        scoreAgainst: team.side === 'home' ? this.awayScore : this.homeScore,
        momentum: team.side === 'home' ? this.momentumTracker.current : -this.momentumTracker.current,
        possessionShare: totalPossession > 0 ? team.stats.possessionTicks / totalPossession : 0.5,
        fatigue: team.onPitch.length ? team.onPitch.reduce((a, p) => a + p.fatigue, 0) / team.onPitch.length : 0,
        tiredPlayerName: tired && tired.fatigue > BALANCE.SUB_FATIGUE_THRESHOLD ? tired.player.displayName : null,
        bookedPlayerName: booked ? booked.player.displayName : null,
        injuredNoSubs: team.onPitch.some((p) => p.injured) && team.subsUsed >= this.setup.config.substitutions,
        minutesToWindow: nextWindow ? nextWindow.startMinute - this.nominalMinute() : null,
        atHalfTime: atHalfTime || this.halfTimePrompt,
        opponentChanged: this.opponentChangedFor === team.side,
        creatorMoment: this.creatorMomentFor === team.side,
        elapsedFraction: this.elapsedFraction(),
        opponentName: opponent.team.shortName,
      };

      const prompt = this.decisions.consider(situation);
      if (!prompt) continue;

      this.promptSides.set(prompt.id, team.side);
      this.emit('DECISION_PROMPT', { side: team.side, importance: 4, detail: { promptId: prompt.id, trigger: prompt.trigger } });

      if (this.autoResolve || !team.team.isPlayerControlled || !this.setup.config.liveDecisions) {
        this.applyDecision(prompt, this.aiChoice(prompt));
      } else {
        this.pending = prompt;
        return;
      }
    }
    this.opponentChangedFor = null;
    this.creatorMomentFor = null;
  }

  private aiChoice(prompt: DecisionPrompt): DecisionOption {
    const side = this.promptSides.get(prompt.id) ?? prompt.side;
    const team = this.teamFor(side);
    const trailing = (side === 'home' ? this.homeScore - this.awayScore : this.awayScore - this.homeScore) < 0;
    const appetite = clamp01(team.team.managerBonus.adaptability / 100) * 0.5 + (trailing ? 0.35 : 0);
    return this.rng.weighted(prompt.options, (o) => {
      const risk = o.risk === 'HIGH' ? 1 : o.risk === 'MEDIUM' ? 0.6 : 0.25;
      return 0.4 + (1 - Math.abs(risk - appetite)) * 1.4;
    });
  }

  private applyDecision(prompt: DecisionPrompt, option: DecisionOption): void {
    const side = this.promptSides.get(prompt.id) ?? prompt.side;
    const team = this.teamFor(side);
    team.modifiers.push({
      modifiers: this.decisions.scaleModifiers(option.modifiers),
      untilTick: this.tick + option.durationMinutes * BALANCE.TICKS_PER_MINUTE,
    });
    this.decisions.record(prompt.id, option.id, prompt.minute, prompt.trigger);
    this.noteShapeChange(side);
    this.emit('DECISION_RESOLVED', {
      side, importance: 3,
      detail: { promptId: prompt.id, optionId: option.id, label: option.label, effect: option.effect },
      detailText: option.label,
    });
  }

  private resolveTieBreak(): void {
    if (this.setup.tieBreak !== 'SHOOTOUT') return;
    if (this.homeScore !== this.awayScore) return;

    const stream = this.rng.fork('shootout');
    let homeGoals = 0;
    let awayGoals = 0;
    let round = 0;
    // Three runs each, then sudden death, exactly as the format resolves it live.
    while (round < BALANCE.SHOOTOUT_ROUNDS || homeGoals === awayGoals) {
      for (const team of [this.home, this.away]) {
        const opponent = team === this.home ? this.away : this.home;
        const taker = team.onPitch.length
          ? team.onPitch.reduce((a, b) => (a.player.attributes.finishing >= b.player.attributes.finishing ? a : b))
          : null;
        if (!taker) continue;
        const edge = (taker.player.attributes.finishing - opponent.agg.keeper) / 60;
        const p = clamp01(BALANCE.SHOOTOUT_BASE + BALANCE.SHOOTOUT_EDGE * edge);
        const scored = stream.chance(p);
        if (scored) { if (team === this.home) homeGoals += 1; else awayGoals += 1; }
        this.emit(scored ? 'PENALTY_SCORED' : 'PENALTY_MISSED', {
          side: team.side, player: taker, importance: 4,
          detail: { shootout: true, round: round + 1, homeGoals, awayGoals },
        });
      }
      round += 1;
      if (round > 20) break;
    }
    this.shootoutWinner = homeGoals === awayGoals ? null : homeGoals > awayGoals ? 'home' : 'away';
  }

  private shootoutWinner: Side | null = null;

  // ------------------------------------------------------------- utilities ---

  private teamFor(side: Side): TeamRuntime { return side === 'home' ? this.home : this.away; }

  private elapsedFraction(): number {
    return clamp01(this.tick / Math.max(1, this.totalPlannedTicks));
  }

  /**
   * Minute on the *regulation* clock, which is what the rule windows are
   * anchored to. It parks just inside the window through added time so a window
   * runs to the whistle rather than expiring while the ball is still in play.
   */
  private nominalMinute(): number {
    const halfLength = this.setup.config.minutes / this.setup.config.halves;
    const inPeriod = (this.tick - this.periodStartTick) / BALANCE.TICKS_PER_MINUTE;
    return (this.period - 1) * halfLength + Math.min(inPeriod, halfLength - 0.01);
  }

  private opennessFactor(): number { return this.openness; }

  private supportFactor(side: Side): number {
    return crowdFactor(side, this.support);
  }

  private stopClock(ticks: number): void {
    this.stoppage = Math.max(this.stoppage, ticks);
    this.stoppageTicksThisPeriod += ticks;
  }

  private vectorFor(team: TeamRuntime): TacticVector {
    return toTacticVector(team.tactics, {
      squadQuality: team.squadQuality,
      managerTactical: team.team.managerBonus.tactical,
    });
  }

  /** Base tactics + live decision modifiers + special rule modifiers, re-clamped. */
  private effectiveVector(team: TeamRuntime): TacticVector {
    team.modifiers = team.modifiers.filter((m) => m.untilTick > this.tick);
    const stack: Record<string, number> = {};
    const add = (mods: Readonly<Record<string, number>>): void => {
      for (const [k, v] of Object.entries(mods)) stack[k] = (stack[k] ?? 0) + v;
    };
    for (const m of team.modifiers) add(m.modifiers);
    add(this.rules.modifiersFor(team.side));
    if (this.rules.inSwingWindow(this.nominalMinute())) add(BALANCE.SWING_WINDOW_MODIFIERS);
    if (this.rivalry > 0) stack['volatility'] = (stack['volatility'] ?? 0) + BALANCE.RIVALRY_VOLATILITY * this.rivalry;
    return Object.keys(stack).length ? applyVectorModifiers(team.baseVector, stack) : team.baseVector;
  }

  /** Rebuilt every AGGREGATE_REFRESH_TICKS, or immediately when the eleven changes. */
  private refreshAggregates(team: TeamRuntime, force: boolean): void {
    if (!force && this.tick - team.aggTick < BALANCE.AGGREGATE_REFRESH_TICKS) return;
    team.aggTick = this.tick;

    const conditions = this.baseConditions(team.side);
    const atmosphere = team.side === 'home' ? this.support : -this.support * 0.6;

    const units: UnitView[] = team.onPitch.map((rt) => {
      const playerConditions = conditions.slice();
      if (rt.player.age <= 21) playerConditions.push('YOUNG');
      if (rt.player.age >= 31) playerConditions.push('VETERAN');
      rt.ctx = {
        conditions: playerConditions,
        slotPosition: rt.slot.position as Position,
        fatigue: rt.fatigue,
        capacity: rt.capacity,
        atmosphere,
        pressure: this.pressure,
      };
      return { player: rt.player, role: rt.slot.role as SlotRole, ctx: rt.ctx };
    });

    const raw = computeAggregates(units, Math.max(1, this.setup.config.playersOnPitch - 1));
    const p = team.performance;
    team.agg = {
      ...raw,
      attack: raw.attack * p,
      creation: raw.creation * p,
      progression: raw.progression * p,
      defence: raw.defence * p,
      pressing: raw.pressing * p,
      aerial: raw.aerial * p,
      keeper: raw.keeper * p,
    };
  }

  private baseConditions(side: Side): TraitCondition[] {
    const out: TraitCondition[] = [];
    if (this.setup.importance >= 4) out.push('BIG_MATCH');
    if (this.setup.isDerby) out.push('DERBY');
    if (this.elapsedFraction() > 0.75) out.push('LATE_GAME');
    const behind = side === 'home' ? this.homeScore < this.awayScore : this.awayScore < this.homeScore;
    if (behind) out.push('LOSING');
    if (side === 'home' && !this.setup.neutralVenue) out.push('HOME');
    return out;
  }

  private pick(
    team: TeamRuntime,
    weights: Record<SlotRole, number>,
    extra?: (p: PlayerRuntime) => number,
  ): PlayerRuntime {
    const pool = team.onPitch.length ? team.onPitch : team.all;
    return this.rng.weighted(pool, (rt) => {
      const base = weights[rt.slot.role as SlotRole] ?? 1;
      if (base <= 0) return 0.01;
      return base * (0.4 + rt.player.overall / 70) * (extra ? extra(rt) : 1);
    });
  }

  private pickOther(
    team: TeamRuntime,
    weights: Record<SlotRole, number>,
    exclude: PlayerRuntime | null,
  ): PlayerRuntime {
    const pool = team.onPitch.filter((p) => p !== exclude);
    if (pool.length === 0) return this.pick(team, weights);
    return this.rng.weighted(pool, (rt) => {
      const base = weights[rt.slot.role as SlotRole] ?? 1;
      return Math.max(0.01, base) * (0.4 + rt.player.overall / 70);
    });
  }

  private pointFor(side: Side, x: number, y: number): PitchPoint {
    return side === 'home' ? { x, y } : { x: 1 - x, y: 1 - y };
  }

  private fullTimeTags(): string[] {
    const margin = Math.abs(this.homeScore - this.awayScore);
    if (margin === 0) return ['draw'];
    if (margin === 1) return ['narrow'];
    if (margin >= 3) return ['comfortable'];
    return [];
  }

  // ---------------------------------------------------------------- events ---

  private emit(type: MatchEventType, opts: {
    side?: Side;
    player?: PlayerRuntime | null;
    secondary?: PlayerRuntime | null;
    xg?: number;
    at?: PitchPoint;
    importance?: MatchEvent['importance'];
    tags?: readonly string[];
    detail?: Readonly<Record<string, string | number | boolean>>;
    ruleName?: string;
    detailText?: string;
    /** Restrict commentary to the tagged lines rather than merely preferring them. */
    exclusiveTags?: boolean;
  } = {}): void {
    this.eventSeq += 1;
    const side = opts.side;
    const team = side ? this.teamFor(side) : null;
    const opponent = side ? this.teamFor(side === 'home' ? 'away' : 'home') : null;

    const ctx: CommentaryContext = {
      player: opts.player?.player.displayName,
      club: team?.team.shortName ?? this.home.team.shortName,
      opponent: opponent?.team.shortName ?? this.away.team.shortName,
      minute: Math.floor(this.tick / BALANCE.TICKS_PER_MINUTE),
      score: `${this.homeScore}-${this.awayScore}`,
      assist: opts.secondary?.player.displayName,
      rule: opts.ruleName,
      detail: opts.detailText,
    };

    const text = this.commentary.line(
      type, ctx,
      opts.tags ? { tags: opts.tags, ...(opts.exclusiveTags ? { exclusive: true } : {}) } : {},
    );

    const event: MatchEvent = {
      id: `${this.setup.matchId}:${this.eventSeq}`,
      type,
      minute: ctx.minute ?? 0,
      tick: this.tick,
      ...(side ? { side, clubId: team?.team.clubId } : {}),
      ...(opts.player ? { playerId: opts.player.player.id } : {}),
      ...(opts.secondary ? { secondaryPlayerId: opts.secondary.player.id } : {}),
      ...(opts.at ? { at: opts.at } : {}),
      ...(opts.xg !== undefined ? { xg: round(opts.xg, 4) } : {}),
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      momentum: round(this.momentumTracker.current, 3),
      text,
      importance: opts.importance ?? 1,
      ...(opts.detail ? { detail: opts.detail } : {}),
    };
    this.events.push(event);

    if (opts.xg !== undefined && side) {
      const minute = event.minute;
      const team2 = this.teamFor(side);
      const other = this.teamFor(side === 'home' ? 'away' : 'home');
      if (type === 'SHOT' || type === 'PENALTY_AWARDED') {
        pushAt(team2.xgFor, minute, opts.xg);
        pushAt(other.xgAgainst, minute, opts.xg);
      }
    }
  }

  // ---------------------------------------------------------------- result ---

  private buildResult(): MatchResult {
    const playerStats: Record<string, PlayerMatchStats> = {};
    const motmCandidates: { playerId: PlayerId; side: Side; rating: number; goals: number; assists: number; minutes: number }[] = [];

    const winner: Side | 'draw' = this.homeScore > this.awayScore ? 'home'
      : this.awayScore > this.homeScore ? 'away'
      : this.shootoutWinner ?? 'draw';

    for (const team of [this.home, this.away]) {
      const conceded = team.side === 'home' ? this.awayScore : this.homeScore;
      for (const rt of team.all) {
        if (rt.ticksOn === 0) continue;
        const minutes = Math.max(1, Math.round(rt.ticksOn / BALANCE.TICKS_PER_MINUTE));
        const rating = ratePlayer({
          playerId: rt.player.id,
          role: rt.slot.role as SlotRole,
          minutes,
          goals: rt.stats.goals,
          assists: rt.stats.assists,
          shots: rt.stats.shots,
          shotsOnTarget: rt.stats.shotsOnTarget,
          keyPasses: rt.stats.keyPasses,
          passes: rt.stats.passes,
          passesCompleted: rt.stats.passesCompleted,
          tackles: rt.stats.tackles,
          interceptions: rt.stats.interceptions,
          duelsWon: rt.stats.duelsWon,
          duelsLost: rt.stats.duelsLost,
          saves: rt.stats.saves,
          yellowCards: rt.stats.yellowCards,
          redCards: rt.stats.redCards,
          bigChancesMissed: rt.stats.bigChancesMissed,
          goalsConcededWhileOn: rt.stats.goalsConcededWhileOn,
          cleanSheet: conceded === 0 && minutes >= this.setup.config.minutes * 0.6,
          matchMinutes: this.setup.config.minutes,
        });

        playerStats[rt.player.id] = {
          playerId: rt.player.id,
          minutes,
          goals: rt.stats.goals,
          assists: rt.stats.assists,
          shots: rt.stats.shots,
          shotsOnTarget: rt.stats.shotsOnTarget,
          xg: round(rt.stats.xg, 3),
          passes: rt.stats.passes,
          passesCompleted: rt.stats.passesCompleted,
          keyPasses: rt.stats.keyPasses,
          tackles: rt.stats.tackles,
          interceptions: rt.stats.interceptions,
          duelsWon: rt.stats.duelsWon,
          duelsLost: rt.stats.duelsLost,
          saves: rt.stats.saves,
          fouls: rt.stats.fouls,
          yellowCards: rt.stats.yellowCards,
          redCards: rt.stats.redCards,
          distanceCovered: round(rt.stats.distanceCovered, 2),
          endStamina: round((1 - rt.fatigue) * 100, 1),
          rating,
        };

        motmCandidates.push({
          playerId: rt.player.id, side: team.side, rating,
          goals: rt.stats.goals, assists: rt.stats.assists, minutes,
        });
      }
    }

    const totalPossession = Math.max(1, this.home.stats.possessionTicks + this.away.stats.possessionTicks);
    const teamStats = (team: TeamRuntime, goals: number): TeamMatchStats => ({
      clubId: team.team.clubId,
      goals,
      possession: round((team.stats.possessionTicks / totalPossession) * 100, 1),
      shots: team.stats.shots,
      shotsOnTarget: team.stats.shotsOnTarget,
      xg: round(team.stats.xg, 3),
      passes: team.stats.passes,
      passAccuracy: team.stats.passes > 0 ? round((team.stats.passesCompleted / team.stats.passes) * 100, 1) : 0,
      tackles: team.stats.tackles,
      interceptions: team.stats.interceptions,
      corners: team.stats.corners,
      fouls: team.stats.fouls,
      offsides: team.stats.offsides,
      yellowCards: team.stats.yellowCards,
      redCards: team.stats.redCards,
      bigChances: team.stats.bigChances,
      bigChancesMissed: team.stats.bigChancesMissed,
    });

    const timelines: Record<Side, XgTimeline> = {
      home: { forSide: this.home.xgFor, against: this.home.xgAgainst },
      away: { forSide: this.away.xgFor, against: this.away.xgAgainst },
    };
    const decisions: DecisionOutcome[] = evaluateDecisions(
      this.decisions.recorded(),
      timelines,
      (promptId) => this.promptSides.get(promptId) ?? 'home',
      Math.ceil(this.totalPlannedTicks / BALANCE.TICKS_PER_MINUTE),
    );

    const keyMoment = this.events
      .filter((e) => e.type === 'GOAL' || e.type === 'PENALTY_SCORED' || e.type === 'RED_CARD')
      .sort((a, b) => (b.importance - a.importance) || (b.tick - a.tick))[0] ?? null;

    return {
      matchId: this.setup.matchId,
      seed: this.setup.seed,
      homeClubId: this.home.team.clubId,
      awayClubId: this.away.team.clubId,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      winner,
      events: this.events,
      homeStats: teamStats(this.home, this.homeScore),
      awayStats: teamStats(this.away, this.awayScore),
      playerStats,
      motmPlayerId: pickManOfTheMatch(motmCandidates, winner),
      momentumTimeline: this.perMinuteMomentum(),
      specialRules: this.rules.history(),
      decisions,
      attendance: this.setup.attendance,
      importance: this.setup.importance,
      keyMomentEventId: keyMoment ? keyMoment.id : null,
      injuries: this.injuries,
      // The cards actually spent in this match. A rule card is a consumable and
      // the engine is the only thing that knows whether one was legally played,
      // so it reports them here for the save layer to deduct from the club's
      // inventory. Without this the caller had nothing to key a decrement on
      // and a card earned once could be played in every match forever.
      ruleCardsPlayed: this.cardsPlayed.map((c) => ({ ...c })),
      durationMinutes: Math.round(this.tick / BALANCE.TICKS_PER_MINUTE),
    };
  }

  private perMinuteMomentum(): number[] {
    const out: number[] = [];
    const tpm = BALANCE.TICKS_PER_MINUTE;
    for (let i = 0; i < this.momentumTimeline.length; i += tpm) {
      out.push(round(this.momentumTimeline[i] ?? 0, 3));
    }
    return out;
  }

  /** Share of the match clock the ball was actually in play. Used by the balance tests. */
  ballInPlayShare(): number {
    return this.tick > 0 ? this.playTicks / this.tick : 0;
  }
}

function pushAt(arr: number[], index: number, value: number): void {
  while (arr.length <= index) arr.push(0);
  arr[index] = (arr[index] ?? 0) + value;
}

/**
 * Runs the whole match with no player input. Deterministic given the seed:
 * calling this twice with the same setup returns identical results.
 */
export function simulateMatch(setup: MatchSetup): MatchResult {
  const sim = new MatchSimulator(setup);
  return sim.finish();
}
