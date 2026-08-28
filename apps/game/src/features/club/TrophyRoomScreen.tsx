import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  currentCompetition, playerById, playerClub,
  type GameState, type LegacyState,
} from '@cf/engine';
import {
  ClubBadge, EmptyState, GlareHover, GlassButton, GlassPanel, GlassPill, KeyValueRow, NameText,
  PlayerPortrait, Screen, SectionHeader, ShinyText, Silverware, SpotlightCard, StatCard, StatGrid,
  TrophyMoment, cn, silverwareVariantFor, IconStar, IconTrophy,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { humanise } from '@/design/text';

/**
 * The trophy room.
 *
 * This screen has one job and it is emotional: it is the payoff for a decade of
 * play. It is the only place in the management surface allowed to use the hero
 * layer — tapping a trophy replays the moment it was won, because a trophy is
 * one of the nine licensed hero events and reliving it is the entire point of
 * keeping a cabinet.
 *
 * Empty, it still has to be worth visiting: it names the competition that could
 * fill it and shows the records and legends the club has accumulated on the way.
 */

interface TrophyEntry {
  readonly key: string;
  readonly competition: string;
  readonly season: number;
  readonly count: number;
}

const TrophyPlinth = memo(function TrophyPlinth({
  entry, accent, onPress,
}: {
  entry: TrophyEntry;
  accent: string;
  onPress: (entry: TrophyEntry) => void;
}): ReactNode {
  return (
    <SpotlightCard color={`${accent}22`} className="rounded-lg">
      <GlareHover className="rounded-lg">
        <button
          type="button"
          onClick={() => onPress(entry)}
          aria-label={`${entry.competition}, season ${entry.season}`}
          className={cn(
            'glass-2 glass-sheen relative flex w-full flex-col items-center gap-2 overflow-hidden rounded-lg px-3 py-5',
            'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
          )}
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-24"
            style={{ background: `radial-gradient(60% 100% at 50% 100%, ${accent}2e 0%, transparent 100%)` }}
          />
          {/* The real piece, not a glyph: a cabinet of identical gold pills is
              a list, a cabinet of distinguishable silverware is a cabinet. */}
          <Silverware
            variant={silverwareVariantFor(entry.competition)}
            size={72}
            className="relative drop-shadow-[0_10px_20px_rgb(255_215_106/0.18)]"
          />
          <span className="relative text-center">
            <span className="block text-[13px] font-semibold leading-tight text-ink text-balance">
              {entry.competition}
            </span>
            <span className="tnum mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-ink-dim">
              Season {entry.season}
            </span>
          </span>
        </button>
      </GlareHover>
    </SpotlightCard>
  );
});

export function TrophyRoomScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Trophy room" onBack={() => navigate(ROUTES.club)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <TrophyRoomBody state={state} />;
}

function TrophyRoomBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const [replaying, setReplaying] = useState<TrophyEntry | null>(null);

  const data = useMemo(() => {
    const club = playerClub(state);
    const legacy: LegacyState = state.legacy;
    const trophies: TrophyEntry[] = legacy.trophies
      .map((trophy, index) => ({
        key: `${trophy.competition}-${trophy.season}-${index}`,
        competition: trophy.competition,
        season: trophy.season,
        count: legacy.trophies.filter((t) => t.competition === trophy.competition).length,
      }))
      .sort((a, b) => b.season - a.season);

    const records = Object.entries(legacy.records)
      .sort((a, b) => b[1].season - a[1].season);

    const legends = [...legacy.legends].sort((a, b) => b.season - a.season);

    return {
      club,
      trophies,
      records,
      legends,
      competition: currentCompetition(state),
      distinct: new Set(legacy.trophies.map((t) => t.competition)).size,
    };
  }, [state]);

  const { club } = data;
  const accent = club.visual.primary;
  // Hoisted out of the legends loop: `PlayerPortrait` is memoised and a fresh
  // colours object per row would defeat it on every render.
  const portraitColors = useMemo(
    () => ({ primary: club.visual.primary, secondary: club.visual.secondary }),
    [club.visual.primary, club.visual.secondary],
  );
  const seasonOf = (entry: TrophyEntry) =>
    data.trophies.filter((t) => t.competition === entry.competition).length;

  return (
    <Screen
      title="Trophy room"
      subtitle={data.trophies.length
        ? `${data.trophies.length} trophies across ${data.distinct} competition${data.distinct === 1 ? '' : 's'}`
        : 'Nothing won yet'}
      onBack={() => navigate(ROUTES.club)}
      leading={<ClubBadge visual={club.visual} size={30} label={club.name} />}
      aside={
        <GlassPanel title="Club records" padding="md">
          {data.records.length === 0 ? (
            <p className="text-[13px] text-ink-muted text-pretty">No records set yet. They start appearing after your first full season.</p>
          ) : (
            data.records.map(([key, record], index) => (
              <KeyValueRow
                key={key}
                label={humanise(key)}
                hint={record.holderName ? `${record.holderName} · season ${record.season}` : `Season ${record.season}`}
                value={Math.round(record.value)}
                divided={index !== data.records.length - 1}
              />
            ))
          )}
        </GlassPanel>
      }
    >
      {/* --- the cabinet ---------------------------------------------- */}
      <GlassPanel padding="lg" accent="volt">
        <div className="flex items-center gap-4">
          {data.trophies.length === 0 ? (
            <span
              className="flex size-16 shrink-0 items-center justify-center rounded-pill bg-hero-gold/12 text-hero-gold [&_svg]:size-9"
              aria-hidden="true"
            >
              <IconTrophy />
            </span>
          ) : (
            // Once there is a cabinet at all, the header carries the dynasty
            // piece rather than a generic cup: it counts, the plinths don't.
            <Silverware variant="legacy" size={72} className="shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-dim">The cabinet</p>
            <h2 className="mt-0.5 font-display text-[34px] font-bold leading-none tracking-[-0.045em]">
              <ShinyText tone={data.trophies.length ? 'gold' : 'ink'}>
                {data.trophies.length === 0 ? 'Empty' : `${data.trophies.length}`}
              </ShinyText>
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted text-pretty">
              {data.trophies.length === 0
                ? `${data.competition?.name ?? 'The league'} is the one to win first.`
                : `${club.name} has won ${data.trophies.length} trophies since ${club.founded}.`}
            </p>
          </div>
        </div>
      </GlassPanel>

      {data.trophies.length === 0 ? (
        <EmptyState
          icon={<IconTrophy />}
          title="Nothing in the cabinet"
          description={`Win ${data.competition?.name ?? 'the league'} and it lands here permanently — with the season, the squad and the moment it was won.`}
          action={<GlassButton variant="primary" onClick={() => navigate(ROUTES.standings)}>See the table</GlassButton>}
        />
      ) : (
        <>
          <SectionHeader title="Silverware" subtitle="Tap a trophy to relive the moment" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.trophies.map((entry) => (
              <TrophyPlinth key={entry.key} entry={entry} accent={accent} onPress={setReplaying} />
            ))}
          </div>
        </>
      )}

      <StatGrid columns={2}>
        <StatCard label="Trophies" value={data.trophies.length} icon={<IconTrophy size={13} />} tone="volt" footnote={`${data.distinct} different competitions`} />
        <StatCard label="Legends" value={data.legends.length} icon={<IconStar size={13} />} footnote="Earned by service, never chosen" />
      </StatGrid>

      {/* --- legends -------------------------------------------------- */}
      <SectionHeader title="Legends" subtitle="Players who gave the club too much to forget" />
      {data.legends.length === 0 ? (
        <GlassPanel padding="md">
          <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
            Nobody has crossed the line yet. Legend status is earned by appearances and goal contributions over years —
            it cannot be bought, and selling the player does not take it away once it is given.
          </p>
        </GlassPanel>
      ) : (
        <GlassPanel padding="md">
          {data.legends.map((legend, index) => {
            const player = playerById(state, legend.playerId);
            return (
              <button
                key={legend.playerId}
                type="button"
                onClick={() => navigate(buildPath(ROUTES.player, { playerId: legend.playerId }))}
                className={cn(
                  'flex w-full min-h-11 items-center gap-3 py-2.5 text-left',
                  index !== data.legends.length - 1 && 'border-b border-white/[0.06]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                )}
              >
                <PlayerPortrait
                  seed={player?.portraitSeed ?? legend.playerId}
                  size={40}
                  shape="squircle"
                  colors={portraitColors}
                />
                <span className="min-w-0 flex-1">
                  <NameText name={legend.name} role="bodyStrong" />
                  <span className="line-clamp-2 block text-[12px] text-ink-muted text-pretty">{legend.reason}</span>
                </span>
                <GlassPill size="xs" tone="special">S{legend.season}</GlassPill>
              </button>
            );
          })}
        </GlassPanel>
      )}

      {/* --- records on narrow screens -------------------------------- */}
      <SectionHeader title="Records" subtitle="The numbers nobody at the club has beaten" />
      <GlassPanel padding="md">
        {data.records.length === 0 ? (
          <p className="text-[13px] text-ink-muted text-pretty">
            No records set yet. They appear as soon as a season completes.
          </p>
        ) : (
          data.records.map(([key, record], index) => (
            <KeyValueRow
              key={key}
              label={humanise(key)}
              hint={record.holderName ? `${record.holderName} · season ${record.season}` : `Season ${record.season}`}
              value={Math.round(record.value)}
              divided={index !== data.records.length - 1}
            />
          ))
        )}
      </GlassPanel>

      {replaying && (
        <TrophyMoment
          open
          onDismiss={() => setReplaying(null)}
          autoDismiss={0}
          competition={replaying.competition}
          season={`Season ${replaying.season}`}
          clubName={club.name}
          variant={silverwareVariantFor(replaying.competition)}
          crest={<ClubBadge visual={club.visual} size={54} label={club.name} />}
          stats={[
            { label: 'Season', value: replaying.season },
            { label: 'Times won', value: seasonOf(replaying) },
            { label: 'Reputation', value: Math.round(club.reputation) },
          ]}
        />
      )}
    </Screen>
  );
}
