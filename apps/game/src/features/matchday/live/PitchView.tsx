import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PlayPhase, Side } from '@cf/engine';
import { cn, useReducedMotionPreference } from '@/design';
import { useMatchStore } from '@/state/matchStore';
import { PHASE_HINT, PHASE_LABEL } from '../shared/format';
import type { KitPalette, PitchRole } from '../shared/kit';
import {
  PitchRenderer,
  type PitchCamera, type PitchLabelMode, type PitchOrientation,
} from './pitchRenderer';

/**
 * The React shell around the canvas renderer.
 *
 * Its entire job is to *not* re-render. It subscribes to the match store
 * outside React's render cycle and pushes frames straight into the renderer, so
 * a running match costs this component zero reconciliations. The only piece of
 * React state here is the play phase, which changes a handful of times a minute
 * and drives one text pill.
 *
 * Set `?pitchprofile` on the URL to get the draw-cost overlay.
 */

export interface PitchViewProps {
  homePalette: KitPalette;
  awayPalette: KitPalette;
  playerSide: Side;
  numbers: Readonly<Record<string, number>>;
  keepers: Readonly<Record<string, boolean>>;
  roles: Readonly<Record<string, PitchRole>>;
  orientation: PitchOrientation;
  camera: PitchCamera;
  /** playerId -> surname, for the labelled modes. */
  names?: Readonly<Record<string, string>>;
  /** playerId -> live match rating. */
  ratings?: Readonly<Record<string, number>>;
  /** How the shirts are labelled. Owned by the parent so the control can live in the footer. */
  labelMode?: PitchLabelMode;
  /** Presentation-only emphasis while a genuinely important beat is running. */
  drama?: boolean;
  /**
   * Changes to a new value when a goal lands. The renderer answers with one
   * shake; nothing smaller than a goal is allowed to set it.
   */
  impactKey?: string | null;
  /** 0-1, how hard the one shake hits. */
  impactStrength?: number;
  className?: string;
}

const PROFILE = typeof window !== 'undefined' && window.location.search.includes('pitchprofile');

export const PitchView = memo(function PitchView({
  homePalette, awayPalette, playerSide, numbers, keepers, roles, orientation, camera,
  names, ratings, labelMode = 'NUMBERS',
  drama = false, impactKey = null, impactStrength = 1, className,
}: PitchViewProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PitchRenderer | null>(null);
  const reduced = useReducedMotionPreference();
  const [phase, setPhase] = useState<PlayPhase>('BUILD_UP');
  const [profile, setProfile] = useState('');

  // Renderer lifecycle. Deliberately keyed on nothing that changes mid-match:
  // recreating the renderer would throw away the interpolation state and make
  // every shirt teleport.
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const renderer = new PitchRenderer(canvas, {
      home: homePalette,
      away: awayPalette,
      playerSide,
      orientation,
      camera,
      names,
      ratings,
      labelMode,
      reducedMotion: reduced,
      numbers,
      keepers,
      roles,
    });
    rendererRef.current = renderer;

    const applySize = (): void => {
      const rect = host.getBoundingClientRect();
      // Cap the device pixel ratio at 2. A 3x phone gains nothing visible on
      // flat-colour geometry and pays 2.25x the fill cost for it.
      renderer.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
      const frame = useMatchStore.getState().frame;
      if (frame) renderer.setFrame(frame);
    };
    applySize();

    const observer = new ResizeObserver(applySize);
    observer.observe(host);

    let raf = 0;
    let profileAt = performance.now();
    const loop = (now: number): void => {
      renderer.tick(now);
      if (PROFILE && now - profileAt > 500) {
        profileAt = now;
        const s = renderer.stats();
        setProfile(`${s.avgDrawMs.toFixed(2)}ms/draw · ${s.frames} draws · step ${s.maxStep.toFixed(3)}`);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // The profiler hook the browser suite reads. Only exists when asked for.
    if (PROFILE) {
      (window as unknown as { __cfPitch?: unknown }).__cfPitch = {
        stats: () => renderer.stats(),
        positions: () => renderer.positions(),
      };
    }

    // A backgrounded match must not keep a canvas loop alive on a phone.
    const onVisibility = (): void => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let lastFrame = useMatchStore.getState().frame;
    if (lastFrame) renderer.setFrame(lastFrame);
    setPhase(lastFrame?.phase ?? 'BUILD_UP');

    const unsubscribe = useMatchStore.subscribe((state) => {
      const frame = state.frame;
      if (!frame || frame === lastFrame) return;
      lastFrame = frame;
      renderer.setFrame(frame);
      setPhase((current) => (current === frame.phase ? current : frame.phase));
    });

    return () => {
      unsubscribe();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(raf);
      if (PROFILE) delete (window as unknown as { __cfPitch?: unknown }).__cfPitch;
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Option changes are pushed in rather than remounting the renderer.
  useEffect(() => {
    rendererRef.current?.setOptions({
      home: homePalette, away: awayPalette, playerSide, orientation, camera,
      reducedMotion: reduced, numbers, keepers, roles, names, ratings, labelMode,
    });
  }, [homePalette, awayPalette, playerSide, orientation, camera, reduced, numbers, keepers, roles, names, ratings, labelMode]);

  useEffect(() => {
    rendererRef.current?.setDrama(drama);
  }, [drama]);

  useEffect(() => {
    if (impactKey) rendererRef.current?.impact(impactKey, impactStrength);
    // The strength travels with the key; a prop change alone must not re-shake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactKey]);

  return (
    <div
      ref={hostRef}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg bg-[var(--color-pitch-deep)]',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label="Animated pitch showing both teams' shape and the ball"
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-2 rounded-pill bg-void/60 px-2.5 py-1 text-micro font-bold uppercase tracking-[0.16em] text-ink-muted"
      >
        {PHASE_LABEL[phase]}
      </span>

      {/* The phase in words, for a screen reader and for reduced motion, where
          the animation is not doing the explaining. */}
      <p className="sr-only" aria-live="off">
        {PHASE_HINT[phase]}
      </p>

      {PROFILE && profile !== '' && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-xs bg-void/70 px-1.5 py-0.5 font-mono text-micro text-volt">
          {profile}
        </span>
      )}
    </div>
  );
});
