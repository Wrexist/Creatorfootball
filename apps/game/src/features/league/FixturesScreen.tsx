import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  specialRuleById, type ClubId, type Fixture, type GameState, type SpecialRuleId,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassPanel, GlassPill, GlassSegmented, IconCalendar, IconFlame,
  Screen, SectionHeader, cn, type MatchCardSide,
  Text,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import { useCalendar, type Matchweek } from './data';
import { FixtureCard } from './components/FixtureCard';

/**
 * The season calendar.
 *
 * Matchweeks are named by their phase — Opening Fixtures, Rivalry Week, Derby
 * Week, Playoff Push, Final Week — because those names are the shape of the
 * season. "Week 14" tells you nothing; "Derby Week" tells you what kind of week
 * you are walking into and why the rule cards matter more than usual.
 */

const PHASE_TONE: Record<string, 'volt' | 'danger' | 'info' | 'special' | 'warning' | 'neutral'> = {
  PRE_SEASON: 'neutral',
  OPENING_FIXTURES: 'info',
  RIVALRY_WEEK: 'danger',
  TRANSFER_WINDOW: 'volt',
  CREATOR_EVENT: 'special',
  MID_SEASON_PUSH: 'neutral',
  DERBY_WEEK: 'danger',
  PLAYOFF_PUSH: 'warning',
  FINAL_WEEK: 'warning',
  PLAYOFFS: 'volt',
  CHAMPIONSHIP: 'volt',
  LEGACY: 'neutral',
};

type Scope = 'OURS' | 'ALL';

const SCOPES = [
  { value: 'OURS' as const, label: 'Our fixtures' },
  { value: 'ALL' as const, label: 'Whole league' },
];

/**
 * Special rules in play that week.
 *
 * Five loud pills per matchweek, repeated down a twenty-two week calendar, is
 * more chrome than the fixtures themselves. Three are named and the rest are
 * counted; the full list is one tap away on the match preview.
 */
const SHOWN_RULES = 3;

const RuleChips = memo(function RuleChips({
  rules,
}: { rules: readonly SpecialRuleId[] }): ReactNode {
  if (rules.length === 0) return null;
  const shown = rules.slice(0, SHOWN_RULES);
  const extra = rules.length - shown.length;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <Text role="micro" as="span">Rules in play</Text>
      {shown.map((id) => {
        const rule = specialRuleById(id);
        return (
          <GlassPill key={id} tone="special" size="xs" title={rule.description}>
            {rule.name}
          </GlassPill>
        );
      })}
      {extra > 0 && (
        <GlassPill tone="special" size="xs">
          {extra} more
        </GlassPill>
      )}
    </div>
  );
});

interface WeekBlockProps {
  week: Matchweek;
  side: (id: ClubId) => MatchCardSide;
  ourClubId: ClubId;
  scope: Scope;
  onOpen: (fixture: Fixture) => void;
}

const WeekBlock = memo(function WeekBlock({
  week, side, ourClubId, scope, onOpen,
}: WeekBlockProps): ReactNode {
  const fixtures = scope === 'ALL'
    ? week.fixtures
    : week.fixtures.filter((f) => f.homeClubId === ourClubId || f.awayClubId === ourClubId);
  if (fixtures.length === 0) return null;

  const rules = [...new Set(fixtures.flatMap((f) => f.enabledSpecialRules))];

  return (
    <section className="flex flex-col gap-2">
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1 py-1',
          week.isCurrent && 'bg-volt/[0.08]',
        )}
      >
        <GlassPill tone={PHASE_TONE[week.phase] ?? 'neutral'} size="xs" filled={week.isCurrent}>
          {week.phaseLabel}
        </GlassPill>
        {/* Sentence case, not uppercase: "MATCHWEEK 12" is a third wider for
            no extra meaning, and at 375px it wrapped onto a second line beside
            the phase pill. */}
        <Text role="label" as="span" className="shrink-0 whitespace-nowrap text-ink-dim">
          Matchweek {week.week}
        </Text>
        {week.hasDerby && (
          <GlassPill tone="danger" size="xs" icon={<IconFlame size={11} />}>
            Derby
          </GlassPill>
        )}

      </div>

      <div className="flex flex-col gap-2">
        {fixtures.map((fixture) => (
          <FixtureCard
            key={fixture.id}
            fixture={fixture}
            home={side(fixture.homeClubId)}
            away={side(fixture.awayClubId)}
            phaseLabel={week.phaseLabel}
            showPhase={false}
            onPress={() => onOpen(fixture)}
          />
        ))}
      </div>

      <RuleChips rules={rules} />
    </section>
  );
});

function FixturesView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const clubs = useClubLookup(state);
  const calendar = useCalendar(state);
  const [scope, setScope] = useState<Scope>('OURS');

  const openFixture = (fixture: Fixture): void => {
    if (fixture.status === 'COMPLETED' && fixture.matchId) {
      navigate(buildPath(ROUTES.matchResult, { matchId: fixture.matchId }));
      return;
    }
    navigate(buildPath(ROUTES.matchPreview, { fixtureId: fixture.id }));
  };

  const phases = useMemo(() => {
    const seen = new Map<string, string>();
    for (const week of calendar) seen.set(week.phase, week.phaseLabel);
    return [...seen.entries()];
  }, [calendar]);

  return (
    <Screen
      title="Fixtures"
      subtitle={`${calendar.length} matchweeks in this season`}
      onBack={() => navigate(ROUTES.league)}
      headerAccessory={
        <GlassSegmented
          options={SCOPES}
          value={scope}
          onChange={setScope}
          aria-label="Which fixtures to show"
          block
          nested
        />
      }
      aside={
        <GlassPanel title="How the season is shaped" padding="md">
          <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
            Weeks are not anonymous. Each one carries a phase that changes what the week is for —
            when the market opens, when the derbies land, when the run-in starts.
          </p>
          <Divider className="my-3" />
          <ul className="flex flex-col gap-1.5">
            {phases.map(([phase, label]) => (
              <li key={phase} className="flex items-center gap-2">
                <GlassPill tone={PHASE_TONE[phase] ?? 'neutral'} size="xs">{label}</GlassPill>
              </li>
            ))}
          </ul>
        </GlassPanel>
      }
    >
      {calendar.length === 0 ? (
        <EmptyState
          icon={<IconCalendar />}
          title="No calendar yet"
          description="Fixtures are drawn when the season starts. Once they are, this becomes the spine of your year."
        />
      ) : (
        <>
          <SectionHeader
            title="The calendar"
            subtitle={scope === 'OURS' ? 'Your matches only' : 'Every match in the league'}
          />
          {calendar.map((week) => (
            <WeekBlock
              key={week.week}
              week={week}
              side={clubs.side}
              ourClubId={state.playerClubId}
              scope={scope}
              onOpen={openFixture}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

export function FixturesScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Fixtures" />;
  return <FixturesView state={gate.state} />;
}
