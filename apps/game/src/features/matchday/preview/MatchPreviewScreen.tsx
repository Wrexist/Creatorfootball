import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Club, FixtureId, Player } from '@cf/engine';
import { scoutingReportAgainst } from '@cf/engine';
import {
  ClubBadge, Divider, EmptyState, ErrorState, FormGuide, GlassButton, GlassPanel, GlassPill,
  IconFans, IconFastForward, IconFlame, IconInjury, IconPlay, KeyValueRow, PlayerPortrait,
  PositionChip, ProgressBar, RatingBadge, Screen, SectionHeader, Skeleton, StatCard, StatGrid,
  cn, haptics, sidesWord, useToast,
} from '@/design';
import { useGame, useGameStore } from '@/state/gameStore';
import { useMatchStore } from '@/state/matchStore';
import {
  BENCH_REASON_LABEL, useMatchdayContext, arenaShareLine,
  type KeyBattle, type MatchdayContext,
} from '../shared/context';
import { kitColors, type KitColors } from '../shared/kit';
import { SPECIAL_RULE_TONE } from '../shared/format';
import { LineupBoard } from './LineupBoard';

/**
 * The hour before kick-off.
 *
 * Everything on this screen exists to make the player *want* to press one
 * button. It answers, in order: who are they, what is at stake, what is going
 * to decide it, who is missing, and what strange thing might happen this week.
 * Then it gets out of the way — a single volt PLAY in the footer, with
 * "simulate" placed as a quiet secondary for the player who is on a bus.
 */

export function MatchPreviewScreen(): ReactNode {
  const params = useParams<{ fixtureId: string }>();
  const fixtureId = params.fixtureId as FixtureId | undefined;
  const navigate = useNavigate();
  const context = useMatchdayContext(fixtureId);
  const [simulating, setSimulating] = useState(false);
  const toast = useToast();

  const ourKit = useMemo(
    () => (context ? kitColors(context.us.id, context.us.visual) : null),
    [context],
  );

  const play = useCallback(() => {
    if (!fixtureId) return;
    haptics.impact();
    navigate(`/matchday/live/${fixtureId}`);
  }, [fixtureId, navigate]);

  /**
   * "Simulate" is the same simulation, run to the end with no prompts. It goes
   * through the identical result screen, so skipping the match never skips the
   * consequences.
   */
  const simulate = useCallback(() => {
    if (!fixtureId || simulating) return;
    setSimulating(true);
    // Yielding one frame lets the button paint its spinner before the whole
    // match runs synchronously on the main thread.
    requestAnimationFrame(() => {
      const SIM_FAIL = {
        title: 'That match cannot be simulated',
        description: 'Kick it off live instead.',
      } as const;
      const sim = useGameStore.getState().createSimulator(fixtureId);
      if (!sim) {
        setSimulating(false);
        // Silence here reads as a broken button: the tap must answer.
        toast.error(SIM_FAIL.title, SIM_FAIL.description);
        return;
      }
      const store = useMatchStore.getState();
      store.attach(sim);
      store.skipToEnd();
      const result = useMatchStore.getState().result;
      if (result) navigate(`/matchday/result/${result.matchId}`);
      else {
        setSimulating(false);
        toast.error(SIM_FAIL.title, SIM_FAIL.description);
      }
    });
  }, [fixtureId, simulating, navigate, toast]);

  if (!context || !ourKit) {
    return (
      <Screen title="Matchday" onBack={() => navigate('/matchday')}>
        {fixtureId === undefined ? (
          <ErrorState title="No fixture" description="This match could not be found." />
        ) : (
          <>
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </>
        )}
      </Screen>
    );
  }

  const { home, away, us, them, fixture } = context;

  return (
    <Screen
      title={`${home.abbreviation} v ${away.abbreviation}`}
      subtitle={`${context.competitionName} · week ${fixture.week}`}
      onBack={() => navigate('/matchday')}
      aside={<PreviewAside context={context} />}
      footer={
        <div className="flex items-center gap-2">
          <GlassButton
            variant="primary"
            size="lg"
            block
            icon={<IconPlay />}
            onClick={play}
            className="flex-[2]"
          >
            Play
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="lg"
            icon={<IconFastForward />}
            onClick={simulate}
            loading={simulating}
            className="flex-1"
          >
            Simulate
          </GlassButton>
        </div>
      }
    >
      <FixtureBand
        home={home}
        away={away}
        homeForm={context.playerIsHome ? context.ourForm : context.theirForm}
        awayForm={context.playerIsHome ? context.theirForm : context.ourForm}
        competition={context.competitionName}
        week={fixture.week}
        status={fixture.stageLabel ?? 'Kick-off soon'}
        isDerby={fixture.isDerby}
      />

      <ArenaLine share={context.arenaShare} />

      {fixture.isDerby && <RivalryPanel context={context} />}

      <StakesPanel context={context} />

      <OpponentPanel context={context} />
      <ScoutingReportPanel them={context.them} />

      <section>
        <SectionHeader title={`Your predicted ${sidesWord(context.lineup.length)}`} subtitle={context.formation.name} />
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <LineupBoard slots={context.lineup} kit={ourKit} />
          <GlassPanel nested level={2} padding="md" title="Bench">
            <ul className="flex flex-col gap-1.5">
              {context.bench.map((player) => (
                <BenchRow
                  key={player.id}
                  player={player}
                  kit={ourKit}
                  reason={BENCH_REASON_LABEL[context.benchReasons[player.id] ?? 'BEST_AVAILABLE']}
                />
              ))}
              {context.bench.length === 0 && (
                <li className="py-2 text-[13px] text-ink-dim">No fit players left on the bench.</li>
              )}
            </ul>
          </GlassPanel>
        </div>
      </section>

      <KeyBattlesPanel battles={context.keyBattles} ourKit={ourKit} them={them} />

      <RuleWindowsPanel context={context} />

      <AvailabilityPanel context={context} us={us} them={them} />
    </Screen>
  );
}

/* --- pieces ------------------------------------------------------------ */

/**
 * The fixture, stacked rather than side by side.
 *
 * A two-column fixture card on a 393pt phone gives each club about 120 points,
 * and `MatchCard`'s answer to a name that does not fit is an ellipsis —
 * "Marr…" against "Isac …". Clubs get named in full here or not at all, so the
 * two sides are stacked: each one gets the entire width of the screen, the name
 * wraps if it has to, and no club in any content pack can ever be cut short.
 * The cost is one extra row of height on the least dense screen in the product.
 */
function FixtureBand({
  home, away, homeForm, awayForm, competition, week, status, isDerby,
}: {
  home: Club;
  away: Club;
  homeForm: readonly ('W' | 'D' | 'L')[];
  awayForm: readonly ('W' | 'D' | 'L')[];
  competition: string;
  week: number;
  status: string;
  isDerby: boolean;
}): ReactNode {
  return (
    <GlassPanel nested level={2} padding="md" radius="lg">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim text-pretty">
          {competition} · week {week}
        </p>
        {isDerby && <GlassPill tone="danger" size="xs" filled>Derby</GlassPill>}
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        <FixtureSide club={home} form={homeForm} />
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-faint">v</span>
          <span aria-hidden="true" className="h-px flex-1 bg-white/[0.08]" />
        </div>
        <FixtureSide club={away} form={awayForm} />
      </div>

      <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-volt">
        {status}
      </p>
    </GlassPanel>
  );
}

function FixtureSide({
  club, form,
}: { club: Club; form: readonly ('W' | 'D' | 'L')[] }): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <ClubBadge visual={club.visual} size={38} flat label={club.name} />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink text-pretty">
          {club.name}
        </p>
        <p className="text-[12px] text-ink-dim">{club.abbreviation}</p>
      </div>
      <FormGuide results={form} size="sm" />
    </div>
  );
}

function ArenaLine({ share }: { share: number }): ReactNode {
  const line = arenaShareLine(share);
  if (!line) return null;
  // One row, no panel: flavour with stakes. The sentence carries the whole
  // meaning on its own — the icon is decoration, and reduced-transparency
  // themes lose nothing by dropping it.
  return (
    <p className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-volt">
      <span aria-hidden="true" className="shrink-0 text-volt [&_svg]:size-4"><IconFans /></span>
      {line}
    </p>
  );
}

/**
 * How rare a special rule is, written out.
 *
 * The engine calls these `COMMON`/`RARE`/`EPIC` and they were reaching the pill
 * in that form — the one piece of shouting on a screen where every other label
 * is set in sentence case.
 */
const RULE_RARITY: Readonly<Record<'COMMON' | 'RARE' | 'EPIC', string>> = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
};

/** The three results a stake can turn on, written out. */
const STAKE_OUTCOME: Readonly<Record<'WIN' | 'DRAW' | 'LOSS', string>> = {
  WIN: 'Win',
  DRAW: 'Draw',
  LOSS: 'Defeat',
};

function StakesPanel({ context }: { context: MatchdayContext }): ReactNode {
  const position = context.ourPosition;
  return (
    <GlassPanel nested level={2} padding="md" accent="volt" title="What is at stake">
      <ul className="flex flex-col gap-2">
        {context.stakes.map((line) => (
          <li key={line.kind} className="flex items-start gap-2.5">
            <GlassPill
              tone={line.kind === 'WIN' ? 'positive' : line.kind === 'DRAW' ? 'neutral' : 'danger'}
              size="sm"
            >
              {/* The constant is `WIN`/`DRAW`/`LOSS`; the player is told what
                  happens, in the words a person would use for it. */}
              {STAKE_OUTCOME[line.kind]}
            </GlassPill>
            <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink text-pretty">{line.text}</span>
          </li>
        ))}
      </ul>

      {position && (
        <div className="mt-3 border-t border-white/[0.07] pt-3">
          <StatGrid columns={3} gap="sm">
            <StatCard nested level={1} size="sm" label="Position" value={position.position} />
            <StatCard
              nested
              level={1}
              size="sm"
              label="Gap above"
              value={position.pointsToAbove ?? 0}
              suffix=" pts"
            />
            <StatCard
              nested
              level={1}
              size="sm"
              label="Gap below"
              value={position.pointsFromBelow ?? 0}
              suffix=" pts"
            />
          </StatGrid>
        </div>
      )}
    </GlassPanel>
  );
}

function RivalryPanel({ context }: { context: MatchdayContext }): ReactNode {
  const { rivalry, derbyHeat, them } = context;
  return (
    <GlassPanel nested level={2} padding="md" accent="danger">
      <div className="flex items-center gap-2">
        <span className="text-danger [&_svg]:size-5"><IconFlame /></span>
        <h3 className="text-[17px] font-bold tracking-[-0.01em] text-ink">Derby day</h3>
        <GlassPill tone="danger" size="sm" filled className="ml-auto">
          Heat {Math.round(derbyHeat)}
        </GlassPill>
      </div>
      <p className="mt-2 text-[14px] leading-snug text-ink-muted text-pretty">
        {rivalry?.origin ?? `Nobody in this city wants to lose to ${them.shortName}.`}
      </p>
      <ProgressBar value={derbyHeat} max={100} tone="danger" size="sm" className="mt-3" label="Rivalry intensity" />
      {rivalry && (
        <p className="mt-2 tnum text-[13px] text-ink-dim">
          {rivalry.meetings} meetings · {rivalry.aWins}W {rivalry.draws}D {rivalry.bWins}L
        </p>
      )}
      {rivalry && rivalry.incidents.length > 0 && (
        <p className="mt-2 text-[13px] italic text-ink-muted text-pretty">
          “{rivalry.incidents[rivalry.incidents.length - 1]?.text}”
        </p>
      )}
    </GlassPanel>
  );
}

function OpponentPanel({ context }: { context: MatchdayContext }): ReactNode {
  const { them, theirForm, theirRow, theirStar, theirTopScorer } = context;
  return (
    <GlassPanel nested level={2} padding="md" title="The opposition">
      <div className="flex items-center gap-3">
        <ClubBadge visual={them.visual} size={48} flat label={them.name} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink text-pretty">
            {them.name}
          </h3>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-muted text-pretty">
            {them.city} · {them.motto}
          </p>
        </div>
        {theirRow && (
          <div className="shrink-0 rounded-md bg-white/[0.07] px-2.5 py-1.5 text-center">
            <span className="tnum block font-display text-[20px] font-bold leading-none text-ink">
              {theirRow.position}
            </span>
            <span className="mt-0.5 block text-micro font-semibold uppercase tracking-[0.14em] text-ink-dim">
              in the table
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <FormGuide results={theirForm} size="sm" />
        {theirRow && (
          <span className="tnum text-[13px] text-ink-muted">
            {theirRow.points} pts · {theirRow.goalsFor}:{theirRow.goalsAgainst}
          </span>
        )}
      </div>

      <Divider className="my-3" />

      {theirStar && (
        <KeyValueRow
          label="Danger man"
          value={`${theirStar.displayName} · ${theirStar.overall}`}
          hint={`${theirStar.position} · ${theirStar.form.goals} goals this season`}
        />
      )}
      {theirTopScorer && theirTopScorer.id !== theirStar?.id && (
        <KeyValueRow
          label="Top scorer"
          value={`${theirTopScorer.displayName} · ${theirTopScorer.form.goals}`}
          hint={theirTopScorer.position}
          divided
        />
      )}
      <KeyValueRow label="Reputation" value={them.reputation} divided />
    </GlassPanel>
  );
}

/**
 * What they have worked out about you.
 *
 * Rendered only when the opposition has actually read something — an empty
 * briefing is noise, and a panel that is always present stops meaning
 * anything. When it does appear it is the most important thing on the screen
 * before kick-off, because it is the one piece of information that should
 * change the team sheet the player was about to submit.
 */
function ScoutingReportPanel({ them }: { them: Club }): ReactNode {
  const state = useGame();
  const report = useMemo(() => scoutingReportAgainst(state, them.id), [state, them.id]);
  if (report.notes.length === 0) return null;

  return (
    <GlassPanel nested level={2} padding="md" accent="danger" title={`${them.shortName} have done their homework`}>
      <ul className="space-y-2">
        {report.notes.map((note) => (
          <li key={note} className="flex gap-2.5 text-[14px] leading-snug text-ink text-pretty">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-danger" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-snug text-ink-muted text-pretty">
        Play it anyway and back your players, or change something and give up what you are good at.
      </p>
    </GlassPanel>
  );
}

function KeyBattlesPanel({
  battles, ourKit, them,
}: { battles: readonly KeyBattle[]; ourKit: KitColors; them: Club }): ReactNode {
  const theirKit = useMemo(() => kitColors(them.id, them.visual), [them]);
  if (battles.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Key battles" subtitle="Where this match gets decided" />
      <ul className="mt-3 flex flex-col gap-2">
        {battles.map((battle) => (
          <li key={battle.id}>
            <GlassPanel nested level={2} padding="sm">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                {battle.headline}
              </p>
              <div className="flex items-center gap-2">
                <BattleFace player={battle.ours} kit={ourKit} align="start" />
                <GlassPill
                  tone={battle.edge === 'US' ? 'positive' : battle.edge === 'THEM' ? 'danger' : 'neutral'}
                  size="sm"
                >
                  {battle.edge === 'US' ? 'Edge us' : battle.edge === 'THEM' ? 'Edge them' : 'Even'}
                </GlassPill>
                <BattleFace player={battle.theirs} kit={theirKit} align="end" />
              </div>
            </GlassPanel>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BattleFace({
  player, kit, align,
}: { player: Player; kit: KitColors; align: 'start' | 'end' }): ReactNode {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2',
        align === 'end' && 'flex-row-reverse text-right',
      )}
    >
      <PlayerPortrait seed={player.portraitSeed} size={34} colors={kit} shape="squircle" />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-tight text-ink text-pretty">
          {player.displayName}
        </p>
        <p className="tnum text-[12px] text-ink-dim">
          {player.position} · {player.overall}
        </p>
      </div>
    </div>
  );
}

function RuleWindowsPanel({ context }: { context: MatchdayContext }): ReactNode {
  const { ruleWindows, heldCards, theirHeldCards, them } = context;
  if (ruleWindows.length === 0 && heldCards.length === 0 && theirHeldCards.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Special rules" subtitle="Two swing windows, one in each half" />
      <div className="mt-3 flex flex-col gap-2">
        {ruleWindows.map((rule) => (
          <GlassPanel
            key={rule.id}
            nested
            level={2}
            padding="sm"
            className="raised raised-edge relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-[15px] font-bold text-ink">{rule.name}</h4>
              <GlassPill tone={SPECIAL_RULE_TONE[rule.id]} size="sm">{RULE_RARITY[rule.rarity]}</GlassPill>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-ink-muted text-pretty">{rule.description}</p>
            <p className="mt-1.5 text-[12px] leading-snug text-warning text-pretty">
              Counterplay: {rule.counterplay}
            </p>
          </GlassPanel>
        ))}

        {heldCards.length > 0 && (
          <GlassPanel nested level={2} padding="sm" title="In your hand">
            <div className="flex flex-wrap gap-1.5">
              {heldCards.map(({ definition, quantity }) => (
                <GlassPill key={definition.id} tone={SPECIAL_RULE_TONE[definition.id]} size="md">
                  {definition.name} ×{quantity}
                </GlassPill>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-dim">Playable once the match is under way.</p>
          </GlassPanel>
        )}

        {/* Knowing what they hold is the point of the hand being visible at
            all: every card names its own counterplay, and who a window ends up
            serving is decided by whoever fires into it — never promised here. */}
        {theirHeldCards.length > 0 && (
          <GlassPanel nested level={2} padding="sm" title={`In their hand (${them.shortName})`}>
            <ul className="flex flex-col gap-2.5">
              {theirHeldCards.map(({ definition, quantity }) => (
                <li key={definition.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-ink">
                      {definition.name}{quantity > 1 ? ` ×${quantity}` : ''}
                    </span>
                    <GlassPill tone={SPECIAL_RULE_TONE[definition.id]} size="xs">{RULE_RARITY[definition.rarity]}</GlassPill>
                  </div>
                  <p className="text-[12px] leading-snug text-ink-muted text-pretty">
                    Counterplay: {definition.counterplay}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-dim">
              They choose their moment. A swing window serves whoever fires into it.
            </p>
          </GlassPanel>
        )}
      </div>
    </section>
  );
}

function AvailabilityPanel({
  context, us, them,
}: { context: MatchdayContext; us: Club; them: Club }): ReactNode {
  const ours = context.ourAvailability;
  const theirs = context.theirAvailability;
  const nobodyOut =
    ours.injured.length + ours.suspended.length + theirs.injured.length + theirs.suspended.length === 0;

  return (
    <section>
      <SectionHeader title="Team news" />
      {nobodyOut ? (
        <div className="mt-3">
          <EmptyState
            size="sm"
            title="A clean bill of health"
            description="Both sides can pick from a full squad."
          />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <AvailabilityColumn club={us} label="Your squad" availability={ours} />
          <AvailabilityColumn club={them} label={them.shortName} availability={theirs} />
        </div>
      )}
    </section>
  );
}

function AvailabilityColumn({
  club, label, availability,
}: {
  club: Club;
  label: string;
  availability: { injured: readonly Player[]; suspended: readonly Player[] };
}): ReactNode {
  const empty = availability.injured.length + availability.suspended.length === 0;
  return (
    <GlassPanel nested level={2} padding="sm" title={label}>
      {empty && <p className="text-[13px] text-ink-dim">Everyone available.</p>}
      <ul className="flex flex-col gap-1.5">
        {availability.injured.map((player) => (
          <li key={player.id} className="flex items-center gap-2 text-[13px]">
            <span className="text-danger [&_svg]:size-4"><IconInjury /></span>
            <span className="min-w-0 flex-1 leading-snug text-ink text-pretty">{player.displayName}</span>
            <PositionChip position={player.position} size="xs" />
            <span className="tnum shrink-0 text-[12px] text-ink-dim">
              {player.injury?.weeksRemaining ?? 0}w
            </span>
          </li>
        ))}
        {availability.suspended.map((player) => (
          <li key={player.id} className="flex items-center gap-2 text-[13px]">
            <GlassPill tone="danger" size="xs" filled>SUS</GlassPill>
            <span className="min-w-0 flex-1 leading-snug text-ink text-pretty">{player.displayName}</span>
            <span className="tnum shrink-0 text-[12px] text-ink-dim">
              {player.suspensionMatches} match
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{club.name} availability</p>
    </GlassPanel>
  );
}

function BenchRow({ player, kit, reason }: { player: Player; kit: KitColors; reason?: string }): ReactNode {
  return (
    <li className="flex items-center gap-2.5">
      <PlayerPortrait seed={player.portraitSeed} size={28} colors={kit} shape="circle" />
      <span className="min-w-0 flex-1 text-[14px] leading-snug text-ink text-pretty">
        {player.displayName}
        {/* Why he is sitting down, in a coach's words. Never a number. */}
        {reason && <span className="block text-[11px] text-ink-dim">{reason}</span>}
      </span>
      <PositionChip position={player.position} size="xs" />
      <RatingBadge value={player.overall} scale="overall" size="xs" />
    </li>
  );
}

/** Desktop sidebar: the table around us, so the stakes have a shape. */
function PreviewAside({ context }: { context: MatchdayContext }): ReactNode {
  const { table, us, them, clubNames } = context;
  const window = useMemo(() => {
    const index = table.findIndex((row) => row.clubId === us.id);
    if (index < 0) return table.slice(0, 6);
    return table.slice(Math.max(0, index - 2), Math.max(0, index - 2) + 6);
  }, [table, us.id]);

  return (
    <GlassPanel nested level={2} padding="md" title="Around you">
      <ol className="flex flex-col">
        {window.map((row) => {
          const highlight = row.clubId === us.id || row.clubId === them.id;
          return (
            <li
              key={row.clubId}
              className={cn(
                'flex items-center gap-2 border-b border-white/[0.05] py-2 last:border-0 text-[13px]',
                highlight ? 'text-ink' : 'text-ink-muted',
              )}
            >
              <span className="tnum w-5 shrink-0 text-ink-dim">{row.position}</span>
              <span className="min-w-0 flex-1 font-medium leading-snug text-pretty">
                {clubNames[row.clubId] ?? row.clubId}
              </span>
              <span className="tnum shrink-0 font-semibold">{row.points}</span>
            </li>
          );
        })}
      </ol>
    </GlassPanel>
  );
}
