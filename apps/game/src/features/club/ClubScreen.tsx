import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clubCreators, clubTotalReach, creatorReach, fanMood, pendingProjects, playerClub, recentForm,
  sponsorIncomePerCycle, squadStrength, squadWageBill, standings, totalUpkeep, wageBudgetUsage,
  PHILOSOPHY_LABELS,
  type Club, type GameState, type Manager,
} from '@cf/engine';
import {
  CardRail, ClubBadge, CreatorCard, Divider, FormGuide, GlassButton, GlassPanel, GlassPill,
  HeroSurface, ListRow, NameText, ProgressBar, Screen, StatBlock, Text, formatCount, formatMoney,
  IconFans, IconMoney, IconSponsor, IconStadium, IconStar, IconTrophy,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { facilityDefs, ledgerOf } from './bridge';

/**
 * Club.
 *
 * This is the screen where the club stops being a row in a table and starts
 * being *yours*: the crest at full size, the colours you picked rendered as
 * material rather than as a swatch, the motto, the ground, the philosophy said
 * in a sentence instead of a label, and the people who carry your name online.
 *
 * Underneath the identity it is a hub, and a hub is only useful if you can tell
 * from the outside whether a room needs you. Every row therefore carries the
 * one figure that answers that — offers waiting, builds in progress, wage
 * headroom, fan mood — plus a volt dot when the answer is "yes, now".
 */

const FAN_CULTURE_LABELS: Record<Club['fanCulture'], string> = {
  ULTRAS: 'Ultras', FAMILY: 'Family club', ONLINE_NATIVE: 'Online native',
  TRADITIONAL: 'Traditional', BANDWAGON: 'Bandwagon', DIEHARD: 'Diehard',
};

/** What each culture actually means for the manager, not what it is called. */
const FAN_CULTURE_BLURBS: Record<Club['fanCulture'], string> = {
  ULTRAS: 'Loud, loyal and merciless. They lift the ground on a good day and turn on you fast on a bad one.',
  FAMILY: 'Patient and forgiving. Attendance holds up through a bad run, but it never spikes either.',
  ONLINE_NATIVE: 'Most of them will never come to the ground. Their attention lives on the feed, and so does your commercial ceiling.',
  TRADITIONAL: 'They judge you by the badge and the table, in that order. Novelty earns you nothing here.',
  BANDWAGON: 'They arrive when you win and vanish when you do not. Great for a promotion push, useless in a rebuild.',
  DIEHARD: 'They turn up whatever happens. You will never lose them, and you will never impress them either.',
};

const PHILOSOPHY_BLURBS: Record<Club['philosophy'], string> = {
  YOUTH_ACADEMY: 'Grow your own players rather than buy them. Slower, cheaper, and the payoff arrives in two seasons.',
  BIG_SPENDERS: 'Buy the answer and live with the wage bill. Fastest route up, and the most brittle.',
  DATA_DRIVEN: 'Trust the numbers over the eye test. Fewer disasters, fewer bargains.',
  CREATOR_FIRST: 'Reach is the product and results follow it. Your sponsors care what your creators do.',
  DEFENSIVE_ROCK: 'Concede nothing and win the ugly ones. Draws are a result here, not a failure.',
  LOCAL_ROOTS: 'The city comes first. Cheap, loyal, unfashionable players who will not leave in January.',
  ENTERTAINERS: 'Score four and concede three. The stands love you; the table is a rollercoaster.',
  VETERAN_CORE: 'Experience now, rebuild painfully later. You are borrowing against the next two seasons.',
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

/** A row that can tell you, without being opened, whether it needs you. */
function HubRow({
  icon, label, meaning, value, attention, divided = true, onPress,
}: {
  icon: ReactNode;
  label: string;
  meaning: string;
  value: ReactNode;
  attention?: boolean;
  divided?: boolean;
  onPress: () => void;
}): ReactNode {
  return (
    <ListRow
      divided={divided}
      density="relaxed"
      onPress={onPress}
      chevron
      leading={
        <span className="relative flex size-9 items-center justify-center rounded-pill bg-white/[0.06] text-ink-dim">
          {icon}
          {attention && (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-pill bg-volt ring-2 ring-base" />
          )}
        </span>
      }
      title={label}
      subtitle={<span className="text-pretty">{meaning}</span>}
      trailing={<Text role="stat" className={attention ? 'text-volt' : undefined}>{value}</Text>}
    />
  );
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
    const table = standings(state);
    return {
      club,
      manager,
      creators: clubCreators(state, club.id),
      reach: clubTotalReach(state, club.id),
      table,
      row: table.find((r) => r.clubId === club.id),
      form: recentForm(state, club.id, 5),
      strength: squadStrength(state, club.id),
      wages: squadWageBill(state, club.id),
      wageUsage: wageBudgetUsage(state, club.id),
      upkeep: totalUpkeep(club, { facilities: () => defs }),
      sponsorIncome: sponsorIncomePerCycle(state.sponsors),
      projects: pendingProjects(club),
      facilityTotal,
      facilityMax,
      balance: ledger.cashOf(club.id),
      trophies: state.legacy.trophies.length,
      seasons: state.legacy.seasonSummaries.length,
      offers: state.sponsors.available.length,
      activeDeals: state.sponsors.active.length,
    };
  }, [state]);

  const { club } = data;
  const stadium = club.stadium;
  const fill = stadium.capacity > 0 ? club.fans.lastAttendance / stadium.capacity : 0;

  return (
    <Screen
      title={club.shortName}
      subtitle={`${club.city} · Founded ${club.founded} · ${PHILOSOPHY_LABELS[club.philosophy]}`}
      leading={<ClubBadge visual={club.visual} size={30} label={club.name} />}
      aside={
        <>
          <GlassPanel title="Identity" padding="md">
            <ListRow title="Philosophy" subtitle={PHILOSOPHY_LABELS[club.philosophy]} />
            <ListRow title="Supporters" subtitle={FAN_CULTURE_LABELS[club.fanCulture]} />
            <ListRow
              divided={false}
              title="Reputation"
              subtitle="Gates who will sign for you"
              trailing={<Text role="stat">{Math.round(club.reputation)}</Text>}
            />
          </GlassPanel>
          {data.manager && (
            <GlassPanel title="Manager" padding="md">
              <NameText name={data.manager.name} role="title" lines={2} />
              <Text role="caption" className="mt-1.5 text-pretty">{data.manager.bio}</Text>
              <Text role="caption" className="mt-3 text-ink-dim">
                {data.manager.careerWins} won · {data.manager.careerDraws} drawn · {data.manager.careerLosses} lost
              </Text>
            </GlassPanel>
          )}
        </>
      }
    >
      {/* --- identity ------------------------------------------------- */}
      <HeroSurface texture="stadium" bleed={club.visual.primary} bleedStrength={34} padding="md">
        <div className="flex items-start gap-4">
          <ClubBadge visual={club.visual} size={76} label={club.name} />
          <div className="min-w-0 flex-1">
            <NameText
              name={club.name}
              short={club.shortName}
              abbr={club.abbreviation}
              role="hero"
              lines={2}
              as="h2"
            />
            <Text role="caption" className="mt-1.5 italic text-pretty">“{club.motto}”</Text>
            <div className="mt-2.5 flex items-center gap-1.5" aria-label="Club colours">
              {[club.visual.primary, club.visual.secondary, club.visual.accent].map((colour, index) => (
                <span
                  key={`${colour}-${index}`}
                  className="h-2 w-9 rounded-pill"
                  style={{ background: colour }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <GlassPill tone="volt" size="sm">{PHILOSOPHY_LABELS[club.philosophy]}</GlassPill>
          <GlassPill size="sm">{FAN_CULTURE_LABELS[club.fanCulture]}</GlassPill>
          <GlassPill size="sm">{club.city}</GlassPill>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
          <div className="min-w-0">
            <Text role="label" className="text-ink-dim">Where you stand</Text>
            <Text role="bodyStrong" as="p" className="mt-0.5">
              {data.row && data.row.played > 0
                ? `${data.row.position} of ${data.table.length} · ${data.row.points} points from ${data.row.played} games`
                : 'The season has not started yet'}
            </Text>
          </div>
          <FormGuide results={data.form} slots={5} size="md" />
        </div>
      </HeroSurface>

      {/* --- what this club is --------------------------------------- */}
      <GlassPanel padding="md">
        <Text role="label" className="text-ink-dim">How this club is meant to be run</Text>
        <Text role="bodyStrong" as="p" className="mt-1.5 text-pretty">
          {PHILOSOPHY_BLURBS[club.philosophy]}
        </Text>
        <Divider className="my-3" />
        <Text role="label" className="text-ink-dim">Who your supporters are</Text>
        <Text role="caption" as="p" className="mt-1.5 text-pretty">
          {FAN_CULTURE_BLURBS[club.fanCulture]}
        </Text>
      </GlassPanel>

      <div className="grid grid-cols-2 gap-2">
        <StatBlock
          tone="volt"
          label="Reputation"
          value={Math.round(club.reputation)}
          unit="/ 100"
          caption="Decides who will sign for you"
        />
        <StatBlock
          label="Squad rating"
          value={data.strength}
          caption={`${club.squad.length} senior players`}
        />
        <StatBlock
          tone="info"
          label="People you reach"
          value={formatCount(data.reach)}
          caption="Supporters plus creator audience"
        />
        <StatBlock
          tone={data.balance > 0 ? 'positive' : 'danger'}
          label="In the bank"
          value={formatMoney(data.balance)}
          caption={`${formatMoney(data.wages)} of wages a week`}
        />
      </div>

      {/* --- the ground ---------------------------------------------- */}
      <div className="pt-1">
        <Text role="section" as="h2">Your ground</Text>
        <Text role="caption" className="mt-0.5 text-ink-dim">
          Where you play, and how much of an advantage it actually is
        </Text>
      </div>
      <GlassPanel padding="md">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-ink-dim"><IconStadium size={22} /></span>
          <div className="min-w-0 flex-1">
            <NameText name={stadium.name} role="title" lines={2} />
            <Text role="caption" className="mt-1">
              Holds {stadium.capacity.toLocaleString('en-GB')}
              {club.fans.lastAttendance > 0
                ? ` · ${club.fans.lastAttendance.toLocaleString('en-GB')} came to the last game (${Math.round(fill * 100)}% full)`
                : ' · no home game played yet'}
            </Text>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <ProgressBar
            label="Atmosphere"
            value={stadium.atmosphere}
            valueLabel={`${Math.round(stadium.atmosphere)}`}
            tone="volt"
          />
          <ProgressBar
            label="Facilities"
            value={stadium.quality}
            valueLabel={`${Math.round(stadium.quality)}`}
            tone="info"
          />
          <ProgressBar
            label="Pitch"
            value={stadium.pitchQuality}
            valueLabel={`${Math.round(stadium.pitchQuality)}`}
            tone="positive"
          />
        </div>
        <Text role="caption" className="mt-3 text-ink-dim text-pretty">
          A loud ground lifts your players and unsettles theirs. A poor pitch takes the edge off passing teams — yours
          included.
        </Text>
      </GlassPanel>

      {/* --- run the club --------------------------------------------- */}
      <div className="pt-1">
        <Text role="section" as="h2">Run the club</Text>
        <Text role="caption" className="mt-0.5 text-ink-dim">
          A green dot means that room is waiting on a decision from you
        </Text>
      </div>
      <GlassPanel padding="sm">
        <HubRow
          icon={<IconStadium size={18} />}
          label="Facilities"
          meaning={data.projects.length
            ? `${data.projects.length} ${data.projects.length === 1 ? 'build is' : 'builds are'} under way`
            : `Nothing being built. They cost ${formatMoney(data.upkeep)} a week to keep open.`}
          value={`${data.facilityTotal}/${data.facilityMax}`}
          onPress={() => navigate(ROUTES.facilities)}
        />
        <HubRow
          icon={<IconSponsor size={18} />}
          label="Sponsors"
          meaning={data.offers > 0
            ? `${data.offers} ${data.offers === 1 ? 'offer is' : 'offers are'} waiting for an answer`
            : `${data.activeDeals} ${data.activeDeals === 1 ? 'deal is' : 'deals are'} running. No new offers.`}
          value={`${formatMoney(data.sponsorIncome)}/wk`}
          attention={data.offers > 0}
          onPress={() => navigate(ROUTES.sponsors)}
        />
        <HubRow
          icon={<IconFans size={18} />}
          label="Fans"
          meaning={`${formatCount(club.fans.base)} supporters, ${formatCount(club.fans.onlineFollowers)} following online. They are ${fanMood(club.fans).toLowerCase()}.`}
          value={`${Math.round(club.fans.sentiment)}`}
          attention={club.fans.sentiment < 40}
          onPress={() => navigate(ROUTES.fans)}
        />
        <HubRow
          icon={<IconMoney size={18} />}
          label="Finances"
          meaning={`You are using ${Math.round(data.wageUsage * 100)}% of your wage budget${data.wageUsage > 1 ? ' — that is over the limit' : ''}.`}
          value={formatMoney(data.balance)}
          attention={data.wageUsage > 1 || club.finance.debt > 0}
          onPress={() => navigate(ROUTES.finances)}
        />
        <HubRow
          icon={<IconTrophy size={18} />}
          label="Trophy room"
          meaning={data.trophies > 0
            ? `${data.trophies} ${data.trophies === 1 ? 'trophy' : 'trophies'} in the cabinet`
            : 'Empty. Every dynasty starts here.'}
          value={data.trophies}
          onPress={() => navigate(ROUTES.trophyRoom)}
        />
        <HubRow
          divided={false}
          icon={<IconStar size={18} />}
          label="History"
          meaning={data.seasons > 0
            ? `${data.seasons} completed ${data.seasons === 1 ? 'season' : 'seasons'} on record`
            : 'Nothing written yet. Your first season is being written now.'}
          value={`S${state.clock.season}`}
          onPress={() => navigate(ROUTES.history)}
        />
      </GlassPanel>

      {/* --- creators ------------------------------------------------- */}
      <div className="pt-1">
        <Text role="section" as="h2">Creators attached to the club</Text>
        <Text role="caption" className="mt-0.5 text-ink-dim">
          {data.creators.length
            ? `They put you in front of ${formatCount(data.creators.reduce((sum, c) => sum + creatorReach(c), 0))} people a week`
            : 'Nobody is carrying your name online yet'}
        </Text>
      </div>
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
          <Text role="body" as="p" className="text-pretty">
            No creators have signed up to {club.shortName}. Creator reach is what sponsors are really paying for, so
            without it your commercial income stays where it is no matter how well the team plays.
          </Text>
          <div className="mt-3">
            <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.social)}>
              Find creators
            </GlassButton>
          </div>
        </GlassPanel>
      )}

      <div className="pb-2" />
    </Screen>
  );
}
