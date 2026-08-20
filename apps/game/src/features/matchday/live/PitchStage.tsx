import { memo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Side } from '@cf/engine';
import { cn, haptics, useDesignMotion } from '@/design';
import { ROLE_LABEL, type KitPalette, type PitchRole } from '../shared/kit';
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
 * thing that is.
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
  /** The short name of the side the player manages. */
  ourName: string;
  drama: string | null;
  impactKey: string | null;
  /** 0-1. A goal for the managed side lands harder than one against it. */
  impactStrength?: number;
  className?: string;
}

const CAMERAS: readonly PitchCamera[] = ['WIDE', 'FOLLOW'];
const ROLE_KEY: readonly PitchRole[] = ['DEF', 'MID', 'ATT'];

export const PitchStage = memo(function PitchStage({
  homePalette, awayPalette, playerSide, numbers, keepers, roles, camera, onCamera,
  ourName, drama, impactKey, impactStrength = 1, className,
}: PitchStageProps): ReactNode {
  const m = useDesignMotion();
  const ours = playerSide === 'home' ? homePalette : awayPalette;

  return (
    <section
      className={cn('relative w-full overflow-hidden rounded-lg', className)}
      aria-label="Live pitch"
    >
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
        className="h-full w-full"
      />

      {/* --- camera ---------------------------------------------------- */}
      <div
        role="radiogroup"
        aria-label="Camera"
        className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-pill bg-void/70 p-0.5"
      >
        {CAMERAS.map((mode) => {
          const selected = mode === camera;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${CAMERA_LABEL[mode]} camera. ${CAMERA_HINT[mode]}`}
              onClick={() => {
                if (selected) return;
                haptics.selection();
                onCamera(mode);
              }}
              className={cn(
                'min-h-11 rounded-pill px-3 text-[11px] font-bold uppercase tracking-[0.12em]',
                'outline-none transition-colors duration-[var(--duration-fast)]',
                'focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                selected ? 'bg-white/16 text-ink' : 'text-ink-dim hover:text-ink-muted',
              )}
            >
              {CAMERA_LABEL[mode]}
            </button>
          );
        })}
      </div>

      {/* --- the drama banner ------------------------------------------ */}
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

      {/* --- orientation and the colour key ---------------------------- */}
      <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-end justify-between gap-2">
        {/* The club's colour is a swatch, never the ink: half the kits in the
            league would fail contrast as text on this scrim. */}
        <span className="flex items-center gap-1.5 rounded-pill bg-void/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
          <span
            aria-hidden="true"
            className="block size-2 rounded-pill ring-1 ring-white/25"
            style={{ background: ours.primary }}
          />
          {ourName} attack →
        </span>
        <ul className="flex items-center gap-2 rounded-pill bg-void/70 px-2.5 py-1">
          {ROLE_KEY.map((role) => (
            <li key={role} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="block size-2 rounded-pill"
                style={{ background: ours.plate[role] }}
              />
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-dim">
                {ROLE_LABEL[role]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
