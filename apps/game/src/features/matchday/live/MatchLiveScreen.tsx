import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  FixtureId, MatchEvent, MatchSimulator, Player, PlayerId, SpecialRuleDefinition, SpecialRuleId,
  TacticSetup,
} from '@cf/engine';
import { ErrorState, GlassButton, Skeleton, cn, sfx, useConfirm, useIsWide } from '@/design';
import { onNativeBack } from '@/platform/nativeBack';
import { useGameStore } from '@/state/gameStore';
import { useMatchStore, type MatchSpeed } from '@/state/matchStore';
import { useMatchdayContext } from '../shared/context';
import { Announcer } from '../shared/Announcer';
import { kitColors, paletteFor, roleOfPosition, type PitchRole } from '../shared/kit';
import { isGoalEvent, matchExitPlan, minuteLabel, stateOfPlay } from '../shared/format';
import { MatchControlRail, MatchHeader } from './MatchChrome';
import { PitchStage } from './PitchStage';
import { StoryPanel } from './StoryPanel';
import { DecisionOverlay } from './DecisionOverlay';
import { MatchIntro } from './MatchIntro';
import { GoalMoment } from './GoalMoment';
import { useDrama } from './useDrama';
import { RuleCardSheet, SpeedSheet, SubstitutionSheet, TacticsSheet } from './MatchSheets';
import type { PitchCamera } from './pitchRenderer';
import { ArtImage } from '@/design/premium/components';

/**
 * The live match.
 *
 * ## Why this one screen is not built on `Screen`
 *
 * Every other route in the product is a `Screen`: a fixed header over a
 * scrolling body with a large-title handoff. This route is the one the router
 * already declares immersive (`IMMERSIVE_PREFIXES` in `app/routes.ts`) and it
 * owns the whole viewport — the pitch must never scroll out of view, and the
 * body must never scroll at all on a phone. So it is a four-band flex column of
 * its own: header, pitch, story, control rail. It still uses the design system
 * for every surface, keeps to the same one-blurring-header budget, and hands
 * the second and last blur to whichever overlay is open.
 *
 * ## How the height is spent
 *
 * The pitch is pinned to a landscape aspect ratio rather than stretched to fill
 * whatever is left. A football pitch is roughly 16:10 and drawing it at any
 * other shape distorts every distance on it — which is the whole information
 * content of a tactical view. So the pitch takes exactly the height its width
 * earns it, and *everything else* goes to the story panel, which grows to fill
 * the remainder. There is no unallocated space on this screen at any phone
 * size; the previous layout left roughly four hundred points of it.
 *
 * ## Ownership of the simulation
 *
 * The screen owns the `MatchSimulator` instance and hands it to the match store
 * to drive. Substitutions, tactical changes and rule cards go straight to the
 * simulator (the store's own helpers hardcode the home side, which is wrong for
 * an away fixture); the decision resolution goes through the store, because
 * only the store knows how to restart the clock afterwards.
 *
 * Nothing on this screen decides a football outcome. The intro reads the
 * matchday context, the goal moment reads the goal event, the dramatic
 * slow-down reads the event stream and changes only the wall-clock interval
 * between ticks, and the camera is a paint-time transform. The simulator would
 * produce the identical `MatchResult` with every one of them removed.
 */

export function MatchLiveScreen(): ReactNode {
  const params = useParams<{ fixtureId: string }>();
  const fixtureId = params.fixtureId as FixtureId | undefined;
  const navigate = useNavigate();
  const wide = useIsWide();
  const confirm = useConfirm();

  const context = useMatchdayContext(fixtureId);
  const simRef = useRef<MatchSimulator | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const playback = useMatchStore((s) => s.playback);
  const result = useMatchStore((s) => s.result);
  const highlight = useMatchStore((s) => s.highlight);
  const liveFeed = useMatchStore((s) => s.feed);
  const presentation = useGameStore((s) => s.state?.settings.presentation ?? 'PITCH');
  const saveError = useGameStore((s) => s.saveError);

  // The most recently opened rule window that has not closed. The pitch takes
  // this as a trigger: a change of value replays the sweep, and null means no
  // window is open, so a rule that ends leaves nothing running.
  const openRuleKey = useMemo(() => {
    const ended = new Set<string>();
    // Newest-first, so an END seen before its START means the window is closed.
    for (const event of liveFeed) {
      const ruleId = typeof event.detail?.ruleId === 'string' ? event.detail.ruleId : null;
      if (ruleId === null) continue;
      if (event.type === 'SPECIAL_RULE_END') ended.add(ruleId);
      else if (event.type === 'SPECIAL_RULE_START' && !ended.has(ruleId)) {
        return `${ruleId}-${String(event.minute)}`;
      }
    }
    return null;
  }, [liveFeed]);

  const [intro, setIntro] = useState(true);
  const [camera, setCamera] = useState<PitchCamera>('WIDE');
  const [speed, setSpeedState] = useState<MatchSpeed>(() => useGameStore.getState().state?.settings.matchSpeed ?? 'NORMAL');
  const [celebrating, setCelebrating] = useState<MatchEvent | null>(null);
  const [subsUsed, setSubsUsed] = useState(0);
  const [tactics, setTactics] = useState<TacticSetup | null>(null);
  const [cards, setCards] = useState<
    readonly { readonly definition: SpecialRuleDefinition; readonly quantity: number }[]
  >([]);
  const [sheet, setSheet] = useState<'SUBS' | 'TACTICS' | 'CARDS' | 'SPEED' | null>(null);

  /* --- simulator lifecycle -------------------------------------------- */

  useEffect(() => {
    if (!fixtureId) return;
    const sim = useGameStore.getState().createSimulator(fixtureId);
    if (!sim) { setFailed(true); return; }

    simRef.current = sim;
    useMatchStore.getState().attach(sim);
    const settings = useGameStore.getState().state?.settings;
    if (settings) {
      useMatchStore.getState().setSpeed(settings.matchSpeed);
      useMatchStore.getState().setPresentation(settings.presentation);
      useMatchStore.getState().setAutoDecisionTimeout(settings.autoDecisionTimeout);
    }
    setReady(true);
    // Deliberately not `play()` here: the walk-out sequence starts the match
    // when it hands the screen over, and a match already running behind a
    // full-screen intro would spend its opening minute unwatched.

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

  /* --- the walk-out ---------------------------------------------------- */

  const startMatch = useCallback(() => {
    setIntro(false);
    useMatchStore.getState().play();
  }, []);

  /* --- goals ------------------------------------------------------------ */

  /**
   * A goal is lifted out of the store immediately and held here for the length
   * of the celebration. Holding it locally rather than leaving it in
   * `highlight` means the store is free to flag the next big moment while this
   * one is still being celebrated, and the sequence can outlive the event that
   * started it.
   */
  useEffect(() => {
    if (!highlight) return;
    const store = useMatchStore.getState();
    store.clearHighlight();
    // Only goals earn the hero moment. Everything else the store flagged as
    // important is already carried by the feed, the header and the drama beat.
    if (!isGoalEvent(highlight)) return;
    store.pause();
    setCelebrating(highlight);
  }, [highlight]);

  const resumeAfterGoal = useCallback(() => {
    if (useMatchStore.getState().playback !== 'COMPLETE') useMatchStore.getState().play();
  }, []);

  const goalFinished = useCallback(() => setCelebrating(null), []);

  /* --- the crowd ------------------------------------------------------- */

  /**
   * The bed runs for exactly as long as there is a match to watch: it starts
   * when the walk-out hands over and stops on the final whistle, on the way
   * out, and whenever the tab is hidden (the audio module's own doing). A menu
   * that hums is a menu the player mutes.
   */
  useEffect(() => {
    if (!ready || intro || playback === 'COMPLETE') return;
    sfx.ambience(true);
    return () => sfx.ambience(false);
  }, [ready, intro, playback]);

  /* --- the dramatic beat ------------------------------------------------ */

  const drama = useDrama(speed, ready && !intro && celebrating === null);

  /* --- completion ------------------------------------------------------- */

  // Three peeps, the moment the clock says so — not when the result screen
  // eventually mounts, which is a second and a celebration later.
  useEffect(() => {
    if (playback !== 'COMPLETE') return;
    sfx.fullTime();
  }, [playback, result]);

  /**
   * The result is written to the save before the report opens, so a crash
   * during the post-match sequence cannot cost the player the match. A write
   * the device refuses used to leave the screen frozen on "Full time" with no
   * way forward but the X — which dropped the result. Now the failure is shown
   * with a retry, and the result stays in memory (this store, and the game
   * store's `latestMatchReport`) until it is saved or the player chooses to
   * carry on without it. `saveAttempt` is the retry: each bump runs the write
   * again, at once.
   */
  const [saveStatus, setSaveStatus] = useState<'WAITING' | 'SAVING' | 'FAILED'>('WAITING');
  const [saveAttempt, setSaveAttempt] = useState(0);

  useEffect(() => {
    // A last-minute winner must be allowed to finish celebrating before the
    // post-match sequence takes the screen, so the handoff waits for the burst.
    // `ready` too: until this screen has attached its own simulator, a
    // COMPLETE in the store is the previous match's.
    if (!ready || playback !== 'COMPLETE' || !result || celebrating) return;
    let cancelled = false;
    // A short beat on the final whistle: cutting instantly reads as a page load.
    // A retry the player asked for does not wait.
    const timer = setTimeout(() => {
      setSaveStatus('SAVING');
      useGameStore.getState().recordMatch(result)
        .catch((error: unknown) => {
          console.error('[match] the full-time result could not be saved', error);
          return false;
        })
        .then((saved) => {
          if (cancelled) return;
          if (saved) navigate(`/matchday/result/${result.matchId}`);
          else setSaveStatus('FAILED');
        });
    }, saveAttempt === 0 ? 600 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, playback, result, navigate, celebrating, saveAttempt]);

  const retrySave = useCallback(() => setSaveAttempt((n) => n + 1), []);

  /** The player's informed choice: the report still commits the result to the world in memory. */
  const continueUnsaved = useCallback(() => {
    if (result) navigate(`/matchday/result/${result.matchId}`);
  }, [navigate, result]);

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

  const { numbers, keepers, roles, surnames } = useMemo(() => {
    const n: Record<string, number> = {};
    const k: Record<string, boolean> = {};
    const r: Record<string, PitchRole> = {};
    const s: Record<string, string> = {};
    for (const p of [...(setup?.home.players ?? []), ...(setup?.away.players ?? [])]) {
      if (p.shirtNumber !== null) n[p.id] = p.shirtNumber;
      if (p.position === 'GK') k[p.id] = true;
      r[p.id] = roleOfPosition(p.position);
      // Surname only. A full name under a token the size of a fingertip stops
      // being a label and becomes clutter.
      s[p.id] = p.lastName;
    }
    return { numbers: n, keepers: k, roles: r, surnames: s };
  }, [setup]);

  /** Live ratings come from the engine, sampled once a match minute. */
  const liveRatings = useMatchStore((s) => s.ratings);

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

  /** The manager's own choice. The drama beat borrows the pace and returns it. */
  const chooseSpeed = useCallback((next: MatchSpeed) => {
    setSpeedState(next);
    useMatchStore.getState().setSpeed(next);
  }, []);

  /**
   * The header X and Android back. See `matchExitPlan` for the rule: before
   * kick-off it is a free exit; once the ball is rolling, leaving plays the
   * match out — the same `skipToEnd` as "Jump to the final whistle", so the
   * engine resolves every remaining minute and decision for the player's side
   * — and the full-time handoff above saves it and opens the report. Walking
   * out can therefore never leave a fixture replayable with a known seed.
   */
  const exit = useCallback(() => {
    void (async () => {
      // No simulator of this screen's own (the fixture failed to start): the
      // store's playback, if any, belongs to some earlier match.
      const plan = simRef.current ? matchExitPlan(useMatchStore.getState().playback) : 'LEAVE';
      // Full time: the save-then-report handoff is already running (or
      // showing its retry); leaving must not drop the result on the way out.
      if (plan === 'SAVE_RESULT') return;
      if (plan === 'LEAVE') {
        useMatchStore.getState().reset();
        navigate('/matchday');
        return;
      }
      const ok = await confirm({
        title: 'Leave the match?',
        description:
          'Leaving plays out the rest of the match at once — the bench makes every call from here — and the result counts. This fixture cannot be replayed.',
        confirmLabel: 'Leave and play it out',
        cancelLabel: 'Keep watching',
        destructive: true,
      });
      if (!ok) return;
      // The final whistle may have gone while the dialog was open.
      if (matchExitPlan(useMatchStore.getState().playback) !== 'PLAY_OUT') return;
      setSheet(null);
      useMatchStore.getState().skipToEnd();
    })();
  }, [navigate, confirm]);

  // Android's back button must take the same confirmed path as the X, not
  // navigate around it.
  useEffect(() => onNativeBack(exit), [exit]);

  /* --- announcements ---------------------------------------------------- */

  const { urgent, polite } = useAnnouncements(playerSide === 'home', celebrating, names);

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
        <Skeleton className="aspect-[3/2] w-full" />
        <Skeleton className="min-h-0 flex-1 w-full" />
      </div>
    );
  }

  return (
    <div className="cf-live-match relative flex h-full flex-col overflow-hidden bg-base">
      <ArtImage asset="ambience.night-clear" crop="hero" className="cf-live-backdrop" eager />
      <MatchHeader
        home={context.home}
        away={context.away}
        totalMinutes={setup?.config.minutes ?? 30}
        onExit={exit}
      />

      <main
        className={cn(
          'relative flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 pt-2 sm:px-5',
          wide && 'mx-auto w-full max-w-[1180px] grid grid-cols-[minmax(0,1fr)_360px] gap-4',
        )}
      >
        {presentation === 'PITCH' && <PitchStage
          names={surnames}
          ratings={liveRatings}
          homePalette={homePalette}
          awayPalette={awayPalette}
          playerSide={playerSide}
          numbers={numbers}
          keepers={keepers}
          roles={roles}
          camera={camera}
          onCamera={setCamera}
          drama={drama.label}
          ruleKey={openRuleKey}
          impactKey={celebrating?.id ?? null}
          impactStrength={celebrating && (celebrating.side ?? 'home') === playerSide ? 1 : 0.5}
          fill={wide}
          className={wide ? 'h-full min-h-0' : 'shrink-0'}
        />}

        <StoryPanel
          home={context.home}
          away={context.away}
          homePalette={homePalette}
          awayPalette={awayPalette}
          playerSide={playerSide}
          tactics={tactics}
          className="min-h-0 flex-1"
        />
      </main>

      <MatchControlRail
        speed={speed}
        subsRemaining={subsRemaining}
        ruleCardCount={cards.reduce((total, c) => total + c.quantity, 0)}
        onOpenSpeed={() => setSheet('SPEED')}
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

      <SpeedSheet
        open={sheet === 'SPEED'}
        onClose={() => setSheet(null)}
        speed={speed}
        onChange={chooseSpeed}
        onSkipToEnd={() => useMatchStore.getState().skipToEnd()}
        canSkip={playback !== 'COMPLETE'}
      />

      <GoalMoment
        goal={celebrating}
        names={names}
        homePalette={homePalette}
        awayPalette={awayPalette}
        homeName={context.home.shortName}
        awayName={context.away.shortName}
        playerSide={playerSide}
        attendance={setup?.attendance ?? 0}
        isDerby={context.fixture.isDerby}
        onComplete={resumeAfterGoal}
        onFinished={goalFinished}
      />

      {intro && (
        <MatchIntro
          context={context}
          homePalette={homePalette}
          awayPalette={awayPalette}
          onDone={startMatch}
        />
      )}

      {(saveStatus === 'FAILED' || (saveStatus === 'SAVING' && saveAttempt > 0)) && (
        // Above the match chrome and its X, below toasts: the only ways on
        // from here are the two buttons, and neither one drops the result.
        <div className="absolute inset-0 z-[57] flex items-center justify-center bg-base/95 px-6 pt-[var(--safe-top)]">
          <div className="w-full max-w-[440px]">
            <ErrorState
              title="This result is not saved yet"
              description="Full time stands and the score is safe while the game stays open, but this device refused to save it. If the app closes before it is saved, this match will not count."
              detail={saveError ?? undefined}
            />
            <div className="flex flex-col items-center gap-2">
              <GlassButton variant="primary" size="lg" loading={saveStatus === 'SAVING'} onClick={retrySave}>
                Retry save
              </GlassButton>
              <GlassButton variant="ghost" size="md" disabled={saveStatus === 'SAVING'} onClick={continueUnsaved}>
                Continue without saving
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      <Announcer urgent={urgent} polite={polite} />
    </div>
  );
}

/**
 * What a screen reader hears.
 *
 * Goals, cards, decisions and the final whistle interrupt; everything else
 * queues. Without this the most important thirty minutes in the product are
 * completely silent to a VoiceOver user. A goal is announced from its own
 * event, with scorer and new score, rather than being left to the generic
 * importance rule — it is the one line a listener must not miss.
 */
function useAnnouncements(
  playerIsHome: boolean,
  celebrating: MatchEvent | null,
  names: ReadonlyMap<string, string>,
): { urgent: string | null; polite: string | null } {
  const commentary = useGameStore((s) => s.state?.settings.commentary ?? true);
  const feed = useMatchStore((s) => s.feed);
  const decision = useMatchStore((s) => s.decision);
  const playback = useMatchStore((s) => s.playback);
  const homeScore = useMatchStore((s) => s.homeScore);
  const awayScore = useMatchStore((s) => s.awayScore);

  return useMemo(() => {
    if (celebrating) {
      const scorer = celebrating.playerId ? names.get(celebrating.playerId) ?? 'Unknown' : 'Unknown';
      const ours = (celebrating.side ?? 'home') === (playerIsHome ? 'home' : 'away');
      return {
        urgent:
          `${ours ? 'Goal for you' : 'Goal against you'}, ${minuteLabel(celebrating.minute)}. ` +
          `${scorer}. ${celebrating.homeScore}-${celebrating.awayScore}. ` +
          `${stateOfPlay(celebrating.homeScore, celebrating.awayScore, playerIsHome)}.`,
        polite: null,
      };
    }
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
    return { urgent: null, polite: commentary ? `${minuteLabel(latest.minute)} ${latest.text}` : null };
  }, [feed, decision, playback, homeScore, awayScore, playerIsHome, celebrating, names, commentary]);
}
