import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  POSITION_GROUPS, nextFixture, playerClub, positionGroup, squadOf, squadStrength,
  trackEvent, type Player, type PositionGroup,
} from '@cf/engine';
import {
  CardRail, GlassButton, GlassPanel, GlassPill, PlayerCard, ProgressBar, SectionHeader,
  StatCard, StatGrid, useConfirm,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { CreationScreen } from './CreationScreen';
import { useCreationStore } from './creationStore';

/**
 * Minute 3-5: the squad.
 *
 * This is an introduction, not a management screen. It answers three questions
 * and then gets out of the way: who is good, who is the problem, and what
 * happens next. There is no lineup editor here, no training plan and no
 * transfer list — every one of those exists behind the tab bar the player is
 * about to meet, and putting them in the first five minutes is how a football
 * game loses somebody in a spreadsheet before they have kicked a ball.
 *
 * Everything on it is engine data. The grouping and ordering below are
 * presentation over `Player.overall` and `Player.position` — no rating, no
 * strength and no valuation is computed here.
 */

const GROUP_LABEL: Record<PositionGroup, string> = {
  GK: 'Goalkeepers',
  DEF: 'Defence',
  MID: 'Midfield',
  ATT: 'Attack',
};

const GROUP_ORDER: readonly PositionGroup[] = ['GK', 'DEF', 'MID', 'ATT'];

/** Cover the format actually needs: 1 keeper, then outfield depth per line. */
const MINIMUM_COVER: Record<PositionGroup, number> = { GK: 2, DEF: 4, MID: 5, ATT: 3 };

interface GroupSummary {
  readonly group: PositionGroup;
  readonly players: readonly Player[];
  readonly best: number;
  readonly average: number;
  readonly short: number;
}

function summarise(squad: readonly Player[]): GroupSummary[] {
  return GROUP_ORDER.map((group) => {
    const players = squad
      .filter((p) => positionGroup(p.position) === group)
      .sort((a, b) => b.overall - a.overall);
    const total = players.reduce((sum, p) => sum + p.overall, 0);
    return {
      group,
      players,
      best: players[0]?.overall ?? 0,
      average: players.length > 0 ? Math.round(total / players.length) : 0,
      short: Math.max(0, MINIMUM_COVER[group] - players.length),
    };
  });
}

/**
 * The single line the player should remember. A gap in cover beats a weak
 * average, because one injury there ends the week — and if neither is true we
 * say so instead of inventing a crisis.
 */
function problemLine(groups: readonly GroupSummary[]): { headline: string; detail: string } {
  const missing = [...groups].filter((g) => g.short > 0).sort((a, b) => b.short - a.short)[0];
  if (missing) {
    return {
      headline: `You are short in ${GROUP_LABEL[missing.group].toLowerCase()}`,
      detail:
        `${missing.players.length} fit for ${POSITION_GROUPS[missing.group].length} shirts. ` +
        'One injury there and you are improvising.',
    };
  }
  const weakest = [...groups]
    .filter((g) => g.players.length > 0)
    .sort((a, b) => a.average - b.average)[0];
  if (!weakest) return { headline: 'No squad yet', detail: '' };
  return {
    headline: `Your ${GROUP_LABEL[weakest.group].toLowerCase()} is the weak link`,
    detail: `Averaging ${weakest.average}. It is the first thing rivals will aim at.`,
  };
}

export function SquadIntroScreen(): ReactNode {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const gameState = useGameStore((s) => s.state);
  const abandon = useGameStore((s) => s.abandon);
  const resetDraft = useCreationStore((s) => s.reset);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const data = useMemo(() => {
    if (!gameState) return null;
    const club = playerClub(gameState);
    const squad = squadOf(gameState, club.id).slice().sort((a, b) => b.overall - a.overall);
    return {
      club,
      squad,
      standouts: squad.slice(0, 3),
      groups: summarise(squad),
      strength: squadStrength(gameState, club.id),
      fixture: nextFixture(gameState, club.id),
    };
  }, [gameState]);

  if (!data) return null;

  const { club, squad, standouts, groups, strength, fixture } = data;
  const problem = problemLine(groups);
  const opponentId = fixture
    ? fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId
    : null;
  const opponent = opponentId ? gameState?.clubs[opponentId] : undefined;

  const kickOff = (): void => {
    trackEvent('onboarding_complete', {
      clubId: club.id,
      squadSize: squad.length,
      firstOpponent: opponent?.shortName ?? null,
    });
    // The draft has done its job; a later new career starts clean.
    resetDraft();
    navigate(
      fixture ? buildPath(ROUTES.matchPreview, { fixtureId: fixture.id }) : ROUTES.matchday,
      { replace: true },
    );
  };

  const startOver = async (): Promise<void> => {
    const ok = await confirm({
      title: `Delete ${club.name}?`,
      description:
        'The club, the squad and the season you just created are removed and you go back to the start of creation. What you typed is kept.',
      confirmLabel: 'Delete and restart',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    await abandon();
    navigate(ROUTES.managerCreation, { replace: true });
  };

  return (
    <CreationScreen
      step="squad"
      title="Your squad"
      subtitle={`${squad.length} players. Three of them are worth knowing by name.`}
      footer={
        <div className="flex flex-col gap-2">
          <GlassButton variant="primary" size="lg" block onClick={kickOff}>
            {opponent ? `Play ${opponent.shortName}` : 'Play your first match'}
          </GlassButton>
          <button
            type="button"
            onClick={() => void startOver()}
            className="min-h-11 text-[13px] font-semibold text-ink-dim hover:text-ink"
          >
            Start over instead
          </button>
        </div>
      }
    >
      <div ref={headingRef} tabIndex={-1} aria-label="Step 3 of 3, squad" className="outline-none" />

      <StatGrid columns={3}>
        <StatCard label="Squad rating" value={strength} nested size="sm" />
        <StatCard label="Players" value={squad.length} nested size="sm" />
        <StatCard
          label="Reputation"
          value={club.reputation}
          nested
          size="sm"
        />
      </StatGrid>

      <div>
        <SectionHeader
          title="Your best three"
          subtitle="Build the side around them until somebody better arrives."
        />
        <CardRail itemWidth={188} bleed ariaLabel="Standout players">
          {standouts.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              variant="featured"
              club={{ name: club.name, abbreviation: club.abbreviation, visual: club.visual }}
            />
          ))}
        </CardRail>
      </div>

      <GlassPanel level={1} radius="lg" padding="md" nested accent="danger">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-danger">The problem</p>
        <h3 className="mt-1.5 font-display text-[19px] font-bold tracking-[-0.03em] text-ink">
          {problem.headline}
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted text-pretty">
          {problem.detail}
        </p>
      </GlassPanel>

      <div>
        <SectionHeader title="The shape of it" size="sm" />
        <div className="mt-3 flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.group}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{GROUP_LABEL[group.group]}</span>
                <span className="tnum text-[12px] text-ink-dim">
                  {group.players.length} players · best {group.best}
                </span>
              </div>
              <ProgressBar
                value={group.average}
                size="sm"
                tone={group.short > 0 ? 'danger' : 'volt'}
                valueLabel={`avg ${group.average}`}
              />
            </div>
          ))}
        </div>
      </div>

      {opponent && fixture && (
        <GlassPanel level={1} radius="lg" padding="md" nested accent="volt">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-volt">Next</p>
          <h3 className="mt-1.5 font-display text-[19px] font-bold tracking-[-0.03em] text-ink">
            {fixture.homeClubId === club.id ? 'Home to' : 'Away to'} {opponent.name}
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted text-pretty">
            You pick the side and the shape at the team talk. Nothing is locked in yet.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <GlassPill tone="neutral" size="xs">Week {fixture.week}</GlassPill>
            {fixture.isDerby && <GlassPill tone="danger" size="xs">Derby</GlassPill>}
          </div>
        </GlassPanel>
      )}
    </CreationScreen>
  );
}
