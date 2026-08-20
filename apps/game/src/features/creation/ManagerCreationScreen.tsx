import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MANAGER_ARCHETYPES, MANAGER_ATTRIBUTE_LABELS, PREMADE_MANAGERS,
  type ManagerArchetype, type ManagerAttributeKey,
} from '@cf/engine';
import {
  Accordion, GlassButton, GlassIcon, GlassInput, GlassPanel, IconArrowLeft, IconCheck,
  IconSwap, IconX, NameText, SectionHeader, Text, cn,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { CreationScreen } from './CreationScreen';
import { ChoiceChips, NumbersDisclosure, SecondaryPath, SelectCard, SwatchRow } from './components';
import {
  ACCENT_COLORS, ACCESSORIES, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLES,
  MEDIA_STYLES, MEDIA_STYLE_HINT, OUTFITS, SKIN_TONES,
  SOCIAL_PERSONALITIES, SOCIAL_PERSONALITY_HINT,
} from './appearance';
import { managerBlocker, useCreationStore } from './creationStore';
import { ManagerPortrait } from './ManagerPortrait';

/**
 * Minute 0-1: identity.
 *
 * The beat sheet gives this minute one job — "this is a character, not a
 * slider" — and for a long time the screen did the opposite: it opened on a
 * 4,269px character builder with thirty-two stat deltas on it, and hid ten
 * hand-written managers behind a secondary tab. That is the wrong way round.
 * Most people opening a football game want to *be* somebody; a smaller, real
 * group want to design somebody. So the ten get the screen and the builder gets
 * an honest offer at the foot of it.
 *
 * Both paths state the same thing in the same weight of type: what this
 * archetype is good at, **and** what it costs. A list of upsides is not a
 * choice. The engine's numbers are real and are one tap away on every card —
 * they are just not the first thing a player reads twenty-five seconds in.
 */

const skinHex = (tone: number): string =>
  SKIN_TONES.find((s) => s.tone === tone)?.hex ?? '#d9a77c';

/**
 * The opening sentence of a bio, whole.
 *
 * A list of ten people needs one line of personality each, and the bios are
 * three or four sentences long. Clamping them would put an ellipsis through
 * some of the best writing in the product; taking the first sentence gives a
 * complete thought that ends where the author ended it, and the rest arrives
 * the moment the card is chosen.
 */
function firstSentence(text: string): string {
  const end = text.search(/\.\s/);
  return end === -1 ? text : text.slice(0, end + 1);
}

const restAfterFirstSentence = (text: string): string =>
  text.slice(firstSentence(text).length).trim();

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
    <div className="flex flex-wrap gap-1.5">
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
    <p className="mt-1.5 flex items-start gap-2 text-[13px] leading-snug text-ink-muted text-pretty">
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

function SelectedTick({ on }: { on: boolean }): ReactNode {
  if (!on) return null;
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-volt text-volt-ink [&_svg]:size-3.5"
    >
      <IconCheck />
    </span>
  );
}

export function ManagerCreationScreen(): ReactNode {
  const navigate = useNavigate();
  const state = useCreationStore();
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `preventScroll` matters: without it the browser scrolls this marker into
    // view and the screen's large title is already half collapsed before the
    // player has touched anything. Focus still moves and is still announced.
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const blocker = managerBlocker(state);

  /** Pre-made managers carry the engine generator's vocabulary; the portrait
   *  understands both, so the fast path looks like the built path. */
  const premadeAppearance = useMemo(
    () => new Map(PREMADE_MANAGERS.map((m) => [m.id, {
      skinTone: Number(m.appearance?.skinTone ?? 3),
      hairStyle: String(m.appearance?.hairStyle ?? 'short'),
      hairColor: String(m.appearance?.hairColor ?? 'dark'),
      facialHair: String(m.appearance?.facialHair ?? 'none'),
      outfit: String(m.appearance?.outfit ?? 'suit'),
      accessory: String(m.appearance?.accessory ?? 'none'),
      accentColor: String(m.appearance?.accentColor ?? '#C8FF2E'),
    }])),
    [],
  );

  const custom = state.managerMode === 'CUSTOM';

  return (
    <CreationScreen
      step="manager"
      title="Who are you?"
      subtitle={
        custom
          ? 'A name, a face, and one decision that costs you something.'
          : 'Ten managers. Every one of them is good at something and bad at something else.'
      }
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

      {custom ? <BuildYourOwn /> : <PickOne premadeAppearance={premadeAppearance} />}
    </CreationScreen>
  );
}

/* --- the default path: ten written characters ------------------------- */

function PickOne({
  premadeAppearance,
}: {
  premadeAppearance: ReadonlyMap<string, Parameters<typeof ManagerPortrait>[0]['appearance']>;
}): ReactNode {
  const state = useCreationStore();

  return (
    <>
      <div className="flex flex-col gap-2">
        {PREMADE_MANAGERS.map((manager) => {
          const archetype = MANAGER_ARCHETYPES.find((a) => a.id === manager.archetypeId);
          const selected = state.premadeManagerId === manager.id;
          return (
            <SelectCard
              key={manager.id}
              label={`${manager.name}, ${archetype?.name ?? 'manager'}. ${archetype?.strength ?? ''} ${archetype?.weakness ?? ''}`}
              selected={selected}
              onSelect={() => state.choosePremade(manager.id)}
              accent={archetype?.accent ?? '#C8FF2E'}
              {...(archetype && selected
                ? {
                    extra: (
                      <NumbersDisclosure>
                        <ModifierRow archetype={archetype} />
                      </NumbersDisclosure>
                    ),
                  }
                : {})}
            >
              <div className="flex gap-3.5 pl-2">
                <ManagerPortrait
                  appearance={premadeAppearance.get(manager.id) ?? state.appearance}
                  size={52}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    {/* A manager's name is an identity, so it is fitted rather
                        than clipped — "Vera Lindqv…" is not a shorter name. */}
                    <NameText name={manager.name} role="bodyStrong" className="min-w-0 flex-1" />
                    <SelectedTick on={selected} />
                  </div>
                  {archetype && (
                    <p
                      className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: archetype.accent }}
                    >
                      {archetype.name}
                    </p>
                  )}
                  <Text role="caption" className="mt-1 leading-snug text-pretty">
                    {firstSentence(manager.bio)}
                  </Text>
                  {selected && restAfterFirstSentence(manager.bio) !== '' && (
                    <Text role="caption" className="mt-1.5 leading-relaxed text-pretty">
                      {restAfterFirstSentence(manager.bio)}
                    </Text>
                  )}
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

      <SecondaryPath
        title="Rather be somebody who does not exist yet?"
        description="Pick a face, name yourself and choose your own archetype. About a minute, and nothing you have done here is lost."
        action="Build your own manager"
        onAction={() => state.setManagerMode('CUSTOM')}
      />
    </>
  );
}

/* --- the opt-in path: the builder ------------------------------------- */

/**
 * The builder, reordered around the one decision that matters.
 *
 * It used to be seven equal sections and roughly forty choices in a single
 * 4,269px scroll, with the archetype — the only choice here with a consequence
 * — buried in the middle of it. Now the name, the face and the archetype are
 * the screen, and the long tail of grooming and persona options sits in two
 * closed disclosures for the people who came here to use them.
 */
function BuildYourOwn(): ReactNode {
  const state = useCreationStore();

  return (
    <>
      <button
        type="button"
        onClick={() => state.setManagerMode('PREMADE')}
        className="-mt-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-semibold text-ink-dim hover:text-ink"
      >
        <IconArrowLeft size={16} />
        Back to the ten managers
      </button>

      {/* The one non-nested glass surface on this screen: the identity block
          is the subject, and everything below it is a control panel. */}
      <GlassPanel level={2} radius="xl" padding="md" sheen>
        <div className="flex items-center gap-4">
          <ManagerPortrait appearance={state.appearance} size={96} label="Your manager" />
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
              <Text role="caption" as="span">Shuffle the look</Text>
            </div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel level={1} radius="lg" padding="md" nested>
        <SectionHeader title="Your face" size="sm" />
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
            legend="Your colour"
            colors={ACCENT_COLORS}
            value={state.appearance.accentColor}
            onChange={(accentColor) => state.setAppearance({ accentColor })}
          />
        </div>
        <div className="mt-2">
          <Accordion title="More of the look" subtitle="Hair colour, facial hair, outfit, what you carry">
            <div className="flex flex-col gap-5">
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
              <ChoiceChips
                legend="Touchline outfit"
                options={OUTFITS.map((o) => ({ value: o.value, label: o.label }))}
                value={state.appearance.outfit}
                onChange={(outfit) => state.setAppearance({ outfit })}
                hint="Your collar on the touchline. It shows in the portrait."
              />
              <ChoiceChips
                legend="Always carrying"
                options={ACCESSORIES.map((a) => ({ value: a.value, label: a.label }))}
                value={state.appearance.accessory}
                onChange={(accessory) => state.setAppearance({ accessory })}
              />
            </div>
          </Accordion>
        </div>
      </GlassPanel>

      <div>
        <SectionHeader
          title="Archetype"
          subtitle="Every one of these gives up something real. There is no best pick."
        />
        <div className="mt-3 flex flex-col gap-2.5">
          {MANAGER_ARCHETYPES.map((archetype) => {
            const selected = state.archetypeId === archetype.id;
            return (
              <SelectCard
                key={archetype.id}
                label={`${archetype.name}. ${archetype.strength} ${archetype.weakness}`}
                selected={selected}
                onSelect={() => state.setArchetype(archetype.id)}
                accent={archetype.accent}
                {...(selected
                  ? {
                      extra: (
                        <NumbersDisclosure>
                          <ModifierRow archetype={archetype} />
                        </NumbersDisclosure>
                      ),
                    }
                  : {})}
              >
                <div className="flex items-start justify-between gap-3 pl-2">
                  <div className="min-w-0">
                    <Text role="section" as="p">{archetype.name}</Text>
                    <Text role="caption" className="mt-0.5 font-medium text-ink-dim">
                      {archetype.tagline}
                    </Text>
                  </div>
                  <SelectedTick on={selected} />
                </div>
                <div className="pl-2">
                  <TradeLine tone="good">{archetype.strength}</TradeLine>
                  <TradeLine tone="bad">{archetype.weakness}</TradeLine>
                </div>
              </SelectCard>
            );
          })}
        </div>
      </div>

      <GlassPanel level={1} radius="lg" padding="md" nested>
        <Accordion
          title="Personality"
          subtitle="How you handle a camera and how you behave online. Set by your archetype until you change it."
        >
          <div className="flex flex-col gap-5">
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
        </Accordion>
      </GlassPanel>
    </>
  );
}
