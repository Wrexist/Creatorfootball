import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BASE_CLUBS, CLUB_LORE, PHILOSOPHY_LABELS, playerClub, trackEvent,
  type BadgeMotif, type BadgeShape, type ClubIdentityStyle, type ClubTemplate,
  type ClubVisualIdentity, type FanCulture,
} from '@cf/engine';
import {
  ClubBadge, GlassButton, GlassIcon, GlassInput, GlassPanel, GlassPill, GlassSegmented,
  IconCheck, IconSwap, ProgressBar, SectionHeader, useToast,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { CreationScreen } from './CreationScreen';
import { ChoiceChips, SelectCard, SwatchRow } from './components';
import { KitPreview } from './KitPreview';
import { ClubReveal } from './ClubReveal';
import { BuildingLeague } from './BuildingLeague';
import {
  BADGE_MOTIFS, BADGE_SHAPES, FAN_CULTURES, FAN_CULTURE_HINT, FAN_CULTURE_LABELS,
  IDENTITY_STYLES, KIT_PATTERNS, PHILOSOPHIES, PHILOSOPHY_PLAY, PRIMARY_COLORS,
  SECONDARY_COLORS, philosophyDescription,
} from './clubIdentity';
import {
  clubBlocker, toClubChoice, toManagerChoice, useCreationStore,
} from './creationStore';

/**
 * Minute 1-3: the club.
 *
 * The badge at the top is the real `ClubBadge` component fed the real
 * `ClubVisualIdentity` the engine will store, so what the player is looking at
 * while they choose is the artefact itself and not an impression of it. Every
 * control below it writes straight into that object.
 *
 * The alternative path — taking over one of the twelve existing clubs — is
 * given equal billing rather than hidden behind a link. Plenty of players want
 * a history and a rivalry rather than a blank crest, and making them build a
 * club they will not care about is a bad first three minutes.
 */

const templateVisual = (t: ClubTemplate): ClubVisualIdentity => ({
  primary: t.visual.primary,
  secondary: t.visual.secondary,
  accent: t.visual.accent,
  badgeShape: t.visual.badgeShape as BadgeShape,
  badgeMotif: t.visual.badgeMotif as BadgeMotif,
  style: t.visual.style as ClubIdentityStyle,
  kitPattern: t.visual.kitPattern as ClubVisualIdentity['kitPattern'],
});

const clubName = (id: string): string =>
  BASE_CLUBS.find((c) => c.id === id)?.shortName ?? id;

/** How long the "building the league" beat is held before the reveal. */
const BUILD_BEAT_MS = 1500;

type Stage = 'FORM' | 'BUILDING' | 'REVEAL';

export function ClubCreationScreen(): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const state = useCreationStore();
  const startNewGame = useGameStore((s) => s.startNewGame);
  const gameState = useGameStore((s) => s.state);
  const [stage, setStage] = useState<Stage>('FORM');
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const blocker = clubBlocker(state);
  const custom = state.clubMode === 'CUSTOM';

  const takeover = useMemo(
    () => BASE_CLUBS.find((c) => c.id === state.takeoverClubId),
    [state.takeoverClubId],
  );

  const previewVisual = custom ? state.visual : takeover ? templateVisual(takeover) : state.visual;
  const previewName = custom ? state.clubName || 'Your club' : takeover?.name ?? 'Your club';

  const createdClub = gameState ? playerClub(gameState) : null;

  const create = async (): Promise<void> => {
    setStage('BUILDING');
    const manager = toManagerChoice(state);
    const club = toClubChoice(state);

    trackEvent('manager_created', {
      mode: manager.kind,
      archetype: manager.kind === 'CUSTOM' ? manager.archetypeId : manager.templateId,
    });
    trackEvent('club_created', {
      mode: club.kind,
      philosophy: club.kind === 'CUSTOM' ? club.philosophy : club.templateId,
      fanCulture: club.kind === 'CUSTOM' ? club.fanCulture : undefined,
    });

    // The engine really is building twelve squads and a fixture list here. The
    // floor exists so the beat cannot flash past on a fast device, not to fake
    // work that is not happening.
    await Promise.all([
      startNewGame({ manager, club }),
      new Promise((resolve) => setTimeout(resolve, BUILD_BEAT_MS)),
    ]);

    if (useGameStore.getState().phase === 'READY') {
      setStage('REVEAL');
      return;
    }
    setStage('FORM');
    toast.error(
      'Your club could not be created',
      useGameStore.getState().error ?? 'Nothing has been saved. Try again.',
    );
  };

  if (stage === 'REVEAL' && createdClub) {
    return (
      <ClubReveal
        club={createdClub}
        open
        onContinue={() => navigate(ROUTES.squadBuilder, { replace: true })}
      />
    );
  }

  if (stage === 'BUILDING') {
    return <BuildingLeague clubName={previewName} visual={previewVisual} />;
  }

  return (
    <CreationScreen
      step="club"
      title="Your club"
      subtitle="Everything here is visible from the first whistle."
      onBack={() => navigate(ROUTES.managerCreation)}
      footer={
        <GlassButton
          variant="primary"
          size="lg"
          block
          disabled={blocker !== null}
          onClick={() => void create()}
        >
          {blocker ?? (custom ? `Found ${state.shortName || 'the club'}` : `Take over ${takeover?.shortName ?? ''}`)}
        </GlassButton>
      }
    >
      <div ref={headingRef} tabIndex={-1} aria-label="Step 2 of 3, club" className="outline-none" />

      {/* The only non-nested glass on this screen: the crest is the subject. */}
      <GlassPanel level={2} radius="xl" padding="md" sheen>
        <div className="flex items-center gap-4">
          <ClubBadge visual={previewVisual} size={92} label={`${previewName} badge`} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[22px] font-bold tracking-[-0.03em] text-ink">
              {previewName}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-ink-muted">
              {custom
                ? [state.city || 'City', state.abbreviation || '—'].join(' · ')
                : `${takeover?.city ?? ''} · ${takeover?.abbreviation ?? ''}`}
            </p>
          </div>
          <KitPreview visual={previewVisual} size={58} label={`${previewName} kit`} />
        </div>
      </GlassPanel>

      <GlassSegmented
        aria-label="How to get a club"
        options={[
          { value: 'CUSTOM', label: 'Create a club' },
          { value: 'TAKEOVER', label: 'Take one over' },
        ]}
        value={state.clubMode}
        onChange={(mode) => state.setClubMode(mode as 'CUSTOM' | 'TAKEOVER')}
        block
      />

      {custom ? (
        <>
          <GlassPanel level={1} radius="lg" padding="md" nested>
            <SectionHeader title="Name" size="sm" />
            <div className="mt-3 flex flex-col gap-3">
              <GlassInput
                label="Club name"
                nested
                value={state.clubName}
                onChange={(e) => state.setClubName(e.target.value)}
                placeholder="e.g. Harrowfield Rovers"
                maxLength={30}
              />
              <GlassInput
                label="City"
                nested
                value={state.city}
                onChange={(e) => state.setCity(e.target.value)}
                placeholder="e.g. Harrowfield"
                maxLength={24}
              />
              <div className="grid grid-cols-2 gap-3">
                <GlassInput
                  label="Short name"
                  nested
                  value={state.shortName}
                  onChange={(e) => state.setShortName(e.target.value)}
                  hint="Used in tables"
                  maxLength={16}
                />
                <GlassInput
                  label="Three letters"
                  nested
                  value={state.abbreviation}
                  onChange={(e) => state.setAbbreviation(e.target.value)}
                  hint="Used on the scoreboard"
                  maxLength={4}
                />
              </div>
            </div>
          </GlassPanel>

          <GlassPanel level={1} radius="lg" padding="md" nested>
            <div className="flex items-start justify-between gap-3">
              <SectionHeader title="Badge and kit" size="sm" />
              <GlassIcon
                label="Shuffle badge and kit"
                icon={<IconSwap />}
                size="sm"
                nested
                onClick={() => state.randomiseVisual(Date.now())}
              />
            </div>
            <div className="mt-3 flex flex-col gap-5">
              <SwatchRow
                legend="Primary"
                colors={PRIMARY_COLORS}
                value={state.visual.primary}
                onChange={(primary) => state.setVisual({ primary })}
                contrastAgainst={state.visual.secondary}
              />
              <SwatchRow
                legend="Secondary"
                colors={SECONDARY_COLORS}
                value={state.visual.secondary}
                onChange={(secondary) => state.setVisual({ secondary })}
                contrastAgainst={state.visual.primary}
              />
              <ChoiceChips
                legend="Badge shape"
                options={BADGE_SHAPES.map((o) => ({ value: o.value, label: o.label }))}
                value={state.visual.badgeShape}
                onChange={(badgeShape) => state.setVisual({ badgeShape })}
              />
              <ChoiceChips
                legend="Emblem"
                options={BADGE_MOTIFS.map((o) => ({ value: o.value, label: o.label }))}
                value={state.visual.badgeMotif}
                onChange={(badgeMotif) => state.setVisual({ badgeMotif })}
              />
              <ChoiceChips
                legend="Kit"
                options={KIT_PATTERNS.map((o) => ({ value: o.value, label: o.label }))}
                value={state.visual.kitPattern}
                onChange={(kitPattern) => state.setVisual({ kitPattern })}
              />
              <ChoiceChips
                legend="Look"
                options={IDENTITY_STYLES.map((o) => ({ value: o.value, label: o.label }))}
                value={state.visual.style}
                onChange={(style) => state.setVisual({ style })}
              />
            </div>
          </GlassPanel>

          <div>
            <SectionHeader
              title="How you play"
              subtitle="This sets your starting shape and how the club behaves when you are not looking."
            />
            <div className="mt-3 flex flex-col gap-2.5">
              {PHILOSOPHIES.map((philosophy) => (
                <SelectCard
                  key={philosophy}
                  label={PHILOSOPHY_LABELS[philosophy]}
                  selected={state.philosophy === philosophy}
                  onSelect={() => state.setPhilosophy(philosophy)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
                      {PHILOSOPHY_LABELS[philosophy]}
                    </p>
                    {state.philosophy === philosophy && (
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-volt text-volt-ink [&_svg]:size-3.5"
                      >
                        <IconCheck />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
                    {philosophyDescription(philosophy)}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim text-pretty">
                    {PHILOSOPHY_PLAY[philosophy]}
                  </p>
                </SelectCard>
              ))}
            </div>
          </div>

          <GlassPanel level={1} radius="lg" padding="md" nested>
            <SectionHeader title="Who follows you" size="sm" />
            <div className="mt-3">
              <ChoiceChips
                legend="Fan culture"
                options={FAN_CULTURES.map((c) => ({ value: c, label: FAN_CULTURE_LABELS[c] }))}
                value={state.fanCulture}
                onChange={(fanCulture) => state.setFanCulture(fanCulture as FanCulture)}
                hint={FAN_CULTURE_HINT[state.fanCulture]}
              />
            </div>
            <div className="mt-5 flex items-end gap-2">
              <GlassInput
                label="Motto"
                nested
                className="flex-1"
                value={state.motto}
                onChange={(e) => state.setMotto(e.target.value)}
                placeholder="Ours to build."
                maxLength={40}
              />
              <GlassButton
                variant="ghost"
                size="md"
                onClick={() => state.suggestMotto(Date.now())}
              >
                Suggest
              </GlassButton>
            </div>
          </GlassPanel>
        </>
      ) : (
        <div>
          <SectionHeader
            title="Twelve clubs, all of them taken"
            subtitle="Inherit a squad, a history and someone who already hates you."
          />
          <div className="mt-3 flex flex-col gap-2.5">
            {BASE_CLUBS.map((club) => {
              const selected = state.takeoverClubId === club.id;
              return (
                <SelectCard
                  key={club.id}
                  label={`${club.name} of ${club.city}`}
                  selected={selected}
                  onSelect={() => state.chooseTakeover(club.id)}
                  accent={club.visual.secondary}
                >
                  <div className="flex gap-3.5 pl-2">
                    <ClubBadge visual={templateVisual(club)} size={54} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
                            {club.name}
                          </p>
                          <p className="text-[12px] text-ink-dim">
                            {club.city} · founded {club.founded} · {PHILOSOPHY_LABELS[
                              club.philosophy as keyof typeof PHILOSOPHY_LABELS
                            ] ?? club.philosophy}
                          </p>
                        </div>
                        {selected && (
                          <span
                            aria-hidden="true"
                            className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-volt text-volt-ink [&_svg]:size-3.5"
                          >
                            <IconCheck />
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <ProgressBar
                          label="Squad strength"
                          value={club.strength}
                          valueLabel={String(club.strength)}
                          size="xs"
                          tone={club.strength >= 78 ? 'positive' : club.strength >= 66 ? 'volt' : 'danger'}
                        />
                        <ProgressBar
                          label="Reputation"
                          value={club.reputation}
                          valueLabel={String(club.reputation)}
                          size="xs"
                          tone="neutral"
                        />
                      </div>

                      {selected && (
                        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted text-pretty">
                          {CLUB_LORE[club.id]}
                        </p>
                      )}

                      {(club.rivalOf?.length ?? 0) > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                            Rivals
                          </span>
                          {club.rivalOf?.map((id) => (
                            <GlassPill key={id} tone="danger" size="xs">
                              {clubName(id)}
                            </GlassPill>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </SelectCard>
              );
            })}
          </div>
        </div>
      )}
    </CreationScreen>
  );
}
