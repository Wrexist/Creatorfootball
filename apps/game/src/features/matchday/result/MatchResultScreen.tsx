import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  nextFixture, resultFor, standings, topConcern,
  type Club, type DecisionOutcome, type MatchEvent, type MatchResult, type Player,
} from '@cf/engine';
import {
  ClubBadge, EmptyState, ErrorState, FormGuide, GlassButton, GlassCard, GlassPanel, GlassPill,
  GlassTabs, HeroScene, IconChevronRight, IconFans, IconMoney, MoneyLabel, NewsCard, PlayerPortrait,
  RatingBadge, ScoreDisplay, SectionHeader, Skeleton, SocialPost, StatCard, StatGrid,
  TrendIndicator, cn, sfx, useDesignMotion,
} from '@/design';
import { useGameStore } from '@/state/gameStore';
import { useMatchStore } from '@/state/matchStore';
import { Announcer } from '../shared/Announcer';
import { MomentumWave } from '../shared/MomentumWave';
import { kitColors, paletteFor } from '../shared/kit';
import { minuteLabel, one, stateOfPlay } from '../shared/format';
import { AnalyticsTab } from './AnalyticsTab';
import { concernRoute } from './concernRoute';
import { masteryLines } from './mastery';
import { humanise } from '@/design/text';

/**
 * The post-match sequence.
 *
 * The player is never dumped back to a dashboard. The consequences arrive in a
 * fixed order — result, the moment that decided it, how the players did, what
 * the fans think, what the internet thinks, what it earned, where it leaves you
 * in the table, and what you have to decide next — each revealed as its own
 * beat rather than dropped on screen as one long page. That ordering is the
 * whole design: it tells the story outward from the pitch to the club.
 *
 * The result is committed to the world exactly once, on mount, before any of it
 * is shown, so the standings and the money the player reads are the real ones.
 */

const STAGES = [
  'RESULT', 'KEY_MOMENT', 'PERFORMANCE', 'FANS', 'SOCIAL', 'MONEY', 'STANDINGS', 'NEXT',
] as const;
type Stage = (typeof STAGES)[number];

interface Snapshot {
  readonly sentiment: number;
  readonly followers: number;
  readonly position: number | null;
}

export function MatchResultScreen(): ReactNode {
  const params = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const m = useDesignMotion();

  const result = useMatchStore((s) => s.result);
  const state = useGameStore((s) => s.state);
  const lastCycle = useGameStore((s) => s.lastCycle);
  const busy = useGameStore((s) => s.busy);
  const storeError = useGameStore((s) => s.error);

  const before = useRef<Snapshot | null>(null);
  const [tab, setTab] = useState<'STORY' | 'ANALYTICS'>('STORY');
  const [revealed, setRevealed] = useState(1);

  /* --- commit the result to the world, once ---------------------------- */

  useEffect(() => {
    if (!result) return;
    const current = useGameStore.getState().state;
    if (current) {
      const club = current.clubs[current.playerClubId];
      before.current = {
        sentiment: club?.fans.sentiment ?? 0,
        followers: club?.fans.onlineFollowers ?? 0,
        position: standings(current).find((row) => row.clubId === current.playerClubId)?.position ?? null,
      };
    }
    // The store owns double-commit protection, because it is the only place
    // that can tell a remount from a genuinely new result: it checks the
    // world's own fixture status, which a reload cannot forget and a previous
    // career cannot poison.
    void useGameStore.getState().advance(result);
  }, [result]);

  /**
   * A win is the only result that gets a sound. A draw or a defeat arrives in
   * silence on purpose: a chime over a 0-3 reads as the product not having
   * noticed, and the full-time whistle has already been heard.
   */
  useEffect(() => {
    if (!result) return;
    const clubId = useGameStore.getState().state?.playerClubId;
    if (clubId && resultFor(result, clubId) === 'W') sfx.reward();
  }, [result]);

  const advanceStage = useCallback(() => {
    setRevealed((n) => Math.min(STAGES.length, n + 1));
  }, []);

  // Bring the newly revealed beat into view. Done by id rather than a callback
  // ref so the scroll fires once per reveal instead of on every render.
  useEffect(() => {
    if (revealed <= 1) return;
    const stage = STAGES[revealed - 1];
    if (!stage) return;
    document
      .getElementById(`stage-${stage}`)
      ?.scrollIntoView({ behavior: m.reduced ? 'auto' : 'smooth', block: 'start' });
  }, [revealed, m.reduced]);

  const finish = useCallback(() => {
    const current = useGameStore.getState().state;
    const next = current ? nextFixture(current) : null;
    useMatchStore.getState().reset();
    navigate(next ? `/matchday/preview/${next.id}` : '/home');
  }, [navigate]);

  /**
   * The result was committed to memory but the world refused to move. Every
   * stage below reads pre-match state in that case, so the failure is shown
   * where it happens — with a retry that re-offers the same result — instead
   * of a "quiet week" fiction rendered on top of a broken save.
   */
  const retryAdvance = useCallback(() => {
    void useGameStore.getState().advance(useMatchStore.getState().result);
  }, []);

  /* --- guards ---------------------------------------------------------- */

  if (!result || !state) {
    return (
      <div className="flex h-full items-center justify-center bg-base p-6">
        {busy ? (
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <ErrorState
            title="This match report has expired"
            description={`Result ${params.matchId ?? ''} is no longer in memory. Its consequences have already been applied to your world.`}
            onRetry={() => navigate('/home')}
            retryLabel="Back to the club"
          />
        )}
      </div>
    );
  }

  const home = state.clubs[result.homeClubId];
  const away = state.clubs[result.awayClubId];
  const us = state.clubs[state.playerClubId];
  if (!home || !away || !us) {
    return (
      <div className="flex h-full items-center justify-center bg-base p-6">
        <ErrorState title="Clubs missing" onRetry={() => navigate('/home')} retryLabel="Back to the club" />
      </div>
    );
  }

  const playerIsHome = result.homeClubId === state.playerClubId;
  const outcome = resultFor(result, state.playerClubId);
  const lastStage = revealed >= STAGES.length;

  const stageProps: StageProps = {
    result, home, away, us, playerIsHome, state, lastCycle, before: before.current,
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-base">
      {/*
        The room the result was got in. A win warms the ground and lifts light
        off it; a defeat cools it and puts rain through it; a draw gets the
        neutral dusk, because a shared point is neither a celebration nor a
        wake and inventing a mood for it would be the product telling the
        player how to feel about something it does not know.

        It sits behind everything and carries no information: every panel below
        is glass, and the scene's own scrim is what keeps the type on them
        clear of the brightest part of the drawing.
      */}
      <HeroScene
        variant={outcome === 'W' ? 'triumph' : outcome === 'L' ? 'consolation' : 'title'}
        seed={result.matchId}
      />

      <header className="glass-3 relative z-20 shrink-0 pt-[var(--safe-top)]">
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-2.5 pt-2 sm:px-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-dim">
            Full time
          </p>
          <div className="mt-1">
            <GlassTabs
              items={TABS}
              value={tab}
              onChange={setTab}
              appearance="underline"
            />
          </div>
        </div>
      </header>

      <div className="scroll-y relative z-10 min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6">
          {tab === 'STORY' && storeError !== null && !busy && (
            <GlassPanel padding="md" accent="danger" className="border border-danger/40">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-danger">
                The week did not advance
              </p>
              <p className="mt-1 text-[14px] leading-snug text-ink text-pretty">
                Your result was recorded, but the world could not move on from it. The numbers
                below are not final.
              </p>
              <p className="mt-1 text-[12px] text-ink-dim">{storeError}</p>
              <div className="mt-3">
                <GlassButton variant="secondary" size="sm" onClick={retryAdvance}>
                  Try again
                </GlassButton>
              </div>
            </GlassPanel>
          )}
          {tab === 'ANALYTICS' ? (
            <AnalyticsTab
              result={result}
              home={home}
              away={away}
              playerIsHome={playerIsHome}
              players={state.players}
            />
          ) : (
            STAGES.slice(0, revealed).map((stage) => (
              <motion.section
                key={stage}
                initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={m.spring.gentle}
                id={`stage-${stage}`}
              >
                <StageBody stage={stage} {...stageProps} />
              </motion.section>
            ))
          )}
        </div>
      </div>

      {tab === 'STORY' && (
        <div
          className="relative z-20 shrink-0 border-t border-white/[0.07] bg-surface-2/95"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          <div className="mx-auto w-full max-w-[1180px] px-4 py-3 sm:px-6">
            {lastStage ? (
              <GlassButton variant="primary" size="lg" block iconRight={<IconChevronRight />} onClick={finish}>
                {nextFixture(state) ? 'On to the next one' : 'Back to the club'}
              </GlassButton>
            ) : (
              <div className="flex items-center gap-2">
                <GlassButton variant="primary" size="lg" block onClick={advanceStage} className="flex-[3]">
                  Continue
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="lg"
                  className="flex-1"
                  onClick={() => setRevealed(STAGES.length)}
                >
                  Skip
                </GlassButton>
              </div>
            )}
          </div>
        </div>
      )}

      <Announcer
        urgent={`Full time. ${home.shortName} ${result.homeScore}, ${away.shortName} ${result.awayScore}. ${stateOfPlay(result.homeScore, result.awayScore, playerIsHome)}. ${outcome === 'W' ? 'A win.' : outcome === 'D' ? 'A draw.' : 'A defeat.'}`}
      />
    </div>
  );
}

const TABS = [
  { id: 'STORY' as const, label: 'Report' },
  { id: 'ANALYTICS' as const, label: 'Analytics' },
];

/* --- stages ------------------------------------------------------------ */

interface StageProps {
  result: MatchResult;
  home: Club;
  away: Club;
  us: Club;
  playerIsHome: boolean;
  state: NonNullable<ReturnType<typeof useGameStore.getState>['state']>;
  lastCycle: ReturnType<typeof useGameStore.getState>['lastCycle'];
  before: Snapshot | null;
}

function StageBody({ stage, ...props }: StageProps & { stage: Stage }): ReactNode {
  switch (stage) {
    case 'RESULT': return <ResultStage {...props} />;
    case 'KEY_MOMENT': return <KeyMomentStage {...props} />;
    case 'PERFORMANCE': return <PerformanceStage {...props} />;
    case 'FANS': return <FansStage {...props} />;
    case 'SOCIAL': return <SocialStage {...props} />;
    case 'MONEY': return <MoneyStage {...props} />;
    case 'STANDINGS': return <StandingsStage {...props} />;
    case 'NEXT': return <NextStage {...props} />;
    default: return null;
  }
}

function ResultStage({ result, home, away, playerIsHome, state }: StageProps): ReactNode {
  const outcome = resultFor(result, state.playerClubId);
  const tone = outcome === 'W' ? 'positive' : outcome === 'D' ? 'neutral' : 'danger';
  const headline = outcome === 'W' ? 'Won it' : outcome === 'D' ? 'Shared it' : 'Lost it';
  // What they came in knowing, captured before kick-off — and what they worked
  // out during the match, read off the result's own events. Rendered only when
  // there is something to say: an empty line here would be noise on every
  // other match.
  const preMatch = useMatchStore((s) => s.opponentRecap);
  const inMatch = useMemo(
    () => result.events
      .filter((e) => e.type === 'TACTICAL_CHANGE' && e.detail?.['trigger'] === 'AI_ADAPTATION')
      .map((e) => String(e.detail?.['recap'] ?? ''))
      .filter((line) => line.length > 0),
    [result.events],
  );
  const recap = useMemo(() => [...preMatch, ...inMatch], [preMatch, inMatch]);

  return (
    <GlassPanel nested level={2} padding="lg" accent={tone === 'positive' ? 'positive' : tone === 'danger' ? 'danger' : 'none'}>
      <div className="flex items-center justify-center gap-5">
        <ClubBadge visual={home.visual} size={52} flat label={home.name} />
        <ScoreDisplay
          home={result.homeScore}
          away={result.awayScore}
          size="hero"
          homeLabel={home.shortName}
          awayLabel={away.shortName}
        />
        <ClubBadge visual={away.visual} size={52} flat label={away.name} />
      </div>
      <p className="mt-4 text-center font-display text-[26px] font-bold tracking-[-0.03em] text-ink">
        {headline}
      </p>
      <p className="mt-1 text-center text-[14px] text-ink-muted">
        {home.shortName} v {away.shortName} · {result.attendance.toLocaleString()} in
        {playerIsHome ? ' behind you' : ' against you'}
      </p>
      {recap.length > 0 && (
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <p className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-dim">
            {inMatch.length > 0 ? 'How they solved you' : 'What they came in knowing'}
          </p>
          {recap.map((line) => (
            <p key={line} className="mt-1.5 text-[14px] leading-snug text-ink-muted text-pretty">
              {line}
            </p>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}

function KeyMomentStage({ result, home, away, playerIsHome, state }: StageProps): ReactNode {
  const event: MatchEvent | undefined = useMemo(
    () => result.events.find((e) => e.id === result.keyMomentEventId),
    [result],
  );
  const homePalette = paletteFor(home);
  const awayPalette = paletteFor(away);

  if (!event) {
    return (
      <EmptyState size="sm" title="No single turning point" description="This one was decided by degrees." />
    );
  }

  const player: Player | undefined = event.playerId ? state.players[event.playerId] : undefined;
  const club = event.side === 'home' ? home : away;
  const kit = kitColors(club.id, club.visual);
  const oursDidIt = (event.side === 'home') === playerIsHome;

  return (
    <>
      <SectionHeader title="The moment" subtitle={`${minuteLabel(event.minute)} · ${humanise(event.type)}`} />
      <GlassPanel nested level={2} padding="lg" accent={oursDidIt ? 'volt' : 'danger'} className="mt-3">
        <div className="flex items-start gap-3">
          {player && <PlayerPortrait seed={player.portraitSeed} size={56} colors={kit} shape="squircle" />}
          <div className="min-w-0 flex-1">
            <p className="text-balance text-[20px] font-bold leading-[1.22] tracking-[-0.02em] text-ink">
              {event.text}
            </p>
            {player && (
              <p className="mt-1.5 text-[13px] text-ink-muted">
                {player.displayName}
                {typeof event.xg === 'number' ? ` · ${one(event.xg)} xG chance` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <MomentumWave
            values={result.momentumTimeline}
            homeColor={homePalette.primary}
            awayColor={awayPalette.primary}
            homeLabel={home.abbreviation}
            awayLabel={away.abbreviation}
            height={64}
            markers={[{
              at: Math.min(1, event.minute / Math.max(1, result.durationMinutes)),
              side: (event.side ?? 'home') as 'home' | 'away',
              label: 'key moment',
            }]}
          />
        </div>
      </GlassPanel>
    </>
  );
}

function PerformanceStage({ result, state, playerIsHome, home, away }: StageProps): ReactNode {
  const club = playerIsHome ? home : away;
  const kit = kitColors(club.id, club.visual);
  const ourClubId = playerIsHome ? result.homeClubId : result.awayClubId;

  const ratings = useMemo(
    () =>
      Object.values(result.playerStats)
        .filter((stat) => state.players[stat.playerId]?.clubId === ourClubId)
        .sort((a, b) => b.rating - a.rating),
    [result, state.players, ourClubId],
  );

  const motm = result.motmPlayerId ? state.players[result.motmPlayerId] : undefined;
  const decisions = useDecisionReview(result);
  // Career aggregates live in the save (folded in as results are applied), so
  // the panel can say how these kinds of calls have gone over time — not just
  // tonight. One line per family, only where history exists.
  const mastery = useMemo(() => masteryLines(state.decisionRecord), [state.decisionRecord]);

  return (
    <>
      <SectionHeader title="How they played" />
      {motm && (
        <GlassPanel nested level={2} padding="md" accent="volt" className="mt-3">
          <div className="flex items-center gap-3">
            <PlayerPortrait seed={motm.portraitSeed} size={52} colors={kit} shape="squircle" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt">Man of the match</p>
              <p className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink text-pretty">
                {motm.displayName}
              </p>
            </div>
            <RatingBadge value={result.playerStats[motm.id]?.rating ?? 0} scale="match" size="lg" />
          </div>
        </GlassPanel>
      )}

      <ul className="mt-3 flex flex-col gap-1.5">
        {ratings.slice(0, 9).map((stat) => {
          const player = state.players[stat.playerId];
          return (
            <li
              key={stat.playerId}
              className="flex items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2"
            >
              {player && <PlayerPortrait seed={player.portraitSeed} size={30} colors={kit} shape="circle" />}
              <span className="min-w-0 flex-1 text-[14px] leading-snug text-ink text-pretty">
                {player?.displayName ?? stat.playerId}
              </span>
              <span className="tnum shrink-0 text-[12px] text-ink-dim">
                {stat.goals > 0 ? `${stat.goals}G ` : ''}{stat.assists > 0 ? `${stat.assists}A` : ''}
              </span>
              <RatingBadge value={stat.rating} scale="match" size="sm" />
            </li>
          );
        })}
      </ul>

      {decisions.length > 0 && (
        <GlassPanel nested level={2} padding="md" title="Your calls" className="mt-4">
          <ul className="flex flex-col gap-2.5">
            {decisions.map((review) => (
              <li key={review.promptId} className="flex items-start gap-2.5">
                <GlassPill tone={VERDICT_TONE[review.verdict]} size="sm" filled={review.verdict !== 'NEUTRAL'}>
                  {VERDICT_LABEL[review.verdict]}
                </GlassPill>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">
                    {minuteLabel(review.minute)} · {review.label}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-muted text-pretty">{review.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          {mastery.length > 0 && (
            <div className="mt-3 border-t border-white/[0.07] pt-2.5">
              {mastery.map((line) => (
                <p key={line} className="text-[13px] leading-snug text-ink-muted text-pretty">
                  {line}
                </p>
              ))}
            </div>
          )}

          <p className="mt-3 text-[12px] text-ink-dim">
            Graded on the expected goals created and conceded in the minutes after each call.
          </p>
        </GlassPanel>
      )}
    </>
  );
}

const VERDICT_LABEL = { WORKED: 'Worked', NEUTRAL: 'Neutral', BACKFIRED: 'Backfired' } as const;
const VERDICT_TONE = { WORKED: 'positive', NEUTRAL: 'neutral', BACKFIRED: 'danger' } as const;

interface DecisionReview {
  readonly promptId: string;
  readonly minute: number;
  readonly label: string;
  readonly detail: string;
  readonly verdict: 'WORKED' | 'NEUTRAL' | 'BACKFIRED';
}

/**
 * Pairs each graded decision with the option the player actually pressed.
 *
 * The grade lives on `MatchResult.decisions`; the human-readable label of the
 * chosen option lives on the `DECISION_RESOLVED` event. Neither is invented
 * here — this only joins them.
 */
function useDecisionReview(result: MatchResult): DecisionReview[] {
  return useMemo(() => {
    const resolved = new Map<string, { label: string; effect: string }>();
    for (const event of result.events) {
      if (event.type !== 'DECISION_RESOLVED') continue;
      const promptId = event.detail?.promptId;
      if (typeof promptId !== 'string') continue;
      resolved.set(promptId, {
        label: typeof event.detail?.label === 'string' ? event.detail.label : 'Your call',
        effect: typeof event.detail?.effect === 'string' ? event.detail.effect : event.text,
      });
    }

    return result.decisions.map((outcome: DecisionOutcome) => {
      const meta = resolved.get(outcome.promptId);
      const evaluation = outcome.evaluation;
      const detail = evaluation
        ? `${signed(evaluation.xgDelta)} xG created, ${signed(evaluation.xgAgainstDelta)} xG conceded after it.`
        : meta?.effect ?? 'No measurable swing either way.';
      return {
        promptId: outcome.promptId,
        minute: outcome.minute,
        label: meta?.label ?? outcome.optionId,
        detail,
        verdict: evaluation?.verdict ?? 'NEUTRAL',
      };
    });
  }, [result]);
}

const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;

function FansStage({ state, before }: StageProps): ReactNode {
  const club = state.clubs[state.playerClubId];
  if (!club) return null;
  const sentimentDelta = before ? club.fans.sentiment - before.sentiment : 0;
  const followerDelta = before ? club.fans.onlineFollowers - before.followers : 0;

  return (
    <>
      <SectionHeader title="The stands" />
      <GlassPanel nested level={2} padding="md" className="mt-3">
        <div className="flex items-center gap-3">
          <span className="text-volt [&_svg]:size-6"><IconFans /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">
              {sentimentDelta > 2
                ? 'They loved that.'
                : sentimentDelta < -2
                  ? 'That did not go down well.'
                  : 'The mood is much as it was.'}
            </p>
            <p className="text-[13px] text-ink-muted">{humanise(club.fanCulture)} support</p>
          </div>
          <TrendIndicator delta={sentimentDelta} size="md" />
        </div>

        <StatGrid columns={3} gap="sm" className="mt-3">
          <StatCard nested level={1} size="sm" label="Sentiment" value={Math.round(club.fans.sentiment)} delta={sentimentDelta} />
          <StatCard nested level={1} size="sm" label="Excitement" value={Math.round(club.fans.excitement)} />
          <StatCard nested level={1} size="sm" label="Followers" value={club.fans.onlineFollowers} delta={followerDelta} />
        </StatGrid>
      </GlassPanel>
    </>
  );
}

function SocialStage({ lastCycle }: StageProps): ReactNode {
  const posts = lastCycle?.posts.slice(0, 4) ?? [];
  const stories = lastCycle?.stories.slice(0, 2) ?? [];

  return (
    <>
      <SectionHeader title="The reaction" subtitle="Straight from the timeline" />
      {posts.length === 0 && stories.length === 0 ? (
        <div className="mt-3">
          <EmptyState size="sm" title="Quiet out there" description="Nobody has posted about it yet." />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {posts.map((post) => (
            <SocialPost key={post.id} post={post} />
          ))}
          {stories.map((story) => (
            <NewsCard key={story.id} story={story} variant="compact" />
          ))}
        </div>
      )}
    </>
  );
}

function MoneyStage({ lastCycle, state }: StageProps): ReactNode {
  const club = state.clubs[state.playerClubId];
  const income = lastCycle?.summary.income ?? 0;
  const expenditure = lastCycle?.summary.expenditure ?? 0;
  const net = income - expenditure;

  return (
    <>
      <SectionHeader title="The books" />
      <GlassPanel nested level={2} padding="md" className="mt-3">
        <div className="flex items-center gap-3">
          <span className="text-volt [&_svg]:size-6"><IconMoney /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">
              {net >= 0 ? 'A profitable week.' : 'The week cost you.'}
            </p>
            <p className="text-[13px] text-ink-muted">Matchday, sponsors, wages and upkeep</p>
          </div>
          <MoneyLabel amount={net} signed size="lg" />
        </div>

        <StatGrid columns={3} gap="sm" className="mt-3">
          <StatCard nested level={1} size="sm" label="In" value={<MoneyLabel amount={income} size="md" />} />
          <StatCard nested level={1} size="sm" label="Out" value={<MoneyLabel amount={-expenditure} size="md" />} />
          <StatCard
            nested
            level={1}
            size="sm"
            label="Transfer budget"
            value={<MoneyLabel amount={club?.finance.transferBudget ?? 0} size="md" />}
          />
        </StatGrid>
      </GlassPanel>
    </>
  );
}

function StandingsStage({ state, before }: StageProps): ReactNode {
  const table = useMemo(() => standings(state), [state]);
  const index = table.findIndex((row) => row.clubId === state.playerClubId);
  const window = index < 0 ? table.slice(0, 6) : table.slice(Math.max(0, index - 2), Math.max(0, index - 2) + 6);
  const position = index >= 0 ? (table[index]?.position ?? null) : null;
  const moved = before?.position != null && position != null ? before.position - position : 0;

  return (
    <>
      <SectionHeader
        title="The table"
        subtitle={
          moved > 0 ? `Up ${moved} place${moved === 1 ? '' : 's'}`
            : moved < 0 ? `Down ${-moved} place${moved === -1 ? '' : 's'}`
              : 'No change'
        }
      />
      <GlassPanel nested level={2} padding="sm" className="mt-3">
        <ol>
          {window.map((row) => {
            const club = state.clubs[row.clubId];
            const ours = row.clubId === state.playerClubId;
            return (
              <li
                key={row.clubId}
                className={cn(
                  'flex items-center gap-2 border-b border-white/[0.05] px-1 py-2 last:border-0',
                  ours ? 'text-ink' : 'text-ink-muted',
                )}
              >
                <span className="tnum w-6 shrink-0 text-[13px] font-semibold text-ink-dim">{row.position}</span>
                {club && <ClubBadge visual={club.visual} size={22} flat label={club.name} />}
                <span className={cn('min-w-0 flex-1 text-[14px] leading-snug text-pretty', ours && 'font-bold')}>
                  {club?.shortName ?? row.clubId}
                </span>
                <FormGuide results={row.form} size="sm" slots={5} className="hidden sm:flex" />
                <span className="tnum w-8 shrink-0 text-right text-[14px] font-bold">{row.points}</span>
              </li>
            );
          })}
        </ol>
      </GlassPanel>
    </>
  );
}

function NextStage({ state }: StageProps): ReactNode {
  const navigate = useNavigate();
  const concern = useMemo(() => topConcern(state), [state]);
  const route = useMemo(() => concernRoute(concern), [concern]);
  const next = useMemo(() => nextFixture(state), [state]);
  const opponent = next
    ? state.clubs[next.homeClubId === state.playerClubId ? next.awayClubId : next.homeClubId]
    : undefined;

  return (
    <>
      <SectionHeader title="What now" />
      <GlassCard
        padding="md"
        className="mt-3 border border-volt/25"
        {...(route ? { onPress: () => navigate(route) } : {})}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt">Needs a decision</p>
            <p className="mt-1 text-[19px] font-bold leading-tight tracking-[-0.02em] text-ink text-balance">
              {concern.headline}
            </p>
            <p className="mt-1 text-[14px] leading-snug text-ink-muted text-pretty">{concern.detail}</p>
          </div>
          {route && (
            <span aria-hidden="true" className="mt-1 shrink-0 text-volt [&_svg]:size-5">
              <IconChevronRight />
            </span>
          )}
        </div>
        {route && (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt">
            Handle it now
          </p>
        )}
      </GlassCard>

      {next && opponent && (
        <GlassPanel nested level={2} padding="md" className="mt-3">
          <div className="flex items-center gap-3">
            <ClubBadge visual={opponent.visual} size={40} flat label={opponent.name} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
                Next · week {next.week}
              </p>
              <p className="text-[16px] font-bold leading-tight tracking-[-0.01em] text-ink text-pretty">
                {opponent.name}
              </p>
            </div>
            {next.isDerby && <GlassPill tone="danger" size="sm" filled>Derby</GlassPill>}
          </div>
        </GlassPanel>
      )}
    </>
  );
}
