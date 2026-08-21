import { useMemo, type ReactNode } from 'react';
import {
  clubById, contractFor, estimatedOverall, keyAttributes, knowledgeConfidence, knowledgeRange,
  potentialRange, rolePromiseDelta,
  ATTRIBUTE_LABELS, POSITION_LABELS, SQUAD_ROLE_LABELS, TRAIT_BY_ID,
  type GameState, type Player, type TraitDefinition,
} from '@cf/engine';
import {
  AttributeBar, DataCell, DataGrid, Divider, GlassButton, GlassPanel, GlassPill, GlassSheet,
  PlayerPortrait, PositionChip, ProgressBar, RatingBadge, Sparkline, Text, Timeline,
  TraitChip, formatMoney, useToast,
  IconBall, IconInjury, IconScout, IconStar,
} from '@/design';
import { playerArc, sentenceCase } from './arc';
import { canOfferRenewal, offerRenewal } from './renewal';

/**
 * The player sheet.
 *
 * Tapping a name in a squad list should not feel like leaving the squad. The
 * sheet is the answer: it slides up over the list, carries the whole of the
 * player's identity and the six things a manager checks first, and hands off to
 * the full profile only if the player actually wants the rest. Nothing
 * reloads, the list stays exactly where it was, and a dismiss is a flick.
 *
 * The scouting contract is the same here as on the profile: an unscouted
 * attribute is drawn as a *range*, never as an invented exact number.
 */

export interface PlayerSheetProps {
  state: GameState;
  player: Player | null;
  open: boolean;
  onClose: () => void;
  onOpenProfile: (playerId: Player['id']) => void;
  onOpenTactics?: () => void;
}

export function PlayerSheet({
  state, player, open, onClose, onOpenProfile, onOpenTactics,
}: PlayerSheetProps): ReactNode {
  return (
    <GlassSheet
      open={open && player !== null}
      onClose={onClose}
      size="tall"
      title={player?.displayName ?? ''}
      subtitle={player
        ? `${POSITION_LABELS[player.position]} · ${player.age} years old${player.shirtNumber !== null ? ` · number ${player.shirtNumber}` : ''}`
        : undefined}
      footer={player ? (
        <div className="flex gap-2">
          <GlassButton variant="primary" block onClick={() => onOpenProfile(player.id)}>
            Open the full profile
          </GlassButton>
          {onOpenTactics && (
            <GlassButton variant="secondary" icon={<IconBall size={16} />} onClick={onOpenTactics}>
              Team
            </GlassButton>
          )}
        </div>
      ) : undefined}
    >
      {player && <SheetBody state={state} player={player} />}
    </GlassSheet>
  );
}

function SheetBody({ state, player }: { state: GameState; player: Player }): ReactNode {
  const toast = useToast();
  const isOwnSquad = player.clubId === state.playerClubId;
  const data = useMemo(() => {
    const club = player.clubId ? clubById(state, player.clubId) : undefined;
    const contract = contractFor(state, player.id);
    const confidence = knowledgeConfidence(player);
    const [low, high] = potentialRange(player);
    const traits = player.traitIds
      .map((id) => TRAIT_BY_ID.get(id))
      .filter((t): t is TraitDefinition => t !== undefined);
    return {
      club,
      contract,
      confidence,
      exact: confidence >= 1,
      estimated: estimatedOverall(player),
      potential: low === high ? `${low}` : `${low}–${high}`,
      traits,
      keys: keyAttributes(player.attributes, player.position, 4),
      arc: playerArc(state, player),
    };
  }, [state, player]);

  const colours = data.club
    ? { primary: data.club.visual.primary, secondary: data.club.visual.secondary }
    : { primary: '#1c2026', secondary: '#262b33' };
  const ratings = player.form.recentRatings;

  return (
    <div className="flex flex-col gap-4 pt-1">
      {/* --- identity --------------------------------------------------- */}
      <div className="flex items-center gap-4">
        <PlayerPortrait seed={player.portraitSeed} size={84} shape="squircle" kit colors={colours} />
        {/* The sheet header above already names him; repeating it here would
            push everything that is actually new below the fold. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PositionChip position={player.position} size="sm" />
            {player.secondaryPositions.map((position) => (
              <PositionChip key={position} position={position} size="xs" />
            ))}
            {data.contract && <GlassPill size="xs">{SQUAD_ROLE_LABELS[data.contract.role]}</GlassPill>}
          </div>
          <Text role="caption" className="mt-1.5 text-ink-dim">
            Worth about {formatMoney(player.marketValue)}
            {data.arc.valueChange !== null && data.arc.valueChange !== 0
              ? `, ${data.arc.valueChange > 0 ? 'up' : 'down'} ${Math.abs(data.arc.valueChange)}% on what you paid`
              : ''}
          </Text>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <RatingBadge
            value={data.exact ? player.overall : data.estimated}
            size="lg"
            label={data.exact ? `Overall ${player.overall}` : `Estimated overall around ${data.estimated}`}
          />
          <Text role="micro">{data.exact ? 'Overall' : 'Estimate'}</Text>
        </div>
      </div>

      {player.injury && (
        <GlassPanel nested level={1} padding="sm" accent="danger">
          <div className="flex items-center gap-2.5">
            <IconInjury size={18} className="shrink-0 text-danger" />
            <Text role="caption" as="p" className="text-ink text-pretty">
              <strong className="font-semibold">{sentenceCase(player.injury.description)}.</strong>{' '}
              He is unavailable for about {player.injury.weeksRemaining} more weeks.
            </Text>
          </div>
        </GlassPanel>
      )}

      {/* --- this season ------------------------------------------------ */}
      <div>
        <Text role="label" className="mb-2 text-ink-dim">This season</Text>
        <DataGrid columns={4}>
          <DataCell label="Games" value={player.form.appearances} />
          <DataCell label="Goals" value={player.form.goals} emphasis={player.form.goals > 0} />
          <DataCell label="Assists" value={player.form.assists} />
          <DataCell label="Minutes" value={player.form.minutes} />
        </DataGrid>
        {ratings.length > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <Sparkline values={ratings} width={150} height={32} tone="volt" fill label="Recent match ratings" />
            <Text role="caption" className="text-ink-dim">
              Last game he was rated {(ratings[ratings.length - 1] ?? 0).toFixed(1)}
            </Text>
          </div>
        )}
      </div>

      {/* --- condition -------------------------------------------------- */}
      <div className="flex flex-col gap-2.5">
        <ProgressBar
          label="Fitness"
          value={player.fitness}
          valueLabel={player.fitness >= 80 ? 'Fresh' : player.fitness >= 55 ? 'Tiring' : 'Needs a rest'}
          tone={player.fitness >= 75 ? 'positive' : player.fitness >= 45 ? 'warning' : 'danger'}
        />
        <ProgressBar
          label="Happiness"
          value={player.mental.morale}
          valueLabel={player.mental.morale >= 65 ? 'Happy' : player.mental.morale >= 40 ? 'Unsettled' : 'Unhappy'}
          tone={player.mental.morale >= 65 ? 'positive' : player.mental.morale >= 40 ? 'warning' : 'danger'}
        />
      </div>

      {/* --- what he is good at ----------------------------------------- */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <Text role="label" className="text-ink-dim">What he is good at</Text>
          {!data.exact && (
            <Text role="caption" className="text-volt">
              {Math.round(data.confidence * 100)}% scouted
            </Text>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {data.keys.map((key) => (
            <AttributeBar
              key={key}
              label={ATTRIBUTE_LABELS[key]}
              value={player.attributes[key]}
              range={knowledgeRange(player, key)}
              emphasis
            />
          ))}
        </div>
        {!data.exact && (
          <div className="mt-2 flex items-start gap-2">
            <IconScout size={15} className="mt-0.5 shrink-0 text-volt" />
            <Text role="caption" className="text-ink-dim text-pretty">
              Nobody has watched him properly yet, so these are ranges rather than exact numbers. Potential {data.potential}.
            </Text>
          </div>
        )}
      </div>

      {data.traits.length > 0 && (
        <div>
          <Text role="label" className="mb-2 text-ink-dim">What makes him different</Text>
          <div className="flex flex-wrap gap-1.5">
            {data.traits.map((trait) => <TraitChip key={trait.id} trait={trait} size="md" />)}
          </div>
        </div>
      )}

      {/* --- contract ---------------------------------------------------- */}
      {data.contract && (
        <div>
          <Text role="label" className="mb-2 text-ink-dim">His deal</Text>
          <DataGrid columns={3}>
            <DataCell label="Wage" value={formatMoney(data.contract.wage)} />
            <DataCell
              label="Left"
              value={`${data.contract.weeksRemaining}w`}
              emphasis={data.contract.weeksRemaining <= 6}
            />
            <DataCell label="Role" value={SQUAD_ROLE_LABELS[data.contract.role]} />
          </DataGrid>
          <Text role="caption" className="mt-2 text-ink-dim text-pretty">
            {data.contract.weeksRemaining <= 6
              ? 'His contract is nearly up. Renew it now or he leaves for nothing.'
              : rolePromiseDelta(data.contract) >= 0
                ? 'He is getting the minutes you promised him when he signed.'
                : 'He is playing less than you promised him, and it is costing morale every week.'}
          </Text>
          {canOfferRenewal(data.contract.weeksRemaining, isOwnSquad) && (
            <div className="mt-2.5">
              <GlassButton
                variant={data.contract.weeksRemaining <= 6 ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  const result = offerRenewal(player.id);
                  if (!result.ok || !result.outcome) {
                    toast.error('No talks', result.reason ?? 'That cannot be offered right now.');
                    return;
                  }
                  const { tone, title, detail } = result.outcome;
                  if (tone === 'success') toast.success(`${title} — ${formatMoney(result.wage ?? 0)} a week`, detail);
                  else if (tone === 'error') toast.error(title, detail);
                  else toast.show({ tone: 'neutral', title, description: detail });
                }}
              >
                Offer him a new deal
              </GlassButton>
            </div>
          )}
        </div>
      )}

      {/* --- his story --------------------------------------------------- */}
      <div>
        <Divider className="mb-3" />
        <div className="mb-2.5 flex items-center gap-2">
          <IconStar size={15} className="text-volt" />
          <Text role="label" className="text-ink-dim">His story so far</Text>
        </div>
        <Timeline
          animate={false}
          items={data.arc.entries.slice(-5).map((entry) => ({
            id: entry.id,
            title: entry.title,
            ...(entry.detail ? { description: entry.detail } : {}),
            time: entry.when,
            tone: entry.tone,
          }))}
        />
      </div>
    </div>
  );
}
