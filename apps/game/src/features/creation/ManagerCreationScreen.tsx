import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MANAGER_ARCHETYPES, MANAGER_ATTRIBUTE_LABELS, PREMADE_MANAGERS,
  type ManagerArchetype, type ManagerAttributeKey,
} from '@cf/engine';
import {
  GlassButton, GlassIcon, GlassInput, GlassPanel, GlassSegmented, IconCheck, IconSwap, IconX,
  PlayerPortrait, SectionHeader, cn,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { CreationScreen } from './CreationScreen';
import { ChoiceChips, SelectCard, SwatchRow } from './components';
import {
  ACCENT_COLORS, ACCESSORIES, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLES,
  MEDIA_STYLES, MEDIA_STYLE_HINT, OUTFITS, SKIN_TONES,
  SOCIAL_PERSONALITIES, SOCIAL_PERSONALITY_HINT,
} from './appearance';
import { managerBlocker, useCreationStore } from './creationStore';
import { managerPortraitSeed } from './portraitSeed';

/**
 * Minute 0-1: identity.
 *
 * The first minute has one job — make the player feel like a person in this
 * world rather than a save slot — so the portrait is the first thing on screen
 * and it responds to every choice immediately. The archetype list below it is
 * the first real decision the game asks for, and it is presented as a trade:
 * every card states what the archetype is good at *and* what it costs, in the
 * same weight of type, because a list of upsides is not a choice.
 */

const skinHex = (tone: number): string =>
  SKIN_TONES.find((s) => s.tone === tone)?.hex ?? '#d9a77c';

/** The two biggest gains and the two biggest costs, in the engine's own numbers. */
function modifierSummary(archetype: ManagerArchetype): {
  gains: readonly [string, number][];
  costs: readonly [string, number][];
} {
  const entries = Object.entries(archetype.modifiers) as [ManagerAttributeKey, number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  return {
    gains: sorted.filter(([, v]) => v > 0).slice(0, 2).map(([k, v]) => [MANAGER_ATTRIBUTE_LABELS[k], v]),
    costs: sorted.filter(([, v]) => v < 0).slice(-2).map(([k, v]) => [MANAGER_ATTRIBUTE_LABELS[k], v]),
  };
}

function ModifierRow({ archetype }: { archetype: ManagerArchetype }): ReactNode {
  const { gains, costs } = modifierSummary(archetype);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {gains.map(([label, value]) => (
        <span
          key={label}
          className="tnum rounded-pill bg-positive/12 px-2 py-1 text-[11.5px] font-semibold text-positive"
        >
          +{value} {label}
        </span>
      ))}
      {costs.map(([label, value]) => (
        <span
          key={label}
          className="tnum rounded-pill bg-danger/12 px-2 py-1 text-[11.5px] font-semibold text-danger"
        >
          {value} {label}
        </span>
      ))}
    </div>
  );
}

function TradeLine({ tone, children }: { tone: 'good' | 'bad'; children: ReactNode }): ReactNode {
  return (
    <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-ink-muted text-pretty">
      <span
        aria-hidden="true"
        className={cn(
          'mt-px flex size-4 shrink-0 items-center justify-center rounded-pill [&_svg]:size-3',
          tone === 'good' ? 'bg-positive/15 text-positive' : 'bg-danger/15 text-danger',
        )}
      >
        {tone === 'good' ? <IconCheck /> : <IconX />}
      </span>
      <span>{children}</span>
    </p>
  );
}

export function ManagerCreationScreen(): ReactNode {
  const navigate = useNavigate();
  const state = useCreationStore();
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const blocker = managerBlocker(state);

  const portraitSeed = useMemo(
    () => managerPortraitSeed(state.appearance),
    [state.appearance],
  );

  const premadeSeeds = useMemo(
    () => new Map(PREMADE_MANAGERS.map((m) => [m.id, managerPortraitSeed({
      skinTone: Number(m.appearance?.skinTone ?? 3),
      hairStyle: String(m.appearance?.hairStyle ?? 'short'),
      hairColor: String(m.appearance?.hairColor ?? 'dark'),
      facialHair: String(m.appearance?.facialHair ?? 'none'),
      outfit: String(m.appearance?.outfit ?? 'suit'),
      accessory: String(m.appearance?.accessory ?? 'none'),
      accentColor: String(m.appearance?.accentColor ?? '#C8FF2E'),
    })])),
    [],
  );

  const custom = state.managerMode === 'CUSTOM';

  return (
    <CreationScreen
      step="manager"
      title="Who are you?"
      subtitle="The one part of this game that is entirely yours."
      onBack={() => navigate(ROUTES.onboarding)}
      footer={
        <GlassButton
          variant="primary"
          size="lg"
          block
          disabled={blocker !== null}
          onClick={() => navigate(ROUTES.clubCreation)}
        >
          {blocker ?? 'Next: your club'}
        </GlassButton>
      }
    >
      <div ref={headingRef} tabIndex={-1} aria-label="Step 1 of 3, manager" className="outline-none" />

      <GlassSegmented
        aria-label="How to create your manager"
        options={[
          { value: 'CUSTOM', label: 'Build your own' },
          { value: 'PREMADE', label: 'Pick one' },
        ]}
        value={state.managerMode}
        onChange={(mode) => state.setManagerMode(mode as 'CUSTOM' | 'PREMADE')}
        block
      />

      {custom ? (
        <>
          {/* The one non-nested glass surface on this screen: the identity block
              is the subject, and everything below it is a control panel. */}
          <GlassPanel level={2} radius="xl" padding="md" sheen>
            <div className="flex items-center gap-4">
              <PlayerPortrait
                seed={portraitSeed}
                size={96}
                shape="squircle"
                colors={{ primary: state.appearance.accentColor }}
                ring={state.appearance.accentColor}
                label="Your manager portrait"
              />
              <div className="min-w-0 flex-1">
                <GlassInput
                  label="Your name"
                  nested
                  value={state.managerName}
                  onChange={(e) => state.setManagerName(e.target.value)}
                  placeholder="e.g. Noor Latimer"
                  autoComplete="name"
                  maxLength={28}
                  enterKeyHint="next"
                />
                <div className="mt-2 flex items-center gap-2">
                  <GlassIcon
                    label="Randomise appearance"
                    icon={<IconSwap />}
                    size="sm"
                    nested
                    onClick={() => state.randomiseAppearance(Date.now())}
                  />
                  <span className="text-[12px] text-ink-dim">Shuffle the look</span>
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel level={1} radius="lg" padding="md" nested>
            <SectionHeader title="Appearance" size="sm" />
            <div className="mt-3 flex flex-col gap-5">
              <SwatchRow
                legend="Skin tone"
                colors={SKIN_TONES.map((s) => ({ hex: s.hex, label: s.label }))}
                value={skinHex(state.appearance.skinTone)}
                onChange={(hex) =>
                  state.setAppearance({
                    skinTone: SKIN_TONES.find((s) => s.hex === hex)?.tone ?? 3,
                  })
                }
              />
              <ChoiceChips
                legend="Hair"
                options={HAIR_STYLES.map((h) => ({ value: h.value, label: h.label }))}
                value={state.appearance.hairStyle}
                onChange={(hairStyle) => state.setAppearance({ hairStyle })}
              />
              <SwatchRow
                legend="Hair colour"
                colors={HAIR_COLORS}
                value={state.appearance.hairColor}
                onChange={(hairColor) => state.setAppearance({ hairColor })}
              />
              <ChoiceChips
                legend="Facial hair"
                options={FACIAL_HAIR.map((f) => ({ value: f.value, label: f.label }))}
                value={state.appearance.facialHair}
                onChange={(facialHair) => state.setAppearance({ facialHair })}
              />
              <SwatchRow
                legend="Your colour"
                colors={ACCENT_COLORS}
                value={state.appearance.accentColor}
                onChange={(accentColor) => state.setAppearance({ accentColor })}
              />
              <ChoiceChips
                legend="Touchline outfit"
                options={OUTFITS.map((o) => ({ value: o.value, label: o.label }))}
                value={state.appearance.outfit}
                onChange={(outfit) => state.setAppearance({ outfit })}
                hint="Outfit and what you carry show up in media coverage, not in this portrait."
              />
              <ChoiceChips
                legend="Always carrying"
                options={ACCESSORIES.map((a) => ({ value: a.value, label: a.label }))}
                value={state.appearance.accessory}
                onChange={(accessory) => state.setAppearance({ accessory })}
              />
            </div>
          </GlassPanel>

          <div>
            <SectionHeader
              title="Archetype"
              subtitle="Every one of these gives up something real. There is no best pick."
            />
            <div className="mt-3 flex flex-col gap-2.5">
              {MANAGER_ARCHETYPES.map((archetype) => (
                <SelectCard
                  key={archetype.id}
                  label={`${archetype.name}. ${archetype.strength} ${archetype.weakness}`}
                  selected={state.archetypeId === archetype.id}
                  onSelect={() => state.setArchetype(archetype.id)}
                  accent={archetype.accent}
                >
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="min-w-0">
                      <p className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
                        {archetype.name}
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium text-ink-dim">{archetype.tagline}</p>
                    </div>
                    {state.archetypeId === archetype.id && (
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-volt text-volt-ink [&_svg]:size-3.5"
                      >
                        <IconCheck />
                      </span>
                    )}
                  </div>
                  <div className="pl-2">
                    <TradeLine tone="good">{archetype.strength}</TradeLine>
                    <TradeLine tone="bad">{archetype.weakness}</TradeLine>
                    <ModifierRow archetype={archetype} />
                  </div>
                </SelectCard>
              ))}
            </div>
          </div>

          <GlassPanel level={1} radius="lg" padding="md" nested>
            <SectionHeader title="Personality" size="sm" />
            <div className="mt-3 flex flex-col gap-5">
              <ChoiceChips
                legend="In front of a camera"
                options={MEDIA_STYLES.map((o) => ({ value: o.value, label: o.label }))}
                value={state.mediaStyle}
                onChange={state.setMediaStyle}
                hint={MEDIA_STYLE_HINT[state.mediaStyle]}
              />
              <ChoiceChips
                legend="Online"
                options={SOCIAL_PERSONALITIES.map((o) => ({ value: o.value, label: o.label }))}
                value={state.socialPersonality}
                onChange={state.setSocialPersonality}
                hint={SOCIAL_PERSONALITY_HINT[state.socialPersonality]}
              />
            </div>
          </GlassPanel>
        </>
      ) : (
        <div>
          <SectionHeader
            title="Ten managers, ready to go"
            subtitle="Same archetypes, already built. You can still change everything later."
          />
          <div className="mt-3 flex flex-col gap-2.5">
            {PREMADE_MANAGERS.map((manager) => {
              const archetype = MANAGER_ARCHETYPES.find((a) => a.id === manager.archetypeId);
              return (
                <SelectCard
                  key={manager.id}
                  label={`${manager.name}, ${archetype?.name ?? 'manager'}`}
                  selected={state.premadeManagerId === manager.id}
                  onSelect={() => state.choosePremade(manager.id)}
                  accent={archetype?.accent ?? '#C8FF2E'}
                >
                  <div className="flex gap-3.5 pl-2">
                    <PlayerPortrait
                      seed={premadeSeeds.get(manager.id) ?? manager.id}
                      size={56}
                      shape="squircle"
                      colors={{ primary: String(manager.appearance?.accentColor ?? '#1c2026') }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
                          {manager.name}
                        </p>
                        {state.premadeManagerId === manager.id && (
                          <span
                            aria-hidden="true"
                            className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-volt text-volt-ink [&_svg]:size-3.5"
                          >
                            <IconCheck />
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: archetype?.accent }}>
                        {archetype?.name}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted text-pretty">
                        {manager.bio}
                      </p>
                      {archetype && (
                        <>
                          <TradeLine tone="good">{archetype.strength}</TradeLine>
                          <TradeLine tone="bad">{archetype.weakness}</TradeLine>
                        </>
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
