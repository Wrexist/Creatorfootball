import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  clubById, contractFor, estimatedOverall, familiarity, formationById, knowledgeConfidence,
  knowledgeRange, keyAttributes, playerById, potentialRange, rolePromiseDelta,
  ATTRIBUTE_CATEGORIES, ATTRIBUTE_LABELS, MENTAL_KEYS, MENTAL_LABELS, POSITION_LABELS,
  SQUAD_ROLE_LABELS, TRAIT_BY_ID, VOLATILE_MENTAL,
  type AttributeKey, type Club, type GameState, type MentalKey, type Player,
  type TraitDefinition,
} from '@cf/engine';
import {
  Accordion, AttributeBar, ClubBadge, DataCell, DataGrid, Divider, EmptyState, GlassButton,
  GlassPanel, GlassPill, GlassSheet, ListRow, NameText, PlayerPortrait, PositionChip, ProgressBar,
  RatingBadge, Screen, Sparkline, StatBlock, Text, Timeline, TraitChip, cn, formatMoney, rgba,
  IconBall, IconCard, IconInjury, IconScout, IconSocial, IconStar, IconWarning,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { playerArc } from './arc';

/**
 * Player profile — a signature screen.
 *
 * Two rules define it.
 *
 * **It never lies about what you know.** Attributes are drawn through the
 * engine's `knowledgeRange`, so an unscouted player shows a band and a scouted
 * one shows a number, and the band visibly narrows as confidence rises. A
 * precise-looking 74 on a player nobody has watched would be a fabrication, and
 * it would quietly make scouting — an entire game system — pointless.
 *
 * **It tells you who he is, not only what he scores.** The arc sits high on the
 * page, above the attribute tables, because "signed for £40k, first goal in
 * week six, now rated 66 and worth 34% more" is the thing that makes a player
 * matter to you. Numbers alone make a spreadsheet; a spreadsheet is not
 * something you feel bad about selling.
 */

const MODIFIER_LABELS: Record<string, string> = {
  shotConversion: 'Shot conversion', bigMatchBonus: 'Big matches', lateGameBonus: 'Late in games',
  duelWin: 'Duels', passAccuracy: 'Passing', pressResistance: 'Under pressure',
  dribbleSuccess: 'Dribbling', tackleSuccess: 'Tackling', saveChance: 'Saves',
  creativity: 'Chance creation', aerialThreat: 'In the air', counterThreat: 'On the break',
  staminaDrain: 'Stamina drain', injuryRisk: 'Injury risk', cardRisk: 'Card risk',
  developmentRate: 'Development', moraleResilience: 'Morale resilience', teammateMorale: 'Squad morale',
  fanAppeal: 'Fan appeal', commercialValue: 'Commercial value', marketValue: 'Market value',
  wageDemand: 'Wage demand', chemistry: 'Chemistry',
};

/** Reads the personality constants into a sentence a human would actually say. */
function personalityRead(player: Player): string {
  const m = player.mental;
  const parts: string[] = [];
  if (m.professionalism >= 70) parts.push('trains like a professional');
  else if (m.professionalism <= 35) parts.push('cuts corners in training');
  if (m.leadership >= 70) parts.push('leads the dressing room');
  if (m.ambition >= 75) parts.push('wants more than this club currently offers');
  else if (m.loyalty >= 75) parts.push('is loyal to a fault');
  if (m.consistency <= 40) parts.push('runs hot and cold week to week');
  if (m.pressureHandling >= 70) parts.push('turns up when it matters');
  else if (m.pressureHandling <= 35) parts.push('shrinks in the big ones');
  if (m.temperament <= 35) parts.push('takes being benched badly');
  if (parts.length === 0) return 'A steady, unremarkable character. Nothing in his profile will surprise you either way.';
  return `He ${parts.join(', ')}.`;
}

const AttributeGroup = memo(function AttributeGroup({
  title, keys, player, emphasis,
}: {
  title: string;
  keys: readonly AttributeKey[];
  player: Player;
  emphasis: ReadonlySet<AttributeKey>;
}): ReactNode {
  return (
    <div className="mb-4 last:mb-0">
      <Text role="label" className="mb-2 text-ink-dim">{title}</Text>
      <div className="flex flex-col gap-2">
        {keys.map((key) => (
          <AttributeBar
            key={key}
            label={ATTRIBUTE_LABELS[key]}
            value={player.attributes[key]}
            range={knowledgeRange(player, key)}
            emphasis={emphasis.has(key)}
          />
        ))}
      </div>
    </div>
  );
});

export function PlayerProfileScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();
  const { playerId } = useParams<{ playerId: string }>();

  if (!state) {
    return (
      <Screen title="Player" onBack={() => navigate(-1)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }

  const player = playerId ? playerById(state, playerId as Player['id']) : undefined;
  if (!player) {
    return (
      <Screen title="Player" onBack={() => navigate(ROUTES.squad)}>
        <EmptyState
          icon={<IconWarning />}
          title="No such player"
          description="That player is not in this save any more — he may have been sold, released or retired."
          action={<GlassButton variant="secondary" onClick={() => navigate(ROUTES.squad)}>Back to the squad</GlassButton>}
        />
      </Screen>
    );
  }

  return <ProfileBody state={state} player={player} />;
}

function ProfileBody({ state, player }: { state: GameState; player: Player }): ReactNode {
  const navigate = useNavigate();
  const [trait, setTrait] = useState<TraitDefinition | null>(null);

  const data = useMemo(() => {
    const club: Club | undefined = player.clubId ? clubById(state, player.clubId) : undefined;
    const contract = contractFor(state, player.id);
    const confidence = knowledgeConfidence(player);
    const [potentialLow, potentialHigh] = potentialRange(player);
    const traits = player.traitIds
      .map((id) => TRAIT_BY_ID.get(id))
      .filter((t): t is TraitDefinition => t !== undefined);
    const creator = player.creatorId ? state.creators[player.creatorId] : undefined;
    const ownClub = club?.id === state.playerClubId ? club : undefined;
    const formation = ownClub ? formationById(ownClub.tactics.formationId) : null;
    const slot = formation && ownClub
      ? formation.slots.find((s) => ownClub.tactics.lineup[s.id] === player.id)
      : undefined;

    return {
      club,
      ownClub,
      contract,
      confidence,
      exact: confidence >= 1,
      estimated: estimatedOverall(player),
      potentialLow,
      potentialHigh,
      traits,
      creator,
      slot,
      keyAttrs: new Set(keyAttributes(player.attributes, player.position, 3)),
      captain: ownClub?.tactics.captainId === player.id,
      penalties: ownClub?.tactics.penaltyTakerId === player.id,
      setPieces: ownClub?.tactics.setPieceTakerId === player.id,
      arc: playerArc(state, player),
    };
  }, [state, player]);

  const portraitColors = useMemo(
    () => (data.club
      ? { primary: data.club.visual.primary, secondary: data.club.visual.secondary }
      : { primary: '#1c2026', secondary: '#262b33' }),
    [data.club],
  );

  const wash = data.club ? data.club.visual.primary : '#1c2026';
  const ratings = player.form.recentRatings;
  const potential = data.potentialLow === data.potentialHigh
    ? `${data.potentialLow}`
    : `${data.potentialLow}–${data.potentialHigh}`;

  return (
    <Screen
      title={player.displayName}
      subtitle={`${POSITION_LABELS[player.position]} · ${player.age} years old · ${data.club?.name ?? 'No club'}`}
      onBack={() => navigate(-1)}
      hero={
        <div className="relative overflow-hidden">
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `linear-gradient(168deg, ${rgba(wash, 0.6)} 0%, ${rgba(wash, 0.14)} 52%, transparent 88%)`,
            }}
          />
          <div className="relative mx-auto flex w-full max-w-[1180px] items-end gap-4 px-4 pb-4 pt-5 sm:px-6">
            <PlayerPortrait
              seed={player.portraitSeed}
              size={116}
              shape="squircle"
              kit
              colors={portraitColors}
              label={player.displayName}
            />
            <div className="min-w-0 flex-1 pb-1">
              <NameText
                name={player.displayName}
                short={`${player.firstName.charAt(0)}. ${player.lastName}`}
                role="title"
                lines={2}
                as="h2"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <PositionChip position={player.position} size="md" />
                {player.secondaryPositions.map((position) => (
                  <PositionChip key={position} position={position} size="xs" />
                ))}
                {player.shirtNumber !== null && <GlassPill size="xs">No. {player.shirtNumber}</GlassPill>}
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <RatingBadge
                  value={data.exact ? player.overall : data.estimated}
                  size="lg"
                  label={data.exact ? `Overall ${player.overall}` : `Estimated overall, around ${data.estimated}`}
                />
                <div className="min-w-0">
                  <Text role="micro" as="p">{data.exact ? 'Overall' : 'Best estimate'}</Text>
                  <Text role="caption" as="p" className="mt-0.5">
                    Could reach {potential}
                  </Text>
                </div>
              </div>
            </div>
            {data.club && <ClubBadge visual={data.club.visual} size={44} label={data.club.name} />}
          </div>
        </div>
      }
      aside={
        <>
          <GlassPanel title="At a glance" padding="md">
            <ListRow title="Worth about" trailing={<Text role="stat">{formatMoney(player.marketValue)}</Text>} />
            <ListRow title="Reputation" trailing={<Text role="stat">{Math.round(player.reputation)}</Text>} />
            <ListRow title="From" trailing={<Text role="stat">{player.nationality}</Text>} />
            <ListRow title="Height" trailing={<Text role="stat">{Math.round(player.height)}cm</Text>} />
            <ListRow divided={false} title="Stronger foot" trailing={<Text role="stat">{player.footedness}</Text>} />
          </GlassPanel>
          {data.traits.length > 0 && (
            <GlassPanel title="What makes him different" padding="md">
              <div className="flex flex-wrap gap-1.5">
                {data.traits.map((definition) => (
                  <TraitChip key={definition.id} trait={definition} onPress={() => setTrait(definition)} />
                ))}
              </div>
            </GlassPanel>
          )}
        </>
      }
    >
      {/* --- availability -------------------------------------------- */}
      {player.injury && (
        <GlassPanel padding="sm" accent="danger">
          <div className="flex items-center gap-2.5">
            <IconInjury size={18} className="shrink-0 text-danger" />
            <Text role="caption" as="p" className="text-ink text-pretty">
              <strong className="font-semibold">{player.injury.description}.</strong>{' '}
              He cannot play for about {player.injury.weeksRemaining} more weeks.
            </Text>
          </div>
        </GlassPanel>
      )}
      {player.suspensionMatches > 0 && (
        <GlassPanel padding="sm" accent="danger">
          <div className="flex items-center gap-2.5">
            <IconCard size={18} className="shrink-0 text-warning" />
            <Text role="caption" as="p" className="text-ink">
              Suspended for {player.suspensionMatches} {player.suspensionMatches === 1 ? 'match' : 'matches'}.
            </Text>
          </div>
        </GlassPanel>
      )}

      {/* --- scouting confidence -------------------------------------- */}
      {!data.exact && (
        <GlassPanel padding="md" accent="volt">
          <div className="flex items-start gap-3">
            <IconScout size={20} className="mt-0.5 shrink-0 text-volt" />
            <div className="min-w-0 flex-1">
              <Text role="bodyStrong" as="p">Nobody has watched him properly yet</Text>
              <Text role="caption" as="p" className="mt-1 text-pretty">
                His attributes below are shown as the range your scouts can honestly justify, not as invented
                precision. Send a scout and the bands narrow — that is exactly what scouting buys you.
              </Text>
              <div className="mt-3">
                <ProgressBar
                  value={data.confidence * 100}
                  tone="volt"
                  label="How much you know"
                  valueLabel={`${Math.round(data.confidence * 100)}%`}
                />
              </div>
              <div className="mt-3">
                <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.scouting)}>
                  Send a scout
                </GlassButton>
              </div>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* --- where he is right now ------------------------------------ */}
      <div className="grid grid-cols-2 gap-2">
        <StatBlock
          tone={player.fitness >= 75 ? 'positive' : player.fitness >= 45 ? 'warning' : 'danger'}
          label="Fitness"
          value={Math.round(player.fitness)}
          unit="%"
          caption={player.fitness >= 80 ? 'Fresh enough to start' : player.fitness >= 55 ? 'Tiring — rotate him soon' : 'He needs a rest'}
        />
        <StatBlock
          tone={player.form.rating >= 0.2 ? 'positive' : player.form.rating <= -0.2 ? 'danger' : 'neutral'}
          label="Form"
          value={ratings.length ? (ratings[ratings.length - 1] ?? 0).toFixed(1) : '—'}
          caption={ratings.length
            ? `Last rating from ${ratings.length} recent ${ratings.length === 1 ? 'game' : 'games'}`
            : 'He has not played yet'}
          trailing={ratings.length > 1
            ? <Sparkline values={ratings} width={56} height={20} tone="volt" fill label="Recent ratings" />
            : undefined}
        />
        <StatBlock
          tone={player.mental.morale >= 65 ? 'positive' : player.mental.morale >= 40 ? 'warning' : 'danger'}
          label="Happiness"
          value={Math.round(player.mental.morale)}
          unit="/ 100"
          caption={player.mental.morale >= 65 ? 'Content at the club' : player.mental.morale >= 40 ? 'Unsettled' : 'Wants things to change'}
        />
        <StatBlock
          tone={data.arc.valueChange !== null && data.arc.valueChange > 0 ? 'positive' : 'neutral'}
          label="Worth about"
          value={formatMoney(player.marketValue)}
          caption={data.arc.valueChange !== null
            ? `${data.arc.valueChange >= 0 ? 'Up' : 'Down'} ${Math.abs(data.arc.valueChange)}% on the ${formatMoney(data.arc.feePaid ?? 0)} you paid`
            : 'What another club would expect to pay'}
        />
      </div>

      {/* --- the arc -------------------------------------------------- */}
      <div className="pt-1">
        <Text role="section" as="h2">His story so far</Text>
        <Text role="caption" className="mt-0.5 text-ink-dim">
          Everything that has actually happened to him, in order
        </Text>
      </div>
      <GlassPanel padding="md">
        <Timeline
          animate={false}
          items={data.arc.entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            ...(entry.detail ? { description: entry.detail } : {}),
            time: entry.when,
            tone: entry.tone,
          }))}
        />
      </GlassPanel>

      {/* --- this season ---------------------------------------------- */}
      <div className="pt-1">
        <Text role="section" as="h2">This season</Text>
      </div>
      <GlassPanel padding="md">
        <DataGrid columns={4}>
          <DataCell label="Games" value={player.form.appearances} />
          <DataCell label="Goals" value={player.form.goals} emphasis={player.form.goals > 0} />
          <DataCell label="Assists" value={player.form.assists} />
          <DataCell label="Minutes" value={player.form.minutes} />
        </DataGrid>
        <div className="mt-3">
          <DataGrid columns={3}>
            <DataCell label="Clean sheets" value={player.form.cleanSheets} />
            <DataCell label="Yellows" value={player.form.yellowCards} />
            <DataCell label="Reds" value={player.form.redCards} />
          </DataGrid>
        </div>
      </GlassPanel>

      {/* --- the detail ------------------------------------------------ */}
      <div className="pt-1">
        <Text role="section" as="h2">The detail</Text>
        <Text role="caption" className="mt-0.5 text-ink-dim">Open what you need</Text>
      </div>
      <GlassPanel padding="md">
        <Accordion
          title="Attributes"
          subtitle={data.exact ? 'Fully scouted' : `Ranges — you know ${Math.round(data.confidence * 100)}% of him`}
          defaultOpen
        >
          {Object.entries(ATTRIBUTE_CATEGORIES).map(([title, keys]) => (
            <AttributeGroup
              key={title}
              title={title}
              keys={keys}
              player={player}
              emphasis={data.keyAttrs}
            />
          ))}
        </Accordion>

        <Accordion title="Mentality" subtitle="What he does when it gets hard">
          <div className="flex flex-col gap-2">
            {MENTAL_KEYS.map((key: MentalKey) => (
              <AttributeBar
                key={key}
                label={MENTAL_LABELS[key]}
                value={player.mental[key]}
                emphasis={VOLATILE_MENTAL.includes(key)}
              />
            ))}
          </div>
          <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
            Confidence and morale move week to week. Everything else is close to a constant for his whole career.
          </Text>
        </Accordion>

        <Accordion
          title="Personality and traits"
          subtitle={`${data.traits.length} ${data.traits.length === 1 ? 'trait' : 'traits'}`}
        >
          <Text role="body" as="p" className="text-pretty">{personalityRead(player)}</Text>
          {data.traits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.traits.map((definition) => (
                <TraitChip key={definition.id} trait={definition} size="md" onPress={() => setTrait(definition)} />
              ))}
            </div>
          )}
        </Accordion>

        <Accordion
          title="Contract"
          subtitle={data.contract
            ? `${data.contract.weeksRemaining} weeks left · ${formatMoney(data.contract.wage)} a week`
            : 'No contract'}
        >
          {data.contract ? (
            <>
              <ListRow title="Wage" subtitle="Paid every cycle" trailing={<Text role="stat">{formatMoney(data.contract.wage)}</Text>} />
              <ListRow
                title="Time left"
                subtitle={`Of a ${data.contract.totalWeeks}-week deal`}
                trailing={<Text role="stat">{data.contract.weeksRemaining}w</Text>}
              />
              <ListRow
                title="Squad role"
                subtitle="What you promised him when he signed"
                trailing={<Text role="stat">{SQUAD_ROLE_LABELS[data.contract.role]}</Text>}
              />
              <ListRow
                title="Release clause"
                subtitle="What another club can pay to take him"
                trailing={<Text role="stat">{data.contract.releaseClause ? formatMoney(data.contract.releaseClause) : 'None'}</Text>}
              />
              <ListRow
                divided={false}
                title="Loyalty bonus"
                subtitle="Paid if he sees the deal out"
                trailing={<Text role="stat">{formatMoney(data.contract.loyaltyBonus)}</Text>}
              />
              <div className="mt-3">
                <ProgressBar
                  label="Minutes against what you promised"
                  value={Math.max(0, 50 + rolePromiseDelta(data.contract) * 50)}
                  tone={rolePromiseDelta(data.contract) >= 0 ? 'positive' : 'warning'}
                  marker={50}
                  valueLabel={rolePromiseDelta(data.contract) >= 0 ? 'Promise kept' : 'Promise broken'}
                />
                <Text role="caption" as="p" className="mt-1.5 text-pretty">
                  {rolePromiseDelta(data.contract) >= 0
                    ? 'He is getting the minutes his role promised.'
                    : 'He is playing less than his role promised, and it costs him morale every week.'}
                </Text>
              </div>
              {data.contract.weeksRemaining <= 6 && (
                <div className="mt-3 rounded-md bg-warning/10 p-3">
                  <Text role="bodyStrong" as="p" className="text-warning">This deal is nearly up.</Text>
                  <Text role="caption" as="p" className="mt-1 text-pretty">
                    Renew it or he leaves for nothing. Rival clubs can already talk to him.
                  </Text>
                </div>
              )}
            </>
          ) : (
            <Text role="caption" as="p">No contract on file — he is not signed to a club.</Text>
          )}
        </Accordion>

        <Accordion title="Relationships" subtitle="Club, duties and reach">
          <ListRow title="Club" trailing={<Text role="stat">{data.club?.shortName ?? 'Free agent'}</Text>} />
          {data.slot && (
            <ListRow
              title="Where he starts"
              subtitle={familiarity(player.position, data.slot.position) < 1
                ? `Out of position — only ${Math.round(familiarity(player.position, data.slot.position) * 100)}% comfortable there`
                : 'His natural position'}
              trailing={<Text role="stat">{data.slot.position}</Text>}
            />
          )}
          {data.captain && <ListRow title="Captain" subtitle="Leads the dressing room on matchday" trailing={<Text role="stat">Yes</Text>} />}
          {data.penalties && <ListRow title="Takes penalties" trailing={<Text role="stat">Yes</Text>} />}
          {data.setPieces && <ListRow title="Takes set pieces" trailing={<Text role="stat">Yes</Text>} />}
          {data.creator ? (
            <ListRow
              divided={false}
              leading={<IconSocial size={16} className="text-ink-dim" />}
              title={`@${data.creator.handle}`}
              subtitle={`${Math.round(data.creator.followers / 1000)}k followers · ${data.creator.tier.toLowerCase()} tier`}
              trailing={<Text role="stat">Creator</Text>}
              chevron
              onPress={() => navigate(buildPath(ROUTES.creator, { creatorId: data.creator?.id ?? '' }))}
            />
          ) : (
            <ListRow divided={false} title="Audience" subtitle="He is not a creator — no following of his own" trailing={<Text role="stat">None</Text>} />
          )}
        </Accordion>

        <Accordion
          title="Season by season"
          subtitle={`${player.history.length} completed ${player.history.length === 1 ? 'season' : 'seasons'}`}
        >
          {player.history.length === 0 ? (
            <Text role="caption" as="p" className="text-pretty">
              No completed seasons yet. His record starts filling in at the end of this campaign.
            </Text>
          ) : (
            <div className="flex flex-col">
              {[...player.history].sort((a, b) => b.season - a.season).map((season) => (
                <ListRow
                  key={season.season}
                  divided
                  leading={<Text role="stat" className="w-9 text-ink">S{season.season}</Text>}
                  title={`${season.appearances} games · ${season.goals} goals · ${season.assists} assists`}
                  subtitle={`${season.clubId ? clubById(state, season.clubId)?.shortName ?? 'Another club' : 'No club'} · ${season.motm} player of the match`}
                  trailing={<RatingBadge value={season.averageRating} scale="match" size="sm" />}
                />
              ))}
            </div>
          )}
        </Accordion>
      </GlassPanel>

      <Divider />
      <div className="flex flex-wrap gap-2 pb-2">
        <GlassButton variant="secondary" size="sm" icon={<IconBall size={16} />} onClick={() => navigate(ROUTES.tactics)}>
          Put him in the team
        </GlassButton>
        <GlassButton variant="ghost" size="sm" icon={<IconStar size={16} />} onClick={() => navigate(ROUTES.training)}>
          Set his training
        </GlassButton>
      </div>

      <GlassSheet
        open={trait !== null}
        onClose={() => setTrait(null)}
        title={trait?.name ?? ''}
        subtitle={trait ? `${trait.kind} trait` : undefined}
      >
        {trait && (
          <div className="flex flex-col gap-3">
            <Text role="body" as="p" className="text-pretty">{trait.blurb}</Text>
            <GlassPanel nested level={1} padding="sm">
              {Object.entries(trait.modifiers).map(([key, value], index, all) => (
                <ListRow
                  key={key}
                  divided={index !== all.length - 1}
                  density="compact"
                  title={MODIFIER_LABELS[key] ?? key}
                  trailing={
                    <Text
                      role="stat"
                      className={cn(
                        (key === 'injuryRisk' || key === 'cardRisk' || key === 'staminaDrain' || key === 'wageDemand')
                          ? (value > 0 ? 'text-danger' : 'text-positive')
                          : (value > 0 ? 'text-positive' : 'text-danger'),
                      )}
                    >
                      {value > 0 ? '+' : ''}{Math.round(value * 100)}%
                    </Text>
                  }
                />
              ))}
            </GlassPanel>
            {trait.conditions && trait.conditions.length > 0 && (
              <Text role="caption" as="p" className="text-pretty">
                Only applies {trait.conditions.map((c) => c.replace(/_/g, ' ').toLowerCase()).join(' or ')} — the rest
                of the time it does nothing at all.
              </Text>
            )}
          </div>
        )}
      </GlassSheet>
    </Screen>
  );
}
