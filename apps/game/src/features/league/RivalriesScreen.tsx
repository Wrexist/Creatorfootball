import { memo, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fixturesFor, headToHead, rivalOpponent, rivalriesOf,
  type Fixture, type GameState, type Rivalry,
} from '@cf/engine';
import {
  ClubBadge, Divider, EmptyState, GlassPanel, GlassPill, IconFlame, KeyValueRow, MatchCard,
  ProgressBar, Screen, SectionHeader, Timeline, cn, type MatchCardSide, type TimelineItem,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';

/**
 * Rivalries.
 *
 * A rivalry is the world's memory of a grudge, and this screen is where that
 * memory is kept. Everything on it is earned: the intensity comes off real
 * meetings, the incidents were real red cards and late winners, and the origin
 * line explains why these two clubs cannot stand each other in the first place.
 * The design job is to make a number between 0 and 100 feel like a fixture you
 * are dreading.
 */

const heat = (intensity: number): { label: string; tone: 'danger' | 'warning' | 'info' | 'neutral' } => {
  if (intensity >= 78) return { label: 'Poisonous', tone: 'danger' };
  if (intensity >= 58) return { label: 'Fierce', tone: 'danger' };
  if (intensity >= 38) return { label: 'Needle', tone: 'warning' };
  if (intensity >= 20) return { label: 'Simmering', tone: 'info' };
  return { label: 'Polite', tone: 'neutral' };
};

interface RivalryCardProps {
  rivalry: Rivalry;
  ourSide: MatchCardSide;
  theirSide: MatchCardSide;
  record: ReturnType<typeof headToHead>;
  nextMeeting: Fixture | undefined;
  currentCycle: number;
  onOpenFixture: (fixture: Fixture) => void;
}

const RivalryCard = memo(function RivalryCard({
  rivalry, ourSide, theirSide, record, nextMeeting, currentCycle, onOpenFixture,
}: RivalryCardProps): ReactNode {
  const temperature = heat(rivalry.intensity);
  const total = Math.max(1, record.meetings);
  const winPct = Math.round((record.wins / total) * 100);
  const drawPct = Math.round((record.draws / total) * 100);
  const lossPct = Math.max(0, 100 - winPct - drawPct);

  const incidents = useMemo<TimelineItem[]>(
    () =>
      record.notableIncidents.map((incident, index) => ({
        id: `${rivalry.id}-${index}`,
        title: incident.text,
        time: `Matchweek ${incident.cycle}`,
        tone: incident.severity >= 3 ? 'danger' : incident.severity >= 2 ? 'warning' : 'neutral',
      })),
    [record.notableIncidents, rivalry.id],
  );

  return (
    <GlassPanel padding="md" accent={temperature.tone === 'danger' ? 'danger' : 'none'}>
      <header className="flex items-center gap-3">
        <ClubBadge visual={theirSide.visual} size={44} label={theirSide.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[20px] font-bold leading-tight text-ink">
            {theirSide.name}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-muted text-pretty">
            {rivalry.origin}
          </p>
        </div>
        <GlassPill tone={temperature.tone} size="sm" filled icon={<IconFlame size={12} />}>
          {temperature.label}
        </GlassPill>
      </header>

      <ProgressBar
        className="mt-3"
        value={Math.round(rivalry.intensity)}
        tone={temperature.tone === 'neutral' ? 'neutral' : temperature.tone}
        label="Intensity"
        valueLabel={`${Math.round(rivalry.intensity)} / 100`}
      />

      <Divider className="my-3" label="Head to head" />

      {record.meetings === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
          You have never met. The first one always sets the tone.
        </p>
      ) : (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-pill bg-white/[0.06]" role="img"
            aria-label={`${record.wins} wins, ${record.draws} draws, ${record.losses} defeats in ${record.meetings} meetings`}
          >
            <span className="bg-positive" style={{ width: `${winPct}%` }} />
            <span className="bg-white/25" style={{ width: `${drawPct}%` }} />
            <span className="bg-danger" style={{ width: `${lossPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="font-semibold text-positive">{record.wins} won</span>
            <span className="text-ink-muted">{record.draws} drawn</span>
            <span className="font-semibold text-danger">{record.losses} lost</span>
          </div>
          <KeyValueRow
            className="mt-2"
            label="Meetings"
            value={record.meetings}
            hint={
              record.lastMeetingCycle !== null
                ? `Last met on matchweek ${record.lastMeetingCycle}`
                : 'Not met yet'
            }
            divided={false}
          />
        </>
      )}

      {incidents.length > 0 && (
        <>
          <Divider className="my-3" label="What happened" />
          <Timeline items={incidents} animate={false} />
        </>
      )}

      <Divider className="my-3" label="Next meeting" />
      {nextMeeting ? (
        <MatchCard
          home={nextMeeting.homeClubId === ourSide.clubId ? ourSide : theirSide}
          away={nextMeeting.awayClubId === ourSide.clubId ? ourSide : theirSide}
          variant="upcoming"
          status={`Matchweek ${nextMeeting.week}`}
          importance={nextMeeting.importance}
          isDerby={nextMeeting.isDerby}
          onPress={() => onOpenFixture(nextMeeting)}
        />
      ) : (
        <p className="text-[13px] text-ink-muted text-pretty">
          Nothing scheduled against them this season.
        </p>
      )}

      <p className={cn('mt-3 text-[12px] leading-relaxed text-ink-dim text-pretty')}>
        {currentCycle - (rivalry.lastMeetingCycle ?? currentCycle) > 12
          ? 'The heat fades when they stop meeting. It comes straight back when they do.'
          : 'Intensity feeds atmosphere, pressure and the card count. This one is live.'}
      </p>
    </GlassPanel>
  );
});

function RivalriesView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const clubs = useClubLookup(state);

  const rivalries = useMemo(
    () => rivalriesOf(state, state.playerClubId),
    [state],
  );

  const ourFixtures = useMemo(() => fixturesFor(state, state.playerClubId), [state]);

  const ourSide = clubs.side(state.playerClubId);

  return (
    <Screen
      title="Rivalries"
      subtitle={rivalries.length > 0 ? `${rivalries.length} clubs who want to beat you more than anyone` : undefined}
      onBack={() => navigate(ROUTES.league)}
      aside={
        <GlassPanel title="Why this matters" padding="md">
          <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
            Rivalry intensity is not decoration. It raises the atmosphere, the pressure on your
            players, the card rate and how hard your fans take the result. A derby defeat costs
            more than three points.
          </p>
          <Divider className="my-3" />
          <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
            Rivalries are seeded from geography, declared history and league proximity — and then
            they earn the rest. Nothing here was scripted.
          </p>
        </GlassPanel>
      }
    >
      {rivalries.length === 0 ? (
        <EmptyState
          icon={<IconFlame />}
          title="No rivalries yet"
          description="They come from sharing a city, from history, or simply from finishing next to somebody often enough that it starts to matter."
        />
      ) : (
        <>
          <SectionHeader title="Your rivalries" subtitle="Hottest first" />
          {rivalries.map((rivalry) => {
            const opponentId = rivalOpponent(rivalry, state.playerClubId);
            const next = ourFixtures.find(
              (f) =>
                f.status === 'SCHEDULED' &&
                (f.homeClubId === opponentId || f.awayClubId === opponentId),
            );
            return (
              <RivalryCard
                key={rivalry.id}
                rivalry={rivalry}
                ourSide={ourSide}
                theirSide={clubs.side(opponentId)}
                record={headToHead(rivalry, state.playerClubId)}
                nextMeeting={next}
                currentCycle={state.clock.cycle}
                onOpenFixture={(fixture) =>
                  navigate(buildPath(ROUTES.matchPreview, { fixtureId: fixture.id }))
                }
              />
            );
          })}
        </>
      )}
    </Screen>
  );
}

export function RivalriesScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Rivalries" />;
  return <RivalriesView state={gate.state} />;
}
