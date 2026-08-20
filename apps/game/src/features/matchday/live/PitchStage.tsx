import { memo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Side } from '@cf/engine';
import { IconEye, cn, haptics, useDesignMotion } from '@/design';
import { ROLE_SHORT, type KitPalette, type PitchRole } from '../shared/kit';
import { CAMERA_HINT, CAMERA_LABEL } from '../shared/format';
import { PitchView } from './PitchView';
import type { PitchCamera } from './pitchRenderer';

/**
 * The pitch and everything written on top of it.
 *
 * The canvas is a display; this is the label around it. A player who has never
 * opened the game is told four things without being asked to read a manual:
 * which way their team is attacking, what phase of play is running, what the
 * colours under the shirts mean, and that the camera is theirs to change.
 *
 * The camera control lives here rather than in the control rail because it
 * changes what you are *looking at*, not what the team is doing — and because a
 * control that sits on the thing it affects needs no label explaining which
 * thing that is. It is one button rather than a two-option segment: a segment
 * wide enough for two 44pt targets covered a fifth of a phone-sized pitch, and
 * the state it was showing is exactly what the camera itself already shows.
 */

export interface PitchStageProps {
  homePalette: KitPalette;
  awayPalette: KitPalette;
  playerSide: Side;
  numbers: Readonly<Record<string, number>>;
  keepers: Readonly<Record<string, boolean>>;
  roles: Readonly<Record<string, PitchRole>>;
  camera: PitchCamera;
  onCamera: (camera: PitchCamera) => void;
  drama: string | null;
  impactKey: string | null;
  /** 0-1. A goal for the managed side lands harder than one against it. */
  impactStrength?: number;
  /** Take all the height offered instead of holding a landscape aspect ratio. */
  fill?: boolean;
  className?: string;
}

const ROLE_KEY: readonly PitchRole[] = ['DEF', 'MID', 'ATT'];

export const PitchStage = memo(function PitchStage({
  homePalette, awayPalette, playerSide, numbers, keepers, roles, camera, onCamera,
  drama, impactKey, impactStrength = 1, fill = false, className,
}: PitchStageProps): ReactNode {
  const m = useDesignMotion();
  const ours = playerSide === 'home' ? homePalette : awayPalette;
  const next: PitchCamera = camera === 'WIDE' ? 'FOLLOW' : 'WIDE';

  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-surface-1',
        className,
      )}
      aria-label="Live pitch"
    >
      <div className={cn('relative w-full', fill ? 'min-h-0 flex-1' : 'aspect-[3/2]')}>
        <PitchView
          homePalette={homePalette}
          awayPalette={awayPalette}
          playerSide={playerSide}
          numbers={numbers}
          keepers={keepers}
          roles={roles}
          orientation="horizontal"
          camera={camera}
          drama={drama !== null}
          impactKey={impactKey}
          impactStrength={impactStrength}
          className="h-full w-full rounded-none"
        />

        {/* --- the drama banner ---------------------------------------- */}
        <AnimatePresence>
          {drama !== null && (
            <motion.p
              key={drama}
              initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={m.transition.fast}
              className={cn(
                'pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-pill',
                'bg-volt px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-volt-ink',
              )}
            >
              {drama}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/*
        The legend and the camera sit in a strip *under* the grass rather than
        floating on it. Overlaid, they spent the match sitting on top of the
        players nearest the touchline — and the touchline is where a full-back
        overlapping is the most interesting thing on the pitch.
      */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.06] px-2">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
          {/* The club's colour is a swatch, never the ink: half the kits in the
              league would fail contrast as text at this size. */}
          <span
            aria-hidden="true"
            className="block size-2 rounded-pill ring-1 ring-white/25"
            style={{ background: ours.primary }}
          />
          You attack →
        </span>

        <ul className="flex items-center gap-1.5">
          {ROLE_KEY.map((role) => (
            <li key={role} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="block size-1.5 rounded-pill"
                style={{ background: ours.plate[role] }}
              />
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-ink-dim">
                {ROLE_SHORT[role]}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          aria-pressed={camera === 'FOLLOW'}
          aria-label={`Camera: ${CAMERA_LABEL[camera]}. ${CAMERA_HINT[camera]} Tap for ${CAMERA_LABEL[next]}.`}
          onClick={() => { haptics.selection(); onCamera(next); }}
          className={cn(
            'flex min-h-11 items-center gap-1.5 rounded-pill px-2.5',
            'text-[10px] font-bold uppercase tracking-[0.12em] text-ink',
            'outline-none transition-colors duration-[var(--duration-fast)] hover:bg-white/[0.08]',
            'focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
            '[&_svg]:size-3.5 [&_svg]:text-volt',
          )}
        >
          <IconEye />
          {CAMERA_LABEL[camera]}
        </button>
      </div>
    </section>
  );
});
