import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  FixtureId, MatchEvent, MatchSimulator, Player, PlayerId, SpecialRuleDefinition, SpecialRuleId,
  TacticSetup,
} from '@cf/engine';
import {
  ErrorState, GlassPanel, GlassSheet, GoalBurst, SheetCloseRow, Skeleton, cn, useIsWide,
} from '@/design';
import { useGameStore } from '@/state/gameStore';
import { useMatchStore } from '@/state/matchStore';
import { useMatchdayContext } from '../shared/context';
import { Announcer } from '../shared/Announcer';
import { kitColors, paletteFor } from '../shared/kit';
import { isGoalEvent, minuteLabel, stateOfPlay } from '../shared/format';
import { MatchControlBar, MatchHeader } from './MatchChrome';
import { PitchView } from './PitchView';
import { BroadcastView } from './BroadcastView';
import { EventFeed, EventTicker } from './EventFeed';
import { DecisionOverlay } from './DecisionOverlay';
import { RuleCardSheet, SubstitutionSheet, TacticsSheet } from './MatchSheets';

/**
 * The live match.
 *
 * ## Why this one screen is not built on `Screen`
 *
 * Every other route in the product is a `Screen`: a fixed header over a
 * scrolling body with a large-title handoff. This route is the one the router
 * already declares immersive (`IMMERSIVE_PREFIXES` in `app/routes.ts`) and it
 * owns the whole viewport — the pitch must never scroll out of view, and the
 * body must never scroll at all on a phone. So it is a three-band flex column
 * of its own: header, stage, control bar. It still uses the design system for
 * every surface, keeps to the same one-blurring-header budget, and hands the
 * second and last blur to whichever overlay is open.
 *
 * ## Ownership of the simulation
 *
 * The screen owns the `MatchSimulator` instance and hands it to the match store
 * to drive. Substitutions, tactical changes and rule cards go straight to the
 * simulator (the store's own helpers hardcode the home side, which is wrong for
 * an away fixture); the decision resolution goes through the store, because
 * only the store knows how to restart the clock afterwards.
 */

export function MatchLiveScreen(): ReactNode {
  const params = useParams<{ fixtureId: string }>();
  const fixtureId = params.fixtureId as FixtureId | undefined;
  const navigate = useNavigate();
  const wide = useIsWide();

  const context = useMatchdayContext(fixtureId);
  const simRef = useRef<MatchSimulator | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const playback = useMatchStore((s) => s.playback);
  const presentation = useMatchStore((s) => s.presentation);
  const result = useMatchStore((s) => s.result);
  const highlight = useMatchStore((s) => s.highlight);

  const [subsUsed, setSubsUsed] = useState(0);
  const [tactics, setTactics] = useState<TacticSetup | null>(null);
  const [cards, setCards] = useState<
    readonly { readonly definition: SpecialRuleDefinition; readonly quantity: number }[]
  >([]);
  const [sheet, setSheet] = useState<'SUBS' | 'TACTICS' | 'CARDS' | 'FEED' | null>(null);

  /* --- simulator lifecycle -------------------------------------------- */

  useEffect(() => {
    if (!fixtureId) return;
    const sim = useGameStore.getState().createSimulator(fixtureId);
    if (!sim) { setFailed(true); return; }

    simRef.current = sim;
    useMatchStore.getState().attach(sim);
    setReady(true);
    // Kick off immediately: the player already pressed PLAY on the preview and
    // a second confirmation here would be a door in front of a door.
    useMatchStore.getState().play();

    return () => {
      // Deliberately not `reset()`: the result screen reads the finished
      // `MatchResult` off this store. `pause()` is enough to stop the clock.
      useMatchStore.getState().pause();
      simRef.current = null;
      setReady(false);
    };
  }, [fixtureId]);

  useEffect(() => {
    if (context && !tactics) setTactics(context.us.tactics);
  }, [context, tactics]);

  useEffect(() => {
    if (context && cards.length === 0) {
      setCards(context.heldCards.map((c) => ({ definition: c.definition, quantity: c.quantity })));
    }
    // Only seeds once from the world state; playing a card mutates local copies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  /* --- completion ------------------------------------------------------ */

  const goal = highlight && isGoalEvent(highlight) ? highlight : null;

  useEffect(() => {
    // A last-minute winner must be allowed to finish celebrating before the
    // post-match sequence takes the screen, so the handoff waits for the burst.
    if (playback !== 'COMPLETE' || !result || goal) return;
    // A short beat on the final whistle: cutting instantly reads as a page load.
    const timer = setTimeout(() => navigate(`/matchday/result/${result.matchId}`), 900);
    return () => clearTimeout(timer);
  }, [playback, result, navigate, goal]);

  /* --- goal interruption ---------------------------------------------- */

  useEffect(() => {
    if (!highlight) return;
    // Only goals earn the hero moment. Everything else the store flagged as
    // important is already carried by the feed and the header.
    if (!isGoalEvent(highlight)) {
      useMatchStore.getState().clearHighlight();
      return;
    }
    useMatchStore.getState().pause();
  }, [highlight]);

  const dismissGoal = useCallback(() => {
    useMatchStore.getState().clearHighlight();
    if (useMatchStore.getState().playback !== 'COMPLETE') useMatchStore.getState().play();
  }, []);

  /* --- derived, stable ------------------------------------------------- */

  const setup = simRef.current?.setup ?? null;
  const playerSide = context?.playerIsHome ? 'home' : 'away';

  const squad: readonly Player[] = useMemo(() => {
    if (!setup) return [];
    return playerSide === 'home' ? setup.home.players : setup.away.players;
  }, [setup, playerSide]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of setup?.home.players ?? []) map.set(p.id, p.displayName);
    for (const p of setup?.away.players ?? []) map.set(p.id, p.displayName);
    return map;
  }, [setup]);

  const { numbers, keepers } = useMemo(() => {
    const n: Record<string, number> = {};
    const k: Record<string, boolean> = {};
    for (const p of [...(setup?.home.players ?? []), ...(setup?.away.players ?? [])]) {
      if (p.shirtNumber !== null) n[p.id] = p.shirtNumber;
      if (p.position === 'GK') k[p.id] = true;
    }
    return { numbers: n, keepers: k };
  }, [setup]);

  const homePalette = useMemo(() => (context ? paletteFor(context.home) : null), [context]);
  const awayPalette = useMemo(() => (context ? paletteFor(context.away) : null), [context]);
  const ourKit = useMemo(() => (context ? kitColors(context.us.id, context.us.visual) : null), [context]);

  const subsAllowed = setup?.config.substitutions ?? 0;
  const subsRemaining = Math.max(0, subsAllowed - subsUsed);

  /* --- actions --------------------------------------------------------- */

  const substitute = useCallback((out: PlayerId, in_: PlayerId): boolean => {
    const sim = simRef.current;
    if (!sim) return false;
    const ok = sim.makeSubstitution(playerSide, out, in_);
    if (ok) setSubsUsed((n) => n + 1);
    return ok;
  }, [playerSide]);

  const applyTactics = useCallback((change: Partial<TacticSetup>): void => {
    const sim = simRef.current;
    if (!sim) return;
    sim.applyTacticalChange(playerSide, change);
    setTactics((current) => (current ? { ...current, ...change } : current));
  }, [playerSide]);

  const playCard = useCallback((ruleId: SpecialRuleId): boolean => {
    const sim = simRef.current;
    if (!sim) return false;
    const ok = sim.playRuleCard(playerSide, ruleId);
    if (ok) {
      setCards((current) =>
        current
          .map((c) => (c.definition.id === ruleId ? { ...c, quantity: c.quantity - 1 } : c))
          .filter((c) => c.quantity > 0),
      );
    }
    return ok;
  }, [playerSide]);

  const exit = useCallback(() => {
    useMatchStore.getState().reset();
    navigate('/matchday');
  }, [navigate]);

  /* --- announcements ---------------------------------------------------- */

  const { urgent, polite } = useAnnouncements(playerSide === 'home');

  /* --- render ----------------------------------------------------------- */

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center bg-base p-6">
        <ErrorState
          title="This match could not be started"
          description="The fixture is missing or already played."
          onRetry={() => navigate('/matchday')}
          retryLabel="Back to matchday"
        />
      </div>
    );
  }

  if (!context || !ready || !homePalette || !awayPalette || !ourKit || !tactics) {
    return (
      <div className="flex h-full flex-col gap-3 bg-base p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="min-h-0 flex-1 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const stage =
    presentation === 'PITCH' ? (
      <PitchView
        homePalette={homePalette}
        awayPalette={awayPalette}
        playerSide={playerSide}
        numbers={numbers}
        keepers={keepers}
        orientation={wide ? 'horizontal' : 'vertical'}
        className="h-full w-full"
      />
    ) : (
      <BroadcastView
        home={context.home}
        away={context.away}
        homePalette={homePalette}
        awayPalette={awayPalette}
        playerSide={playerSide}
        tactics={tactics}
        className="h-full"
      />
    );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-base">
      <MatchHeader
        home={context.home}
        away={context.away}
        totalMinutes={setup?.config.minutes ?? 30}
        onExit={exit}
      />

      <main
        className={cn(
          'relative min-h-0 flex-1 px-3 pt-3 sm:px-5',
          // Side-by-side pitch and feed on a wide screen. Broadcast mode already
          // carries its own feed, so it takes the full column instead.
          wide && 'mx-auto w-full max-w-[1180px] gap-4',
          wide && presentation === 'PITCH' && 'grid grid-cols-[minmax(0,1fr)_340px]',
        )}
      >
        <div className="flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">{stage}</div>
          {!wide && presentation === 'PITCH' && (
            <EventTicker onPress={() => setSheet('FEED')} />
          )}
        </div>

        {wide && presentation === 'PITCH' && (
          <GlassPanel nested level={2} padding="sm" className="flex min-h-0 flex-col" title="Match feed">
            <div className="scroll-y min-h-0 flex-1">
              <EventFeed perspective={playerSide} />
            </div>
          </GlassPanel>
        )}
      </main>

      <MatchControlBar
        subsRemaining={subsRemaining}
        ruleCardCount={cards.reduce((total, c) => total + c.quantity, 0)}
        onOpenSubs={() => setSheet('SUBS')}
        onOpenTactics={() => setSheet('TACTICS')}
        onOpenCards={() => setSheet('CARDS')}
      />

      <DecisionOverlay />

      <SubstitutionSheet
        open={sheet === 'SUBS'}
        onClose={() => setSheet(null)}
        squad={squad}
        kit={ourKit}
        subsRemaining={subsRemaining}
        onSubstitute={substitute}
      />

      <TacticsSheet
        open={sheet === 'TACTICS'}
        onClose={() => setSheet(null)}
        tactics={tactics}
        formationName={context.formation.name}
        onChange={applyTactics}
      />

      <RuleCardSheet
        open={sheet === 'CARDS'}
        onClose={() => setSheet(null)}
        cards={cards}
        onPlay={playCard}
      />

      <GlassSheet
        open={sheet === 'FEED'}
        onClose={() => setSheet(null)}
        size="tall"
        title="Match feed"
        footer={<SheetCloseRow onClose={() => setSheet(null)} label="Back to the match" />}
      >
        <EventFeed perspective={playerSide} />
      </GlassSheet>

      <GoalBurst
        open={goal !== null}
        onDismiss={dismissGoal}
        scorer={goal?.playerId ? names.get(goal.playerId) ?? 'Unknown' : 'Unknown'}
        assist={goal?.secondaryPlayerId ? names.get(goal.secondaryPlayerId) : undefined}
        minute={goal?.minute ?? 0}
        homeScore={goal?.homeScore ?? 0}
        awayScore={goal?.awayScore ?? 0}
        accent={goal?.side === 'away' ? awayPalette.primary : homePalette.primary}
        flavour={goal ? goalFlavour(goal) : undefined}
      />

      <Announcer urgent={urgent} polite={polite} />
    </div>
  );
}

/** The one-word badge over a goal. Read off the event, never guessed. */
function goalFlavour(goal: MatchEvent): string | undefined {
  if (goal.type === 'PENALTY_SCORED') return 'PENALTY';
  const multiplier = goal.detail?.multiplier;
  if (typeof multiplier === 'number' && multiplier > 1) return `${multiplier}× GOAL`;
  const distance = goal.detail?.distance;
  if (typeof distance === 'number' && distance > 0.24) return 'SCREAMER';
  if (typeof goal.xg === 'number' && goal.xg < 0.08) return 'OUT OF NOTHING';
  return undefined;
}

/**
 * What a screen reader hears.
 *
 * Goals, cards, decisions and the final whistle interrupt; everything else
 * queues. Without this the most important thirty minutes in the product are
 * completely silent to a VoiceOver user.
 */
function useAnnouncements(playerIsHome: boolean): { urgent: string | null; polite: string | null } {
  const feed = useMatchStore((s) => s.feed);
  const decision = useMatchStore((s) => s.decision);
  const playback = useMatchStore((s) => s.playback);
  const homeScore = useMatchStore((s) => s.homeScore);
  const awayScore = useMatchStore((s) => s.awayScore);

  return useMemo(() => {
    if (decision) {
      return {
        urgent: `Decision at ${minuteLabel(decision.minute)}. ${decision.situation} ${decision.options.length} options.`,
        polite: null,
      };
    }
    if (playback === 'COMPLETE') {
      return { urgent: `Full time. ${stateOfPlay(homeScore, awayScore, playerIsHome)}.`, polite: null };
    }
    const latest = feed[0];
    if (!latest) return { urgent: null, polite: null };
    if (latest.importance >= 4) {
      return {
        urgent: `${minuteLabel(latest.minute)} ${latest.text} ${stateOfPlay(homeScore, awayScore, playerIsHome)}.`,
        polite: null,
      };
    }
    return { urgent: null, polite: `${minuteLabel(latest.minute)} ${latest.text}` };
  }, [feed, decision, playback, homeScore, awayScore, playerIsHome]);
}
