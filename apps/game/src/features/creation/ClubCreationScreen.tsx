import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PHILOSOPHY_LABELS, playerClub, trackEvent,
  type BadgeMotif, type BadgeShape, type ClubIdentityStyle, type ClubTemplate,
  type ClubVisualIdentity, type FanCulture,
} from '@cf/engine';
import {
  Accordion, ClubBadge, ErrorState, FOCUS_RING, GlassButton, GlassIcon, GlassInput, GlassPanel,
  GlassPill, IconArrowLeft, IconCheck, IconSwap, IconWarning, MoneyLabel, NameText, ProgressBar,
  SectionHeader, Skeleton, SkeletonRegion, Text,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { playerMessageFor, useContent, type ContentError, type ContentStatus } from '@/state/content';
import { CreationScreen } from './CreationScreen';
import { ChoiceChips, NumbersDisclosure, SecondaryPath, SelectCard, SwatchRow } from './components';
import { KitPreview } from './KitPreview';
import { ClubReveal } from './ClubReveal';
import { BuildingLeague } from './BuildingLeague';
import {
  BADGE_MOTIFS, BADGE_SHAPES, FAN_CULTURES, FAN_CULTURE_HINT, FAN_CULTURE_LABELS,
  IDENTITY_STYLES, KIT_PATTERNS, PHILOSOPHIES, PHILOSOPHY_PLAY, PRIMARY_COLORS,
  SECONDARY_COLORS, philosophyDescription,
} from './clubIdentity';
import { buildClubBriefs, type ClubBrief, type ClubBriefs } from './clubBriefs';
import {
  clubBlocker, toClubChoice, toManagerChoice, useCreationStore,
} from './creationStore';

/**
 * Minute 1-3: the club.
 *
 * Twelve clubs already exist here with six sentences of authored history each,
 * declared rivals, a budget and a philosophy. For a long time they were behind
 * a secondary tab, presented as a flat list of twelve sorted by squad strength
 * — which tells a first-time player exactly one thing: pick the top one. The
 * default is now the clubs, and they are framed as a choice rather than a
 * leaderboard: three at deliberately contrasting difficulty, each with the
 * expectation stated in words, the budget, the rivals, and one honest sentence
 * about what taking them on costs. The other nine are one tap away.
 *
 * Building a club from nothing is still here and still good — it is simply no
 * longer the thing a newcomer is handed before they know what any of it means.
 *
 * The badge at the top is the real `ClubBadge` component fed the real
 * `ClubVisualIdentity` the engine will store, so what the player is looking at
 * while they choose is the artefact itself and not an impression of it.
 *
 * The twelve clubs are content, and content is a chunk that arrives on its
 * own. This screen never waits for it: the header, the two paths and the
 * whole "found a club" designer are on screen at once, and the takeover list
 * fills in when the universe is here — usually before the player has read the
 * title, because the title screen asked for it. Until then the list is three
 * card-shaped placeholders under a "preparing your league" label; if it does
 * not arrive, the list says so in football and offers to try again, and
 * nothing else on the screen is held hostage.
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

/** How long the "building the league" beat is held before the reveal. */
const BUILD_BEAT_MS = 1500;

type Stage = 'FORM' | 'BUILDING' | 'REVEAL';

/**
 * What the player reads when confirming did not produce a club.
 *
 * Three things, in the order they matter: nothing happened to their progress,
 * what they typed is still here, and what to do next. The store's message
 * says why; this says what it means for them.
 */
function creationFailureCopy(reason: string | null): string {
  const kept = 'Nothing was saved and everything you entered is still here.';
  if (!reason || /could not be created/i.test(reason)) return `${kept} Try again when you are ready.`;
  return `${kept} ${reason}`;
}

/**
 * The failed-confirmation notice: inline, above the button that retries, and
 * it stays until the player acts. A toast here left before it could be read,
 * and a message about "your details are still here" is only reassuring if it
 * is still there when the player looks for it.
 *
 * It takes focus when it appears, because the button the player pressed has
 * just come back from behind the building beat and focus would otherwise
 * have nowhere to be. From here the next tab stop is the button.
 */
function CreationFailureNotice({ body }: { body: string }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mb-3 flex items-start gap-3 rounded-[var(--radius-lg)] border border-danger/30 bg-danger/10 px-3.5 py-3 outline-none"
    >
      <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill bg-danger/15 text-danger [&_svg]:size-3.5">
        <IconWarning />
      </span>
      <div className="min-w-0 flex-1">
        <Text role="bodyStrong" as="p">Your club could not be created</Text>
        <Text role="caption" className="mt-0.5 text-pretty">{body}</Text>
      </div>
    </div>
  );
}

export function ClubCreationScreen(): ReactNode {
  const navigate = useNavigate();
  const state = useCreationStore();
  const startNewGame = useGameStore((s) => s.startNewGame);
  const gameState = useGameStore((s) => s.state);
  const [stage, setStage] = useState<Stage>('FORM');
  const [creationFailure, setCreationFailure] = useState<string | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const { status: contentStatus, failure: contentFailure, loaded, retry } = useContent();

  useEffect(() => {
    // `preventScroll` matters: without it the browser scrolls this marker into
    // view and the screen's large title is already half collapsed before the
    // player has touched anything. Focus still moves and is still announced.
    headingRef.current?.focus({ preventScroll: true });
    // A deep link or a reload lands here without passing the title screen;
    // make sure the universe is on its way. A no-op when it already is.
    retry();
  }, [retry]);

  const blocker = clubBlocker(state);
  const custom = state.clubMode === 'CUSTOM';

  const briefs = useMemo(
    () => (loaded ? buildClubBriefs(loaded.registry.clubs(), loaded.lore) : null),
    [loaded],
  );
  const takeover = useMemo(
    () => briefs?.briefFor(state.takeoverClubId)?.club,
    [briefs, state.takeoverClubId],
  );

  const previewVisual = custom ? state.visual : takeover ? templateVisual(takeover) : state.visual;
  const previewName = custom ? state.clubName || 'Your club' : takeover?.name ?? 'Your club';

  const createdClub = gameState ? playerClub(gameState) : null;

  const create = async (): Promise<void> => {
    setCreationFailure(null);
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
    // Back to the form exactly as it was, with the reason where the player
    // will look for it: next to the button they pressed.
    setCreationFailure(creationFailureCopy(useGameStore.getState().error));
    setStage('FORM');
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
      title={custom ? 'Found a club' : 'Take a club over'}
      subtitle={
        custom
          ? 'Everything here is visible from the first whistle.'
          : 'Inherit a squad, a history and somebody who already hates you.'
      }
      onBack={() => navigate(ROUTES.managerCreation)}
      footer={
        <>
          {creationFailure !== null && <CreationFailureNotice body={creationFailure} />}
          <GlassButton
            variant="primary"
            size="lg"
            block
            disabled={blocker !== null}
            onClick={() => void create()}
          >
            {blocker ?? (custom ? `Found ${state.shortName || 'the club'}` : `Take over ${takeover?.shortName ?? ''}`)}
          </GlassButton>
        </>
      }
    >
      <div ref={headingRef} tabIndex={-1} aria-label="Step 2 of 3, club" className="outline-none" />

      {/* The crest lockup is the subject — but only once there is a crest to
          look at. An empty placeholder badge above an unmade choice is a
          picture of nothing, so on the takeover path it appears the moment a
          club is chosen and not before. */}
      {(custom || takeover) && (
        <GlassPanel level={2} radius="xl" padding="md" sheen>
          <div className="flex items-center gap-4">
            <ClubBadge visual={previewVisual} size={92} label={`${previewName} badge`} />
            <div className="min-w-0 flex-1">
              <NameText
                name={previewName}
                {...(takeover ? { short: takeover.shortName, abbr: takeover.abbreviation } : {})}
                role="title"
                lines={2}
              />
              <Text role="caption" className="mt-0.5">
                {custom
                  ? [state.city || 'City', state.abbreviation || '—'].join(' · ')
                  : `${takeover?.city ?? ''} · founded ${takeover?.founded ?? ''}`}
              </Text>
            </div>
            <KitPreview visual={previewVisual} size={58} label={`${previewName} kit`} />
          </div>
        </GlassPanel>
      )}

      {custom
        ? <FoundAClub />
        : <TakeOneOver briefs={briefs} status={contentStatus} failure={contentFailure} onRetry={retry} />}
    </CreationScreen>
  );
}

/* --- the default path: twelve clubs that already exist ----------------- */

/**
 * `prominent` is for the three the screen opens on.
 *
 * The procedural crest system is the best visual asset in this product, and a
 * 54px icon in a list is the one presentation guaranteed to waste it. The three
 * featured clubs get the crest at 78px with the home kit under it, so the first
 * thing a player sees on this screen is twelve years of invented history drawn
 * properly. The other nine, inside the disclosure, stay compact — that is a
 * list you are scanning, not a thing you are being sold.
 */
function ClubChoiceCard({ brief, prominent = false }: {
  brief: ClubBrief;
  prominent?: boolean;
}): ReactNode {
  const state = useCreationStore();
  const { club, tierCopy } = brief;
  const selected = state.takeoverClubId === club.id;

  return (
    <SelectCard
      label={`${club.name} of ${club.city}. ${tierCopy.label}. ${brief.honest}`}
      selected={selected}
      onSelect={() => state.chooseTakeover(club.id)}
      accent={club.visual.secondary}
      {...(selected ? {
        extra: (
        <NumbersDisclosure>
          <div className="flex flex-col gap-1.5">
            <ProgressBar
              label="Squad strength"
              value={club.strength}
              valueLabel={String(club.strength)}
              size="xs"
              tone="neutral"
            />
            <ProgressBar
              label="Reputation"
              value={club.reputation}
              valueLabel={String(club.reputation)}
              size="xs"
              tone="neutral"
            />
          </div>
        </NumbersDisclosure>
        ),
      } : {})}
    >
      <div className="flex gap-3.5 pl-2">
        <div className="flex shrink-0 flex-col items-center gap-2.5">
          <ClubBadge
            visual={templateVisual(club)}
            size={prominent ? 78 : 54}
            label={`${club.name} badge`}
          />
          {prominent && (
            <KitPreview
              visual={templateVisual(club)}
              size={46}
              label={`${club.name} home kit`}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* Club names are identity. Fitted, then short name, then the
                  three-letter code — never an ellipsis. */}
              <NameText
                name={club.name}
                short={club.shortName}
                abbr={club.abbreviation}
                role="bodyStrong"
                lines={2}
              />
              <Text role="caption" className="mt-0.5">{club.city}</Text>
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

          {/* The difficulty read: a word, and then the same thing said in a
              sentence, so the colour is never carrying it alone. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <GlassPill tone={tierCopy.tone} size="xs" filled>{tierCopy.label}</GlassPill>
            <Text role="caption" as="span" className="text-ink-dim">{tierCopy.expectation}</Text>
          </div>

          <Text role="body" className="mt-2.5 text-pretty">{brief.honest}</Text>

          {/* The only number on the card, and the brief asks for it by name:
              what you have to spend is the difference between a plan and a
              wish. Everything else here is a word. */}
          <dl className="mt-3">
            <div className="flex items-baseline gap-2">
              <dt className="text-[12px] text-ink-dim">Budget</dt>
              <dd><MoneyLabel amount={club.budget} size="sm" className="font-semibold text-ink" /></dd>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <dt className="sr-only">Style of play and support</dt>
              <dd className="text-[12px] text-ink-muted">
                {brief.philosophyLabel} · {brief.fanCultureLabel} support
              </dd>
            </div>
          </dl>

          {brief.rivals.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                Rivals
              </span>
              {brief.rivals.map((name) => (
                <GlassPill key={name} tone="danger" size="xs">{name}</GlassPill>
              ))}
            </div>
          )}

          {/* Six sentences of authored history. It is the reward for having
              decided, not the thing you are asked to decide from. */}
          {selected && brief.lore !== '' && (
            <Text role="caption" className="mt-3 leading-relaxed text-pretty">
              {brief.lore}
            </Text>
          )}
        </div>
      </div>
    </SelectCard>
  );
}

function TakeOneOver({ briefs, status, failure, onRetry }: {
  briefs: ClubBriefs | null;
  status: ContentStatus;
  failure: ContentError | null;
  onRetry: () => void;
}): ReactNode {
  const state = useCreationStore();
  const [showAll, setShowAll] = useState(false);
  const restId = useId();
  /**
   * True from the moment the player presses "Try again" until the clubs are
   * on screen. It decides two things: that the failure block stays put (with
   * its button busy) while the retry runs, rather than giving way to the
   * skeletons and taking the player's place with it; and that when the clubs
   * arrive, focus goes to the first of them — the first thing the player can
   * now do. A prefetch arriving on its own never moves focus: nobody asked.
   */
  const recovering = useRef(false);
  const failureRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const retrying = status === 'LOADING' && recovering.current;

  const retry = (): void => {
    recovering.current = true;
    // Keep focus inside the block the player is acting on while its button
    // is busy; a busy button cannot hold focus, and the body is not a place.
    failureRef.current?.focus({ preventScroll: true });
    onRetry();
  };

  useEffect(() => {
    if (!briefs || !recovering.current) return;
    recovering.current = false;
    const first = listRef.current?.querySelector<HTMLElement>('button[aria-pressed]');
    first?.focus({ preventScroll: true });
  }, [briefs]);

  return (
    <>
      <div>
        {/* The disclosure lives in the section header's action slot rather than
            in a panel below the cards, because that is what it is: a control on
            the scope of this section, not a fourth thing to choose. It also
            means the first three real choices are the first three real controls
            after the back button — which matters for anything walking the
            screen in order, keyboard or otherwise. */}
        <SectionHeader
          title="Three ways to start"
          subtitle="Win the league, entertain them, or keep the lights on."
          {...(briefs ? {
            action: (
              <button
                type="button"
                aria-expanded={showAll}
                aria-controls={restId}
                onClick={() => setShowAll((open) => !open)}
                className={`min-h-11 shrink-0 px-1 text-[13px] font-semibold text-ink-dim hover:text-ink ${FOCUS_RING}`}
              >
                {showAll ? 'Show three' : 'All twelve'}
              </button>
            ),
          } : {})}
        />
        {briefs ? (
          <div ref={listRef} className="mt-3 flex flex-col gap-2.5">
            {briefs.featured.map((brief) => (
              <ClubChoiceCard key={brief.club.id} brief={brief} prominent />
            ))}
          </div>
        ) : status === 'FAILED' || retrying ? (
          /* The list is the only thing that needed the universe, so the list
             is the only thing that says it is missing. The rest of the screen
             — and founding a club — carries on. While a retry runs the block
             stays, the button shows it is busy and the text says what is
             happening, so nothing jumps and nothing can be pressed twice. */
          <div ref={failureRef} tabIndex={-1} className="outline-none">
            <ErrorState
              title="Your league could not be prepared"
              description={retrying ? 'Preparing your league…' : playerMessageFor(failure)}
              onRetry={retry}
              retryLabel="Try again"
              retrying={retrying}
              className="py-8"
            />
          </div>
        ) : (
          /* Three card-shaped placeholders where the three clubs will be, so
             the screen keeps its shape and the arrival is a fill, not a jump.
             The region announces itself once; the placeholders are silent. */
          <SkeletonRegion loading label="Preparing your league" className="mt-3 flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => <Skeleton key={i} variant="card" height={172} />)}
          </SkeletonRegion>
        )}
      </div>

      <div id={restId}>
        {briefs && showAll && (
          <>
            <SectionHeader
              title="The other nine"
              subtitle="Everybody else in this league, strongest first."
              size="sm"
            />
            <div className="mt-3 flex flex-col gap-2.5">
              {briefs.remaining.map((brief) => (
                <ClubChoiceCard key={brief.club.id} brief={brief} />
              ))}
            </div>
          </>
        )}
      </div>

      <SecondaryPath
        title="Rather start with nothing?"
        description="Name a club, draw its badge, set its kit and decide what it believes in. It takes the weakest slot in the league — which is the point."
        action="Found your own club"
        onAction={() => state.setClubMode('CUSTOM')}
      />
    </>
  );
}

/* --- the opt-in path: the identity designer ---------------------------- */

/**
 * The designer, with its long tail folded away.
 *
 * Colour and shape change the crest the player is watching, so they stay on the
 * screen. Emblem, kit pattern and house style are twenty-four more chips that
 * do not, so they sit behind one disclosure. The philosophy list stays open and
 * full-size, because it is the only choice here the simulation reads.
 */
function FoundAClub(): ReactNode {
  const state = useCreationStore();

  return (
    <>
      <button
        type="button"
        onClick={() => state.setClubMode('TAKEOVER')}
        className="-mt-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-semibold text-ink-dim hover:text-ink"
      >
        <IconArrowLeft size={16} />
        Back to the twelve clubs
      </button>

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
        </div>
        <div className="mt-2">
          <Accordion title="More of the crest" subtitle="Emblem, kit pattern, house style">
            <div className="flex flex-col gap-5">
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
          </Accordion>
        </div>
      </GlassPanel>

      <div>
        <SectionHeader
          title="How you play"
          subtitle="This sets your starting shape and how the club behaves when you are not looking."
        />
        <div className="mt-3 flex flex-col gap-2.5">
          {PHILOSOPHIES.map((philosophy) => {
            const selected = state.philosophy === philosophy;
            return (
              <SelectCard
                key={philosophy}
                label={PHILOSOPHY_LABELS[philosophy]}
                selected={selected}
                onSelect={() => state.setPhilosophy(philosophy)}
              >
                <div className="flex items-start justify-between gap-3">
                  <Text role="section" as="p" className="min-w-0 flex-1">{PHILOSOPHY_LABELS[philosophy]}</Text>
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-volt text-volt-ink [&_svg]:size-3.5"
                    >
                      <IconCheck />
                    </span>
                  )}
                </div>
                <Text role="caption" className="mt-1 leading-relaxed text-pretty">
                  {philosophyDescription(philosophy)}
                </Text>
                <Text role="caption" className="mt-1.5 leading-relaxed text-ink-dim text-pretty">
                  {PHILOSOPHY_PLAY[philosophy]}
                </Text>
              </SelectCard>
            );
          })}
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
  );
}
