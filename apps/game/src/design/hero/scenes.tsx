import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';
import { SeedStream } from '../seed';
import { useSvgId } from '../useSvgId';

/**
 * The three rooms the product is ever set in: a ground at dusk before anything
 * has happened, the same ground after you won, and the same ground after you
 * did not.
 *
 * Drawn rather than photographed, for the reason every other art system here
 * is: this build ships no image files. A 1179×2556 stadium plate would be the
 * largest asset in the bundle, wrong at every aspect ratio, impossible to tint
 * warm for a win and cold for a defeat, and — the part that actually matters —
 * a 404 away from a screen with a hole in it. Gradients and one SVG are a few
 * hundred bytes, sharp at any density, and the same geometry carries all three
 * moods by swapping a palette.
 *
 * Everything here is atmosphere and nothing here is information, which sets
 * both of the rules it obeys:
 *
 * - **Text never sits on it.** The scene lives behind glass, and the scrim at
 *   the end of the drawing is not decoration — it is what keeps `ink-muted`
 *   legible over the brightest part of the composition. The palettes stay in
 *   the `#050607`–`#0E1013` range for the same reason.
 * - **It is the first thing to go.** Under reduced transparency, or the in-app
 *   "Reduce effects" setting, `tokens.css` hides the drawing and the wrapper's
 *   solid fill is what remains. No layout shifts, because the wrapper was
 *   always the full-bleed element and the art was always inside it.
 *
 * Cost discipline: one paint, no blur, no filter, no per-frame work. The single
 * animation is an opacity breath on the floodlight glow, expressed as a CSS
 * keyframe so the global `prefers-reduced-motion` rule flattens it without this
 * component knowing anything about the preference.
 */

export type HeroSceneVariant = 'title' | 'triumph' | 'consolation';

export interface HeroSceneProps {
  /** Which mood to draw. */
  variant?: HeroSceneVariant;
  /**
   * Seeds the crowd scatter. Same seed, same crowd — so a result screen does
   * not reshuffle its stands on every re-render, and a screenshot is reusable.
   */
  seed?: string;
  className?: string;
}

interface SceneSpec {
  /** Four stops of the sky, floor to floor. */
  readonly sky: readonly [string, string, string, string];
  /** Colour of the light the floodlights throw. */
  readonly light: string;
  readonly lightAlpha: number;
  /** The one accent line allowed on the scene. */
  readonly accent: string;
  readonly accentAlpha: number;
  /** Bokeh tints, sampled per dot. */
  readonly crowd: readonly [string, string, string];
  /** Glow off the pitch surface. */
  readonly pitch: string;
  readonly pitchAlpha: number;
  /** What is left when the drawing is removed. */
  readonly solid: string;
  /** Upward light rays — a win, and only a win. */
  readonly rays: boolean;
  /** Rain suggestion — a defeat, and only a defeat. */
  readonly rain: boolean;
}

/**
 * Palettes, not compositions. The bowl, the floodlights and the pitch are the
 * same objects in all three; what changes is the temperature of the light and
 * what is falling through it.
 */
const SCENES: Record<HeroSceneVariant, SceneSpec> = {
  /** Dusk, cold, expensive. The product's first frame. */
  title: {
    sky: ['#050607', '#080D14', '#0A1119', '#050607'],
    light: '#D6E8FF',
    lightAlpha: 0.3,
    accent: '#C8FF2E',
    accentAlpha: 0.55,
    crowd: ['#BED2EB', '#8FA3BC', '#C8FF2E'],
    pitch: '#78B482',
    pitchAlpha: 0.14,
    solid: '#050607',
    rays: false,
    rain: false,
  },
  /**
   * Warmer and one stop brighter, never bright. The gold is doing the work of
   * a confetti cannon without any of the pixels one would cost.
   */
  triumph: {
    sky: ['#07070A', '#141007', '#1A1309', '#07060A'],
    light: '#FFD76A',
    lightAlpha: 0.34,
    accent: '#FFD76A',
    accentAlpha: 0.6,
    crowd: ['#FFD76A', '#FFF0C4', '#C8FF2E'],
    pitch: '#B8862B',
    pitchAlpha: 0.17,
    solid: '#0A0806',
    rays: true,
    rain: false,
  },
  /**
   * Cooler, dimmer, and the crowd has gone quiet — the bokeh loses its accent
   * tint entirely. Muted rather than sad: the screen still has to be readable
   * by somebody who is annoyed.
   */
  consolation: {
    sky: ['#04060A', '#080C12', '#0A1016', '#04060A'],
    light: '#9EB2C8',
    lightAlpha: 0.16,
    accent: '#7C8CFF',
    accentAlpha: 0.3,
    crowd: ['#7E8DA0', '#5C6675', '#93A3B8'],
    pitch: '#5A6E78',
    pitchAlpha: 0.1,
    solid: '#05070A',
    rays: false,
    rain: true,
  },
};

/* --- geometry ---------------------------------------------------------- */

/** The drawing is authored in this box and cropped, never letterboxed. */
const W = 400;
const H = 800;
/** Where the far stand's rim sits at the centre of frame, and at the edges. */
const RIM_CENTRE = 336;
const RIM_EDGE = 404;
/** Where the stand meets the grass. */
const STAND_FOOT = 496;

/**
 * The rim of the bowl: lowest in the middle of the frame, sweeping up towards
 * both touchlines. A parabola rather than a mirrored pair of straight lines,
 * because the straight version reads as a roofline and the curve reads as a
 * ground.
 */
export function rimAt(x: number): number {
  const t = Math.min(1, Math.abs(x - W / 2) / 230);
  return RIM_CENTRE + (RIM_EDGE - RIM_CENTRE) * t * t;
}

export interface BokehDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly opacity: number;
  readonly tint: string;
}

/**
 * A crowd is a frequency, not a set of people.
 *
 * Seeded so the stands are stable across re-renders — a scatter that reshuffles
 * every time React re-runs the component is the single most obvious way a
 * procedural backdrop announces itself as procedural. Counter-based channels
 * (rather than a running stream) mean adding a future layer between two
 * existing ones will not move a single dot.
 *
 * Capped at 80 nodes. Past that the browser is paying for detail nobody can
 * resolve at this scale behind a scrim.
 */
export function heroBokeh(
  seed: string,
  tints: readonly [string, string, string],
  count = 72,
): BokehDot[] {
  const stream = new SeedStream(`hero-bokeh:${seed}`);
  const n = Math.max(0, Math.min(80, Math.floor(count)));
  const dots: BokehDot[] = [];

  for (let i = 0; i < n; i += 1) {
    const x = stream.range(`x${i}`, -14, W + 14);
    const rim = rimAt(x);
    // Depth into the stand, biased towards the front rows where the light is.
    const depth = stream.channel(`d${i}`) ** 0.7;
    const y = rim + 6 + depth * Math.max(8, STAND_FOOT - rim - 12);
    // The accent tint is rare on purpose: the third colour is a spark in the
    // crowd, not a third of the crowd.
    const tint = stream.chance(`a${i}`, 0.14)
      ? tints[2]
      : stream.chance(`b${i}`, 0.55)
        ? tints[0]
        : tints[1];
    dots.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      r: Math.round(stream.range(`r${i}`, 0.9, 2.5) * 100) / 100,
      // Front rows catch the floodlights; the back of the stand falls away.
      opacity: Math.round((0.5 - depth * 0.3) * 1000) / 1000,
      tint,
    });
  }
  return dots;
}

export interface RainStreak {
  readonly x: number;
  readonly y: number;
  readonly len: number;
  readonly opacity: number;
}

/** Weather as a suggestion: enough streaks to read as rain, not as static. */
export function heroRain(seed: string, count = 26): RainStreak[] {
  const stream = new SeedStream(`hero-rain:${seed}`);
  const n = Math.max(0, Math.min(40, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(stream.range(`x${i}`, -30, W + 30) * 10) / 10,
    y: Math.round(stream.range(`y${i}`, -40, H) * 10) / 10,
    len: Math.round(stream.range(`l${i}`, 26, 74)),
    opacity: Math.round(stream.range(`o${i}`, 0.04, 0.13) * 1000) / 1000,
  }));
}

/* --- component --------------------------------------------------------- */

const rgba = (hex: string, alpha: number): string => {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.replace(/./g, (c) => c + c) : v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export function HeroScene({
  variant = 'title',
  seed = variant,
  className,
}: HeroSceneProps): ReactNode {
  const spec = SCENES[variant];
  const id = useSvgId('scene');
  const dots = heroBokeh(seed, spec.crowd);
  const rain = spec.rain ? heroRain(seed) : [];

  return (
    <div
      aria-hidden="true"
      data-variant={variant}
      className={cn('hero-scene pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ backgroundColor: spec.solid } as CSSProperties}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="hero-scene-art absolute inset-0 h-full w-full"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={spec.sky[0]} />
            <stop offset="36%" stopColor={spec.sky[1]} />
            <stop offset="54%" stopColor={spec.sky[2]} />
            <stop offset="100%" stopColor={spec.sky[3]} />
          </linearGradient>

          {/* One radial does every glow in the drawing; the elements that use
              it vary only in size and opacity. */}
          <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={rgba(spec.light, spec.lightAlpha)} />
            <stop offset="55%" stopColor={rgba(spec.light, spec.lightAlpha * 0.3)} />
            <stop offset="100%" stopColor={rgba(spec.light, 0)} />
          </radialGradient>

          {/* The volume of a floodlight beam, falling towards the grass. */}
          <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rgba(spec.light, spec.lightAlpha * 0.55)} />
            <stop offset="100%" stopColor={rgba(spec.light, 0)} />
          </linearGradient>

          {/* The stand itself: a dark mass, slightly lighter where the light
              lands on its rim. */}
          <linearGradient id={`${id}-stand`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rgba(spec.light, 0.022)} />
            <stop offset="14%" stopColor="rgba(9, 13, 19, 0.94)" />
            <stop offset="100%" stopColor="rgba(5, 7, 10, 1)" />
          </linearGradient>

          <linearGradient id={`${id}-pitch`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rgba(spec.pitch, spec.pitchAlpha)} />
            <stop offset="46%" stopColor={rgba(spec.pitch, spec.pitchAlpha * 0.28)} />
            <stop offset="100%" stopColor={rgba(spec.pitch, 0)} />
          </linearGradient>

          {/* Rays are brightest at the pitch and dissolve upward. */}
          <linearGradient id={`${id}-ray`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={rgba(spec.accent, 0.09)} />
            <stop offset="100%" stopColor={rgba(spec.accent, 0)} />
          </linearGradient>

          {/* Not decoration. This is the layer that makes the type legible. */}
          <linearGradient id={`${id}-scrim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(5, 6, 7, 0.74)" />
            <stop offset="26%" stopColor="rgba(5, 6, 7, 0.3)" />
            <stop offset="52%" stopColor="rgba(5, 6, 7, 0.2)" />
            <stop offset="80%" stopColor="rgba(5, 6, 7, 0.66)" />
            <stop offset="100%" stopColor="rgba(5, 6, 7, 0.96)" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill={`url(#${id}-sky)`} />

        {/* Two banks, deliberately not a mirrored pair — symmetry reads as a
            logo rather than as a ground. */}
        <g className="hero-scene-flood">
          <ellipse cx="62" cy="196" rx="196" ry="176" fill={`url(#${id}-glow)`} />
          <ellipse cx="342" cy="176" rx="168" ry="150" fill={`url(#${id}-glow)`} opacity="0.8" />
          <polygon
            points={`34,252 92,252 226,${STAND_FOOT} -46,${STAND_FOOT}`}
            fill={`url(#${id}-beam)`}
            opacity="0.5"
          />
          <polygon
            points={`312,236 366,236 442,${STAND_FOOT} 186,${STAND_FOOT}`}
            fill={`url(#${id}-beam)`}
            opacity="0.36"
          />
          {/* The pylons. Small heads, because a stadium is mostly the dark, and
              masts that run down into the bowl — they are drawn before the
              stand so the stand occludes them, which is what stops the lamps
              reading as two rectangles floating in the sky. */}
          <g fill={rgba(spec.light, 0.05)}>
            <rect x="61" y="252" width="3" height="150" />
            <rect x="338" y="236" width="2.5" height="160" />
          </g>
          <g fill={rgba(spec.light, Math.min(0.55, spec.lightAlpha * 1.5))}>
            <rect x="42" y="246" width="42" height="6" rx="2" />
            <rect x="320" y="230" width="38" height="5.5" rx="2" />
          </g>
        </g>

        {spec.rays && (
          <g>
            {[-26, -13, 0, 13, 26].map((angle) => (
              <polygon
                key={angle}
                points={`${W / 2 - 26},${STAND_FOOT + 40} ${W / 2 + 26},${STAND_FOOT + 40} ${W / 2 + 74},-90 ${W / 2 - 74},-90`}
                fill={`url(#${id}-ray)`}
                transform={`rotate(${angle} ${W / 2} ${STAND_FOOT + 40})`}
                opacity="0.32"
              />
            ))}
          </g>
        )}

        {/* The bowl. The control point is derived rather than eyeballed: a
            quadratic Bézier with level endpoints *is* a parabola, so this one
            traces `rimAt` exactly and the crowd sits in the stand instead of
            floating above its middle. */}
        <path
          d={`M -20 ${rimAt(-20)} Q ${W / 2} ${2 * RIM_CENTRE - rimAt(-20)} ${W + 20} ${rimAt(W + 20)} L ${W + 20} ${STAND_FOOT + 8} L -20 ${STAND_FOOT + 8} Z`}
          fill={`url(#${id}-stand)`}
        />

        {/* Two tiers. Without them the bowl is one smooth mass and reads as a
            hill; a pair of hairlines following the same parabola is all the
            architecture it needs at this scale. */}
        <g fill="none" stroke={rgba(spec.light, 0.05)} strokeWidth="0.8">
          {[34, 72].map((drop) => (
            <path
              key={drop}
              d={`M -20 ${rimAt(-20) + drop} Q ${W / 2} ${2 * RIM_CENTRE - rimAt(-20) + drop} ${W + 20} ${rimAt(W + 20) + drop}`}
            />
          ))}
        </g>

        {/* The crowd. */}
        <g>
          {dots.map((dot, i) => (
            <circle
              // Position is the identity of a dot; the index disambiguates the
              // rare pair that lands on the same rounded coordinate.
              key={`${dot.x}:${dot.y}:${i}`}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill={dot.tint}
              opacity={dot.opacity}
            />
          ))}
        </g>

        {/* Cold air over a lit pitch. Deliberately almost invisible. */}
        <ellipse
          cx={W / 2}
          cy={STAND_FOOT - 6}
          rx={W * 0.86}
          ry="58"
          fill={`url(#${id}-glow)`}
          opacity="0.5"
        />

        {/* The grass, as light rather than as texture: at this crop the pitch
            is a glow under the camera, and drawing mown stripes here would put
            a repeating pattern directly behind the copy. A band rather than an
            ellipse — an ellipse wide enough to fill the foreground still shows
            its own top edge, and a visible arc across the bottom of the screen
            reads as a hill. */}
        <rect
          x="0"
          y={STAND_FOOT + 8}
          width={W}
          height={H - STAND_FOOT - 8}
          fill={`url(#${id}-pitch)`}
        />

        {rain.length > 0 && (
          <g stroke={rgba('#C8D6EB', 1)} strokeWidth="0.7" strokeLinecap="round">
            {rain.map((streak) => (
              <line
                key={`${streak.x}:${streak.y}`}
                x1={streak.x}
                y1={streak.y}
                x2={streak.x - streak.len * 0.18}
                y2={streak.y + streak.len}
                opacity={streak.opacity}
              />
            ))}
          </g>
        )}

        {/* The lit far touchline: the stand and the grass meet in light rather
            than at a seam. One accent line, and it is the only place the
            accent appears in the whole scene. */}
        <line
          x1="0"
          y1={STAND_FOOT + 8}
          x2={W}
          y2={STAND_FOOT + 8}
          stroke={rgba(spec.accent, spec.accentAlpha)}
          strokeWidth="1"
          opacity="0.7"
        />
        <line
          x1="46"
          y1={STAND_FOOT + 34}
          x2={W - 46}
          y2={STAND_FOOT + 34}
          stroke={rgba(spec.light, 0.14)}
          strokeWidth="0.8"
        />

        <rect width={W} height={H} fill={`url(#${id}-scrim)`} />
      </svg>
    </div>
  );
}
