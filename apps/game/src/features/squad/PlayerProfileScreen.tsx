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
  Accordion, AttributeBar, ClubBadge, Divider, EmptyState, GlassButton, GlassPanel, GlassPill,
  GlassSheet, KeyValueRow, PlayerPortrait, PositionChip, ProgressBar, RatingBadge, Screen,
  SectionHeader, Sparkline, StatCard, StatGrid, TraitChip, cn, formatMoney, rgba,
  IconBall, IconCard, IconInjury, IconScout, IconSocial, IconStar, IconWarning,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';

/**
 * Player profile.
 *
 * The single most important rule on this screen: **it never lies about what you
 * know.** Attributes are drawn through the engine's `knowledgeRange`, so an
 * unscouted player shows a band and a scouted one shows a number, and the band
 * visibly narrows as scouting confidence rises. A precise-looking 74 on a
 * player nobody has watched would be a fabrication, and it would quietly make
 * scouting — an entire game system — pointless.
 *
 * Everything below the header is progressively disclosed. A profile that opens
 * with seven expanded sections is a spreadsheet; this one opens with the two
 * things a manager checks first and lets the rest be asked for.
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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">{title}</p>
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
          description="That player is not in this save any more — they may have been sold, released or retired."
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
      manager: state.managers[state.playerManagerId],
      captain: ownClub?.tactics.captainId === player.id,
      penalties: ownClub?.tactics.penaltyTakerId === player.id,
      setPieces: ownClub?.tactics.setPieceTakerId === player.id,
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

  return (
    <Screen
      title={player.displayName}
      subtitle={`${POSITION_LABELS[player.position]} · ${player.age} · ${data.club?.name ?? 'Free agent'}`}
      onBack={() => navigate(-1)}
      hero={
        <div className="relative overflow-hidden">
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `linear-gradient(168deg, ${rgba(wash, 0.55)} 0%, ${rgba(wash, 0.12)} 52%, transparent 88%)`,
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
              <div className="flex flex-wrap items-center gap-1.5">
                <PositionChip position={player.position} size="md" />
                {player.secondaryPositions.map((position) => (
                  <PositionChip key={position} position={position} size="xs" />
                ))}
                {player.shirtNumber !== null && (
                  <GlassPill size="xs">#{player.shirtNumber}</GlassPill>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <RatingBadge
                  value={data.exact ? player.overall : data.estimated}
                  size="lg"
                  label={data.exact ? `Overall ${player.overall}` : `Estimated overall, around ${data.estimated}`}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {data.exact ? 'Overall' : 'Estimated'}
                  </p>
                  <p className="tnum text-[12px] text-ink-muted">
                    Potential {data.potentialLow === data.potentialHigh
                      ? data.potentialLow
                      : `${data.potentialLow}–${data.potentialHigh}`}
                  </p>
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
            <KeyValueRow label="Market value" value={formatMoney(player.marketValue)} />
            <KeyValueRow label="Reputation" value={Math.round(player.reputation)} />
            <KeyValueRow label="Nationality" value={player.nationality} />
            <KeyValueRow label="Height" value={`${Math.round(player.height)}cm`} />
            <KeyValueRow label="Foot" value={player.footedness} divided={false} />
          </GlassPanel>
          {data.traits.length > 0 && (
            <GlassPanel title="Traits" padding="md">
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
            <p className="text-[13px] text-ink text-pretty">
              <strong className="font-semibold">{player.injury.description}.</strong>{' '}
              {player.injury.weeksRemaining} cycles remaining.
            </p>
          </div>
        </GlassPanel>
      )}
      {player.suspensionMatches > 0 && (
        <GlassPanel padding="sm" accent="danger">
          <div className="flex items-center gap-2.5">
            <IconCard size={18} className="shrink-0 text-warning" />
            <p className="text-[13px] text-ink">Suspended for {player.suspensionMatches} match{player.suspensionMatches === 1 ? '' : 'es'}.</p>
          </div>
        </GlassPanel>
      )}

      {/* --- scouting confidence -------------------------------------- */}
      {!data.exact && (
        <GlassPanel padding="md" accent="volt">
          <div className="flex items-start gap-3">
            <IconScout size={20} className="mt-0.5 shrink-0 text-volt" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">Scouting incomplete</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted text-pretty">
                Attributes below are shown as the range your scouts can actually justify, not as invented precision. Send a
                scout and the bands narrow — that is what good scouting buys you.
              </p>
              <div className="mt-3">
                <ProgressBar
                  value={data.confidence * 100}
                  tone="volt"
                  label="Report confidence"
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

      <StatGrid columns={2}>
        <StatCard label="Fitness" value={Math.round(player.fitness)} suffix="%" tone={player.fitness >= 70 ? 'positive' : 'warning'} footnote="Match-to-match freshness" />
        <StatCard
          label="Form"
          value={Number((player.form.rating * 10).toFixed(1))}
          decimals={1}
          tone={player.form.rating >= 0 ? 'positive' : 'danger'}
          {...(ratings.length > 1 ? { history: ratings } : {})}
          footnote={ratings.length ? `Last ${ratings.length} appearances` : 'No appearances yet'}
        />
      </StatGrid>

      {/* --- sections -------------------------------------------------- */}
      <SectionHeader title="Profile" subtitle="Open what you need" />
      <GlassPanel padding="md">
        <Accordion title="Performance" subtitle="This season" defaultOpen>
          <StatGrid columns={4} gap="sm">
            <StatCard nested level={1} size="sm" label="Apps" value={player.form.appearances} />
            <StatCard nested level={1} size="sm" label="Goals" value={player.form.goals} />
            <StatCard nested level={1} size="sm" label="Assists" value={player.form.assists} />
            <StatCard nested level={1} size="sm" label="Minutes" value={player.form.minutes} />
          </StatGrid>
          <div className="mt-3">
            <KeyValueRow label="Clean sheets" value={player.form.cleanSheets} />
            <KeyValueRow label="Yellow cards" value={player.form.yellowCards} />
            <KeyValueRow label="Red cards" value={player.form.redCards} divided={false} />
          </div>
          {ratings.length > 1 && (
            <div className="mt-3 flex items-center gap-3">
              <Sparkline values={ratings} width={160} height={36} tone="volt" fill label="Recent match ratings" />
              <span className="tnum text-[12px] text-ink-muted">
                Last rating {(ratings[ratings.length - 1] ?? 0).toFixed(1)}
              </span>
            </div>
          )}
        </Accordion>

        <Accordion
          title="Attributes"
          subtitle={data.exact ? 'Fully scouted' : `Ranges — ${Math.round(data.confidence * 100)}% confidence`}
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

        <Accordion title="Mental" subtitle="What he does when it gets hard">
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
          <p className="mt-3 text-[12px] leading-relaxed text-ink-dim text-pretty">
            Confidence and morale move week to week; everything else is close to a constant for this player's career.
          </p>
        </Accordion>

        <Accordion title="Personality" subtitle={`${data.traits.length} trait${data.traits.length === 1 ? '' : 's'}`}>
          <p className="text-[13px] leading-relaxed text-ink text-pretty">{personalityRead(player)}</p>
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
          subtitle={data.contract ? `${data.contract.weeksRemaining} cycles · ${formatMoney(data.contract.wage)}/cycle` : 'No contract'}
        >
          {data.contract ? (
            <>
              <KeyValueRow label="Wage" value={`${formatMoney(data.contract.wage)}/cycle`} emphasis />
              <KeyValueRow label="Remaining" value={`${data.contract.weeksRemaining} of ${data.contract.totalWeeks} cycles`} />
              <KeyValueRow label="Squad role" value={SQUAD_ROLE_LABELS[data.contract.role]} hint="What you promised him" />
              <KeyValueRow label="Release clause" value={data.contract.releaseClause ? formatMoney(data.contract.releaseClause) : 'None'} />
              <KeyValueRow label="Loyalty bonus" value={formatMoney(data.contract.loyaltyBonus)} />
              <KeyValueRow label="Signing bonus" value={formatMoney(data.contract.signingBonus)} divided={false} />
              <div className="mt-3">
                <ProgressBar
                  label="Minutes against the promise"
                  value={Math.max(0, 50 + rolePromiseDelta(data.contract) * 50)}
                  tone={rolePromiseDelta(data.contract) >= 0 ? 'positive' : 'warning'}
                  marker={50}
                  valueLabel={rolePromiseDelta(data.contract) >= 0 ? 'Kept' : 'Broken'}
                />
                <p className="mt-1.5 text-[12px] text-ink-muted text-pretty">
                  {rolePromiseDelta(data.contract) >= 0
                    ? 'He is getting the minutes his role promised.'
                    : 'He is playing less than his role promised, and it is costing morale every cycle.'}
                </p>
              </div>
              {data.contract.weeksRemaining <= 6 && (
                <div className="mt-3 rounded-md bg-warning/10 p-3">
                  <p className="text-[13px] font-semibold text-warning">This deal is running down.</p>
                  <p className="mt-1 text-[12px] text-ink-muted text-pretty">
                    Renew it or he leaves for nothing. Rival clubs can already talk to him.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">No contract on file — this player is not signed to a club.</p>
          )}
        </Accordion>

        <Accordion title="Relationships" subtitle="Club, duties and reach">
          <KeyValueRow label="Club" value={data.club?.name ?? 'Free agent'} />
          {data.slot && (
            <KeyValueRow
              label="Starting slot"
              value={data.slot.position}
              hint={familiarity(player.position, data.slot.position) < 1
                ? `Out of position — ${Math.round(familiarity(player.position, data.slot.position) * 100)}% familiarity`
                : 'Natural position'}
            />
          )}
          {data.captain && <KeyValueRow label="Captain" value="Yes" hint="Leads the dressing room on matchday" />}
          {data.penalties && <KeyValueRow label="Penalties" value="Yes" />}
          {data.setPieces && <KeyValueRow label="Set pieces" value="Yes" />}
          {data.creator ? (
            <KeyValueRow
              label="Creator"
              value={`@${data.creator.handle}`}
              hint={`${Math.round(data.creator.followers / 1000)}k followers · ${data.creator.tier.toLowerCase()}`}
              icon={<IconSocial size={16} />}
              onPress={() => navigate(buildPath(ROUTES.creator, { creatorId: data.creator?.id ?? '' }))}
            />
          ) : (
            <KeyValueRow label="Creator" value="Not a creator" hint="No audience of his own" divided={false} />
          )}
        </Accordion>

        <Accordion title="History" subtitle={`${player.history.length} previous season${player.history.length === 1 ? '' : 's'}`}>
          {player.history.length === 0 ? (
            <p className="text-[13px] text-ink-muted text-pretty">
              No completed seasons yet. His record starts filling in at the end of this campaign.
            </p>
          ) : (
            <div className="flex flex-col">
              {[...player.history].sort((a, b) => b.season - a.season).map((season) => (
                <div key={season.season} className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0">
                  <span className="tnum w-10 shrink-0 font-display text-[16px] font-bold text-ink">S{season.season}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink">
                      {season.appearances} apps · {season.goals}g {season.assists}a
                    </span>
                    <span className="block text-[11px] text-ink-dim">
                      {season.clubId ? clubById(state, season.clubId)?.shortName ?? 'Unknown club' : 'No club'} ·{' '}
                      {season.motm} player of the match
                    </span>
                  </span>
                  <RatingBadge value={season.averageRating} scale="match" size="sm" />
                </div>
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
          Set his training focus
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
            <p className="text-[14px] leading-relaxed text-ink text-pretty">{trait.blurb}</p>
            <GlassPanel nested level={1} padding="sm">
              {Object.entries(trait.modifiers).map(([key, value], index, all) => (
                <KeyValueRow
                  key={key}
                  label={MODIFIER_LABELS[key] ?? key}
                  value={
                    <span className={cn(
                      (key === 'injuryRisk' || key === 'cardRisk' || key === 'staminaDrain' || key === 'wageDemand')
                        ? (value > 0 ? 'text-danger' : 'text-positive')
                        : (value > 0 ? 'text-positive' : 'text-danger'),
                    )}>
                      {value > 0 ? '+' : ''}{Math.round(value * 100)}%
                    </span>
                  }
                  divided={index !== all.length - 1}
                />
              ))}
            </GlassPanel>
            {trait.conditions && trait.conditions.length > 0 && (
              <p className="text-[12px] text-ink-muted text-pretty">
                Only applies {trait.conditions.map((c) => c.replace(/_/g, ' ').toLowerCase()).join(' or ')} — the rest of
                the time it does nothing at all.
              </p>
            )}
          </div>
        )}
      </GlassSheet>
    </Screen>
  );
}
