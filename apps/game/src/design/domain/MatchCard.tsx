import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { ClubVisualIdentity } from '@cf/engine';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { rgba } from '../color';
import { FOCUS_RING } from '../glass/glassLevel';
import { GlassPill } from '../glass/GlassPill';
import { ClubBadge } from './ClubBadge';
import { FormGuide, type FormResult } from './chips';
import { ScoreDisplay } from './numbers';
import { NameText } from '../typography/Text';
import { TYPE_CLASS } from '../typography/type';
import { IconFlame } from '../icons';

/**
 * A fixture, in four states.
 *
 * Takes a light `MatchCardSide` rather than a full `Club` so the fixture list
 * does not have to resolve twelve complete club objects to draw a week of
 * matches — the league screen renders 6-11 of these at once.
 */
export interface MatchCardSide {
  readonly clubId: string;
  readonly name: string;
  readonly shortName: string;
  readonly abbreviation: string;
  readonly visual: ClubVisualIdentity;
  readonly form?: readonly FormResult[];
}

export type MatchCardVariant = 'upcoming' | 'live' | 'result' | 'hero';

export interface MatchCardProps {
  home: MatchCardSide;
  away: MatchCardSide;
  variant?: MatchCardVariant;
  homeScore?: number | null;
  awayScore?: number | null;
  /** "Sat 15:00", "Week 12", "78'", "FT" — whatever the screen has. */
  status?: ReactNode;
  /** 1-5 from `Fixture.importance`. 4+ earns the accent hairline. */
  importance?: number;
  isDerby?: boolean;
  competitionLabel?: ReactNode;
  onPress?: () => void;
  /** Right-hand action, e.g. "Play" on the next fixture. */
  action?: ReactNode;
  className?: string;
}

function Side({ side, align }: { side: MatchCardSide; align: 'left' | 'right' }): ReactNode {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2.5',
        align === 'right' && 'flex-row-reverse text-right',
      )}
    >
      <ClubBadge visual={side.visual} size={34} />
      <div className="min-w-0 flex-1">
        {/* Short name first, then the abbreviation, then two lines - in that
            order, and never an ellipsis. A fixture list is the densest place a
            club name appears, so it is where truncation used to start. */}
        <NameText
          name={side.shortName}
          abbr={side.abbreviation}
          role="bodyStrong"
          floor={0.8}
          lines={2}
          className={cn('min-w-0', align === 'right' && 'text-right')}
        />
        {side.form && side.form.length > 0 && (
          <div className={cn('mt-1 flex', align === 'right' && 'justify-end')}>
            <FormGuide results={side.form.slice(-3)} />
          </div>
        )}
      </div>
    </div>
  );
}

export const MatchCard = memo(function MatchCard({
  home,
  away,
  variant = 'upcoming',
  homeScore,
  awayScore,
  status,
  importance = 3,
  isDerby = false,
  competitionLabel,
  onPress,
  action,
  className,
}: MatchCardProps): ReactNode {
  const m = useDesignMotion();
  const interactive = Boolean(onPress);
  const hero = variant === 'hero';
  const played = homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined;
  const bigGame = importance >= 4 || isDerby;

  const Element = interactive ? motion.button : motion.div;

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => { haptics.impact(); onPress?.(); } : undefined}
      whileTap={interactive && !m.reduced ? { scale: 0.985 } : undefined}
      transition={m.spring.press}
      aria-label={`${home.name} versus ${away.name}${played ? `, ${homeScore} to ${awayScore}` : ''}`}
      className={cn(
        'glass-2 glass-sheen relative w-full overflow-hidden rounded-lg text-left',
        hero ? 'p-5' : 'p-3.5',
        interactive && FOCUS_RING,
        className,
      )}
    >
      {/* Both clubs' colours meet in the middle. Two flat gradients, no blur. */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(100deg, ${rgba(home.visual.primary, hero ? 0.42 : 0.28)} 0%, transparent 44%), linear-gradient(260deg, ${rgba(away.visual.primary, hero ? 0.42 : 0.28)} 0%, transparent 44%)`,
        }}
      />
      {bigGame && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-volt/70" />}

      <div className="relative">
        {(competitionLabel !== undefined || bigGame) && (
          <div className="mb-3 flex items-center justify-between gap-2">
            {/* Sentence case: uppercasing this made it ~30% wider for no extra
                meaning, and it was the first thing to clip on a narrow phone. */}
            <span className={cn(TYPE_CLASS.label, 'min-w-0 flex-1 text-ink-dim text-pretty')}>
              {competitionLabel}
            </span>
            {isDerby ? (
              <GlassPill tone="volt" size="xs" icon={<IconFlame />}>Derby</GlassPill>
            ) : importance >= 5 ? (
              <GlassPill tone="volt" size="xs">Decider</GlassPill>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Side side={home} align="left" />
          <div className="shrink-0 px-1">
            {played ? (
              <ScoreDisplay
                home={homeScore}
                away={awayScore}
                size={hero ? 'lg' : 'md'}
                status={status}
                live={variant === 'live'}
                homeLabel={home.name}
                awayLabel={away.name}
              />
            ) : (
              <div className="flex flex-col items-center">
                <span className={cn(TYPE_CLASS.label, 'text-[13px] tracking-[0.06em] text-ink-dim')}>vs</span>
                {status !== undefined && (
                  <span className="tnum mt-1 text-[12px] font-semibold text-ink-muted">{status}</span>
                )}
              </div>
            )}
          </div>
          <Side side={away} align="right" />
        </div>

        {action !== undefined && <div className="mt-4">{action}</div>}
      </div>
    </Element>
  );
});
