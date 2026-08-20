import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  autoLineup, formationById, formationsFor, nextFixture, patchClub, playerClub,
  squadOf, trackEvent, type Formation,
} from '@cf/engine';
import {
  GlassButton, GlassPanel, GlassPill, IconCheck, NameText, PlayerCard,
  SectionHeader, Text, useConfirm,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { CreationScreen } from './CreationScreen';
import { SelectCard } from './components';
import { useCreationStore } from './creationStore';
import { FIRST_SHAPE_IDS, SHAPE_CONSEQUENCE, squadShapeNote, squadStory } from './squadStory';

/**
 * Minute 3-5: the squad, and the one tactical decision before kick-off.
 *
 * This is an introduction, not a management screen. The brief asks for exactly
 * three players — the star, the prospect and the problem — and then one shape
 * chosen in plain language, and that is now what is here. What used to be here
 * as well: three stat tiles, a "your best three" rail that was really three
 * copies of the same idea, and a four-row position breakdown carrying twelve
 * more numbers. All of it was true and none of it was a decision, and it
 * arrived before the player had watched a single minute of football.
 *
 * There is no lineup editor here, no training plan and no transfer list — every
 * one of those exists behind the tab bar the player is about to meet, and
 * putting them in the first five minutes is how a football game loses somebody
 * in a spreadsheet before they have kicked a ball.
 *
 * Everything on it is engine data. The three faces come from `squadStory`,
 * which reads `overall`, `potential`, `age` and `autoLineup` — no rating, no
 * strength and no valuation is computed in this file.
 */

/**
 * Volt is not in here on purpose. It belongs to the one action on the screen —
 * the button that starts the match — and spending it on a taxonomy label is how
 * a brand colour stops meaning "do this".
 */
const ROLE_TONE = {
  STAR: 'positive',
  PROSPECT: 'info',
  PROBLEM: 'danger',
} as const;

export function SquadIntroScreen(): ReactNode {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const gameState = useGameStore((s) => s.state);
  const apply = useGameStore((s) => s.apply);
  const abandon = useGameStore((s) => s.abandon);
  const resetDraft = useCreationStore((s) => s.reset);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `preventScroll` matters: without it the browser scrolls this marker into
    // view and the screen's large title is already half collapsed before the
    // player has touched anything. Focus still moves and is still announced.
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const data = useMemo(() => {
    if (!gameState) return null;
    const club = playerClub(gameState);
    const squad = squadOf(gameState, club.id);
    const formation = formationById(club.tactics.formationId);
    // Ordered by `FIRST_SHAPE_IDS`, not by the engine's own list order, so the
    // three read as a ladder: bodies behind the ball, then balance, then bodies
    // in front of it. A player who understands nothing else about tactics can
    // still tell what they are choosing between.
    const available = formationsFor(7);
    const shapes = FIRST_SHAPE_IDS
      .map((id) => available.find((f) => f.id === id))
      .filter((f): f is Formation => f !== undefined);
    return {
      club,
      squad,
      formation,
      shapes,
      cards: squadStory(squad, formation),
      note: squadShapeNote(squad),
      fixture: nextFixture(gameState, club.id),
    };
  }, [gameState]);

  /**
   * Picking a shape writes the formation *and* the team sheet that goes with
   * it, through the same `autoLineup` the tactics screen uses. Nothing is
   * decided here that the engine does not decide.
   */
  const chooseShape = useCallback((next: Formation) => {
    apply((current) => {
      const club = playerClub(current);
      const suggestion = autoLineup(squadOf(current, club.id), next);
      return patchClub(current, club.id, (c) => ({
        tactics: {
          ...c.tactics,
          formationId: next.id,
          lineup: suggestion.lineup,
          bench: suggestion.bench,
        },
      }));
    });
  }, [apply]);

  if (!data) return null;

  const { club, squad, formation, shapes, cards, note, fixture } = data;
  const opponentId = fixture
    ? fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId
    : null;
  const opponent = opponentId ? gameState?.clubs[opponentId] : undefined;

  const kickOff = (): void => {
    trackEvent('onboarding_complete', {
      clubId: club.id,
      squadSize: squad.length,
      firstOpponent: opponent?.shortName ?? null,
    });
    // The draft has done its job; a later new career starts clean.
    resetDraft();
    navigate(
      fixture ? buildPath(ROUTES.matchPreview, { fixtureId: fixture.id }) : ROUTES.matchday,
      { replace: true },
    );
  };

  const startOver = async (): Promise<void> => {
    const ok = await confirm({
      title: `Delete ${club.name}?`,
      description:
        'The club, the squad and the season you just created are removed and you go back to the start of creation. What you typed is kept.',
      confirmLabel: 'Delete and restart',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    await abandon();
    navigate(ROUTES.managerCreation, { replace: true });
  };

  return (
    <CreationScreen
      step="squad"
      title="Your squad"
      subtitle={`${squad.length} players. Three of them you will remember.`}
      /* One button, and it is the one that starts the match. "Start over" used
         to sit directly beneath it inside this same sticky bar, which put a
         destructive action *after* the primary one — a keyboard or
         switch-control walk to "the last control on the screen" landed on
         "delete my club". It is still available, at the foot of the page,
         where a destructive escape hatch belongs. */
      footer={
        <GlassButton variant="primary" size="lg" block onClick={kickOff}>
          {opponent ? `Play ${opponent.shortName}` : 'Play your first match'}
        </GlassButton>
      }
    >
      <div ref={headingRef} tabIndex={-1} aria-label="Step 3 of 3, squad" className="outline-none" />

      <div>
        <SectionHeader
          title="The three worth knowing"
          subtitle="Your best, your future, and the one they will aim at."
        />
        {/* Three rows, not a rail. A rail can only show two of three cards on a
            393pt screen, and the beat is "exactly three players" — the third
            one being behind a swipe is the difference between a promise kept
            and a promise implied. Rows also give the sentence beside each
            player room to be read. */}
        <ul className="mt-3 flex flex-col gap-3">
          {cards.map((card) => (
            <li key={card.player.id} className="flex items-start gap-3.5">
              <div className="w-[132px] shrink-0">
                <PlayerCard
                  player={card.player}
                  variant="standard"
                  club={{ name: club.name, abbreviation: club.abbreviation, visual: club.visual }}
                />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <GlassPill tone={ROLE_TONE[card.role]} size="xs">{card.label}</GlassPill>
                <Text role="body" className="mt-2 text-pretty">{card.line}</Text>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* The one tactical decision the beat sheet asks for, explained by the
          one thing about this squad worth saying out loud. Teaching happens
          here, at the moment it matters, in a sentence — not in a modal. */}
      <div>
        <SectionHeader
          title="One decision before kick-off"
          subtitle={`${note.headline}. ${note.detail}`}
        />
        <div className="mt-3 flex flex-col gap-2.5">
          {shapes.map((shape) => {
            const selected = formation.id === shape.id;
            return (
              <SelectCard
                key={shape.id}
                label={`${shape.name}. ${shape.blurb} ${SHAPE_CONSEQUENCE[shape.id] ?? ''}`}
                selected={selected}
                onSelect={() => chooseShape(shape)}
              >
                <div className="flex items-start justify-between gap-3">
                  <Text role="section" as="p" className="min-w-0 flex-1">{shape.name}</Text>
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-volt text-volt-ink [&_svg]:size-3.5"
                    >
                      <IconCheck />
                    </span>
                  )}
                </div>
                <Text role="body" className="mt-1 text-pretty">{shape.blurb}</Text>
                <Text role="caption" className="mt-1.5 text-ink-dim text-pretty">
                  {SHAPE_CONSEQUENCE[shape.id]}
                </Text>
              </SelectCard>
            );
          })}
        </div>
        <Text role="caption" className="mt-3 text-ink-dim text-pretty">
          Three more shapes and the full team sheet are on Squad → Tactics whenever you want them.
        </Text>
      </div>

      {opponent && fixture && (
        <GlassPanel level={1} radius="lg" padding="md" nested accent="volt">
          <Text role="eyebrow" as="p">
            Next · {fixture.homeClubId === club.id ? 'Home' : 'Away'}
          </Text>
          <NameText
            name={opponent.name}
            short={opponent.shortName}
            abbr={opponent.abbreviation}
            role="title"
            as="h3"
            lines={2}
            className="mt-1.5"
          />
          <Text role="body" tone="muted" className="mt-1.5 text-pretty">
            You keep the shape you just picked. Everything else is decided at the team talk.
          </Text>
          {fixture.isDerby && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <GlassPill tone="danger" size="xs">Derby</GlassPill>
            </div>
          )}
        </GlassPanel>
      )}

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => void startOver()}
          className="min-h-11 px-3 text-[13px] font-semibold text-ink-dim hover:text-ink"
        >
          Delete this club and start over
        </button>
      </div>
    </CreationScreen>
  );
}
