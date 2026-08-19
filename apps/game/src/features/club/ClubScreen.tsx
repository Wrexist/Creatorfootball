import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clubCreators, clubTotalReach, creatorReach, pendingProjects, playerClub, recentForm,
  sponsorIncomePerCycle, squadStrength, squadWageBill, standings, totalUpkeep,
  PHILOSOPHY_LABELS, fanMood,
  type Club, type GameState, type Manager,
} from '@cf/engine';
import {
  CardRail, ClubBadge, CreatorCard, FormGuide, GlassPanel, GlassPill, KeyValueRow, ProgressBar,
  Screen, SectionHeader, StatCard, StatGrid, formatCount, formatMoney,
  IconFans, IconMoney, IconSponsor, IconStadium, IconStar, IconTrophy,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { facilityDefs, ledgerOf } from './bridge';

/**
 * Club.
 *
 * The identity screen and the hub for everything the club *is* rather than
 * everything the squad *does*. It leads with the badge, the ground and the
 * philosophy because those are the things a player picks a club for, then hands
 * off to the six sub-screens, each with the one number that tells you whether
 * it needs you.
 */

const FAN_CULTURE_LABELS: Record<Club['fanCulture'], string> = {
  ULTRAS: 'Ultras', FAMILY: 'Family club', ONLINE_NATIVE: 'Online native',
  TRADITIONAL: 'Traditional', BANDWAGON: 'Bandwagon', DIEHARD: 'Diehard',
};

const PHILOSOPHY_BLURBS: Record<Club['philosophy'], string> = {
  YOUTH_ACADEMY: 'Grow your own. Patience over transfers.',
  BIG_SPENDERS: 'Buy the answer. Live with the wage bill.',
  DATA_DRIVEN: 'Trust the numbers over the eye test.',
  CREATOR_FIRST: 'Reach is the product; results follow it.',
  DEFENSIVE_ROCK: 'Concede nothing. Win the ugly ones.',
  LOCAL_ROOTS: 'The city first. Cheap, loyal, unfashionable.',
  ENTERTAINERS: 'Score four, concede three, sell every seat.',
  VETERAN_CORE: 'Experience now. Rebuild later, painfully.',
};

export function ClubScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Club">
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <ClubBody state={state} />;
}

function ClubBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();

  const data = useMemo(() => {
    const club = playerClub(state);
    const defs = facilityDefs();
    const ledger = ledgerOf(state);
    const facilityTotal = defs.reduce((sum, def) => sum + Math.max(0, club.facilityLevels[def.id] ?? 0), 0);
    const facilityMax = defs.reduce((sum, def) => sum + def.maxLevel, 0);
    const manager: Manager | undefined = state.managers[state.playerManagerId];
    return {
      club,
      manager,
      creators: clubCreators(state, club.id),
      reach: clubTotalReach(state, club.id),
      row: standings(state).find((r) => r.clubId === club.id),
      form: recentForm(state, club.id, 5),
      strength: squadStrength(state, club.id),
      wages: squadWageBill(state, club.id),
      upkeep: totalUpkeep(club, { facilities: () => defs }),
      sponsorIncome: sponsorIncomePerCycle(state.sponsors),
      projects: pendingProjects(club),
      facilityTotal,
      facilityMax,
      balance: ledger.cashOf(club.id),
      trophies: state.legacy.trophies.length,
    };
  }, [state]);

  const { club } = data;

  return (
    <Screen
      title={club.name}
      subtitle={`${club.city} · founded ${club.founded} · ${PHILOSOPHY_LABELS[club.philosophy]}`}
      leading={<ClubBadge visual={club.visual} size={30} label={club.name} />}
      aside={
        <>
          <GlassPanel title="Identity" padding="md">
            <KeyValueRow label="Philosophy" value={PHILOSOPHY_LABELS[club.philosophy]} hint={PHILOSOPHY_BLURBS[club.philosophy]} />
            <KeyValueRow label="Fan culture" value={FAN_CULTURE_LABELS[club.fanCulture]} />
            <KeyValueRow label="Abbreviation" value={club.abbreviation} />
            <KeyValueRow label="Reputation" value={Math.round(club.reputation)} divided={false} />
          </GlassPanel>
          {data.manager && (
            <GlassPanel title="Manager" padding="md">
              <p className="text-[16px] font-semibold text-ink">{data.manager.name}</p>
              <p className="mt-1 text-[13px] text-ink-muted text-pretty">{data.manager.bio}</p>
              <div className="mt-3">
                <KeyValueRow label="Record" value={`${data.manager.careerWins}W ${data.manager.careerDraws}D ${data.manager.careerLosses}L`} divided={false} />
              </div>
            </GlassPanel>
          )}
        </>
      }
    >
      {/* --- identity ------------------------------------------------- */}
      <GlassPanel padding="lg" accent="volt">
        <div className="flex items-center gap-4">
          <ClubBadge visual={club.visual} size={72} label={club.name} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[24px] font-bold leading-tight tracking-[-0.03em] text-ink text-balance">
              {club.name}
            </h2>
            <p className="mt-1 text-[13px] italic text-ink-muted text-pretty">“{club.motto}”</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <GlassPill tone="volt" size="sm">{PHILOSOPHY_LABELS[club.philosophy]}</GlassPill>
              <GlassPill size="sm">{FAN_CULTURE_LABELS[club.fanCulture]}</GlassPill>
              {data.row && <GlassPill size="sm">{data.row.position}th · {data.row.points} pts</GlassPill>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3">
          <span className="text-[12px] text-ink-muted">Recent form</span>
          <FormGuide results={data.form} slots={5} size="md" />
        </div>
      </GlassPanel>

      <StatGrid columns={2}>
        <StatCard label="Reputation" value={Math.round(club.reputation)} suffix="/100" icon={<IconStar size={13} />} footnote="Gates sponsors and signings" />
        <StatCard label="Squad rating" value={data.strength} icon={<IconStar size={13} />} footnote={`${club.squad.length} senior players`} />
        <StatCard label="Total reach" value={<span>{formatCount(data.reach)}</span>} icon={<IconFans size={13} />} footnote="Followers plus creators" />
        <StatCard label="Balance" value={<span>{formatMoney(data.balance)}</span>} icon={<IconMoney size={13} />} footnote={`${formatMoney(data.wages)} wages a week`} />
      </StatGrid>

      {/* --- the ground ---------------------------------------------- */}
      <SectionHeader title="The ground" />
      <GlassPanel padding="md">
        <div className="flex items-start gap-3">
          <IconStadium size={22} className="mt-0.5 shrink-0 text-ink-dim" />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold text-ink">{club.stadium.name}</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              Capacity {club.stadium.capacity.toLocaleString('en-GB')} · last gate {club.fans.lastAttendance.toLocaleString('en-GB')}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          <ProgressBar label="Atmosphere" value={club.stadium.atmosphere} valueLabel={`${Math.round(club.stadium.atmosphere)}`} tone="volt" />
          <ProgressBar label="Facilities quality" value={club.stadium.quality} valueLabel={`${Math.round(club.stadium.quality)}`} tone="info" />
          <ProgressBar label="Pitch" value={club.stadium.pitchQuality} valueLabel={`${Math.round(club.stadium.pitchQuality)}`} tone="positive" />
        </div>
      </GlassPanel>

      {/* --- creators ------------------------------------------------- */}
      <SectionHeader
        title="Creators"
        subtitle={data.creators.length ? `${formatCount(data.creators.reduce((sum, c) => sum + creatorReach(c), 0))} impressions a cycle` : 'None attached yet'}
      />
      {data.creators.length > 0 ? (
        <CardRail itemWidth={230} ariaLabel="Creators attached to the club">
          {data.creators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              variant="compact"
              onPress={(id) => navigate(buildPath(ROUTES.creator, { creatorId: id }))}
            />
          ))}
        </CardRail>
      ) : (
        <GlassPanel padding="md">
          <p className="text-[13px] text-ink-muted text-pretty">
            No creators are attached to {club.shortName}. Creator reach is what sponsors actually buy — without it, the
            commercial ceiling stays where it is.
          </p>
        </GlassPanel>
      )}

      {/* --- navigation ---------------------------------------------- */}
      <SectionHeader title="Run the club" />
      <GlassPanel padding="md">
        <KeyValueRow
          icon={<IconStadium size={18} />}
          label="Facilities"
          hint={data.projects.length ? `${data.projects.length} build${data.projects.length === 1 ? '' : 's'} in progress` : `${formatMoney(data.upkeep)} upkeep a cycle`}
          value={`${data.facilityTotal}/${data.facilityMax}`}
          onPress={() => navigate(ROUTES.facilities)}
        />
        <KeyValueRow
          icon={<IconSponsor size={18} />}
          label="Sponsors"
          hint={`${state.sponsors.active.length} active · ${state.sponsors.available.length} offers on the table`}
          value={`${formatMoney(data.sponsorIncome)}/cycle`}
          onPress={() => navigate(ROUTES.sponsors)}
        />
        <KeyValueRow
          icon={<IconFans size={18} />}
          label="Fans"
          hint={`${formatCount(club.fans.base)} supporters · ${formatCount(club.fans.onlineFollowers)} online`}
          value={fanMood(club.fans)}
          onPress={() => navigate(ROUTES.fans)}
        />
        <KeyValueRow
          icon={<IconMoney size={18} />}
          label="Finances"
          hint={`Wages ${formatMoney(data.wages)} against ${formatMoney(club.finance.wageBudgetPerCycle)}`}
          value={formatMoney(data.balance)}
          onPress={() => navigate(ROUTES.finances)}
        />
        <KeyValueRow
          icon={<IconTrophy size={18} />}
          label="Trophy room"
          hint={data.trophies ? 'Everything you have won' : 'Nothing won yet'}
          value={data.trophies}
          onPress={() => navigate(ROUTES.trophyRoom)}
        />
        <KeyValueRow
          icon={<IconStar size={18} />}
          label="History"
          hint={`${state.legacy.seasonSummaries.length} completed season${state.legacy.seasonSummaries.length === 1 ? '' : 's'}`}
          value={`Season ${state.clock.season}`}
          divided={false}
          onPress={() => navigate(ROUTES.history)}
        />
      </GlassPanel>
    </Screen>
  );
}
