import { memo, type ReactNode } from 'react';
import { cn } from '../cn';
import { useSvgId } from '../useSvgId';

/**
 * Procedural silverware.
 *
 * The trophy is the product's biggest moment and until now it was a 24px line
 * icon scaled to 112px — a stroke drawing asked to carry the payoff for a
 * decade of play. This module draws the real thing: layered gold with a
 * plinth, an engraving band and exactly one specular sheen, in the same
 * broadcast-graphics register as the rest of the dark-glass surface.
 *
 * It stays *procedural* for the same reason the crests do: no file means no
 * 404, no licensing, no loading state in front of the moment that matters. The
 * geometry is hand-authored per variant rather than seeded, because there are
 * five trophies in the universe and they should be recognisable, not random.
 *
 * Variants map onto what the engine can actually award:
 *  - `league`   — the champion cup. The Creator League title (`format: LEAGUE`).
 *  - `cup`      — knockout silverware (`format: CUP`), lidded and squat.
 *  - `superCup` — the one-off / playoff salver (`format: PLAYOFF`).
 *  - `boot`     — individual award, backed by the `PLAYER_SEASON_GOALS` record.
 *  - `legacy`   — the dynasty monolith: repeat titles, legends, a career.
 *
 * Every gradient id is namespaced through `useSvgId`, so a cabinet grid of
 * twenty of these does not collapse into whichever instance mounted last.
 */

export type SilverwareVariant = 'league' | 'cup' | 'superCup' | 'boot' | 'legacy';

export const SILVERWARE_VARIANTS: readonly SilverwareVariant[] = [
  'league', 'cup', 'superCup', 'boot', 'legacy',
] as const;

/** Human label, used for the default accessible name. */
export const SILVERWARE_LABELS: Record<SilverwareVariant, string> = {
  league: 'League title trophy',
  cup: 'Cup trophy',
  superCup: 'Super cup salver',
  boot: 'Golden boot award',
  legacy: 'Legacy trophy',
};

/**
 * Pick the silverware for a competition or award name.
 *
 * The engine stores a trophy as a free-text competition name
 * (`legacy.trophies[].competition`), so this is deliberately forgiving: an
 * unknown name lands on the champion cup rather than on nothing.
 */
export function silverwareVariantFor(name: string | null | undefined): SilverwareVariant {
  const text = (name ?? '').toLowerCase();
  if (!text) return 'league';
  if (/boot|scorer|goalscor|player of the/.test(text)) return 'boot';
  if (/super|shield|charity|curtain|salver|playoff|play-off/.test(text)) return 'superCup';
  if (/\bcup\b|knockout|final/.test(text)) return 'cup';
  if (/legacy|dynasty|legend|hall of fame|era/.test(text)) return 'legacy';
  return 'league';
}

/* --- palette ---------------------------------------------------------- */

/**
 * Trophy gold, `#B8862B → #FFD76A` per the style guide, exploded into the six
 * stops a metal needs to read as metal: two shadowed edges, a bright core, and
 * a cooler mid on the turn. Flat gold looks like plastic; a two-stop ramp looks
 * like a gradient. Six stops looks like a spun cup under stadium light.
 */
const GOLD_STOPS: readonly (readonly [string, string])[] = [
  ['0%', '#7a5716'],
  ['16%', '#b8862b'],
  ['38%', '#ffd76a'],
  ['52%', '#fff0c4'],
  ['74%', '#d8a441'],
  ['100%', '#8a6320'],
];

const ENGRAVE = '#0b0d10';
const VOLT = '#c8ff2e';

/**
 * A five-pointed star, computed rather than hand-plotted. Stars drawn by eye in
 * path data are always subtly lopsided, and lopsided is exactly what separates
 * a broadcast graphic from clip art.
 */
function starPath(cx: number, cy: number, outer: number, inner = outer * 0.42): string {
  const parts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((i * 36 - 90) * Math.PI) / 180;
    const x = (cx + Math.cos(angle) * radius).toFixed(2);
    const y = (cy + Math.sin(angle) * radius).toFixed(2);
    parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  return `${parts.join(' ')} Z`;
}

/* --- shared pieces ---------------------------------------------------- */

interface Ids {
  gold: string;
  goldSoft: string;
  sheen: string;
  plinth: string;
}

function Defs({ ids }: { ids: Ids }): ReactNode {
  return (
    <defs>
      <linearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="0.18">
        {GOLD_STOPS.map(([offset, color]) => (
          <stop key={offset} offset={offset} stopColor={color} />
        ))}
      </linearGradient>
      {/* Vertical ramp for horizontal parts (lids, rims, feet) so the light
          direction stays consistent instead of banding across the piece. */}
      <linearGradient id={ids.goldSoft} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffe49a" />
        <stop offset="46%" stopColor="#d3a03e" />
        <stop offset="100%" stopColor="#8a6320" />
      </linearGradient>
      {/* The one specular sheen. One. */}
      <linearGradient id={ids.sheen} x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={ids.plinth} x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#2a3038" />
        <stop offset="55%" stopColor="#161a1f" />
        <stop offset="100%" stopColor="#0b0d10" />
      </linearGradient>
    </defs>
  );
}

/**
 * The plinth. Shared by every variant on purpose: the base is what makes five
 * different silhouettes read as one cabinet, and it is where the club's story
 * is engraved.
 */
function Plinth({ ids, detail }: { ids: Ids; detail: boolean }): ReactNode {
  return (
    <g>
      {/* contact shadow — the trophy has to sit *on* something */}
      <ellipse cx="50" cy="129" rx="40" ry="4" fill="#000000" opacity="0.5" />
      <rect x="18" y="116" width="64" height="13" rx="3" fill={`url(#${ids.plinth})`} />
      <rect x="26" y="106" width="48" height="11" rx="2.5" fill={`url(#${ids.plinth})`} />
      {/* gold collar between the two tiers */}
      <rect x="26" y="104.6" width="48" height="2.4" rx="1.2" fill={`url(#${ids.goldSoft})`} />
      {detail && (
        <>
          {/* engraving band: recessed panel + two ruled lines standing in for
              the club name and season, plus a single volt tick as the only
              non-gold colour anywhere on the piece */}
          <rect x="24" y="119" width="52" height="7" rx="1.6" fill={ENGRAVE} opacity="0.85" />
          <rect x="28" y="121" width="30" height="1.2" rx="0.6" fill="#ffd76a" opacity="0.5" />
          <rect x="28" y="123.6" width="20" height="1" rx="0.5" fill="#ffd76a" opacity="0.28" />
          <rect x="68" y="121" width="4" height="3.6" rx="1" fill={VOLT} opacity="0.75" />
          <rect x="18" y="116" width="64" height="1.4" rx="0.7" fill="#ffffff" opacity="0.1" />
        </>
      )}
    </g>
  );
}

/** Tapered foot that carries a stem down onto the plinth. */
function Foot({ ids, top, width = 30 }: { ids: Ids; top: number; width?: number }): ReactNode {
  const half = width / 2;
  return (
    <g>
      <path
        d={`M${50 - half} ${top} H${50 + half} L${50 + half + 5} 104.6 H${50 - half - 5} Z`}
        fill={`url(#${ids.gold})`}
      />
      <rect x={50 - half - 5} y={top + 1} width={width + 10} height="1.2" fill="#000000" opacity="0.22" />
    </g>
  );
}

/* --- variants (100 × 132 box, plinth occupies y 104–129) --------------- */

function LeagueCup({ ids, detail }: { ids: Ids; detail: boolean }): ReactNode {
  // A tall fluted chalice with swept handles: the silhouette people picture
  // when they picture "the trophy".
  const bowl = 'M27 30 H73 C73 44 71.5 57 66 67 C61.5 75.4 56 81.6 50 86 C44 81.6 38.5 75.4 34 67 C28.5 57 27 44 27 30 Z';
  return (
    <g>
      {/* handles first so they sit behind the bowl edge */}
      <g fill="none" stroke={`url(#${ids.gold})`} strokeWidth="5.4" strokeLinecap="round">
        <path d="M28 34 C12 34 6.5 50 14 60 C17 64 21 66 25.5 66" />
        <path d="M72 34 C88 34 93.5 50 86 60 C83 64 79 66 74.5 66" />
      </g>
      <path d={bowl} fill={`url(#${ids.gold})`} />
      {detail && (
        <g opacity="0.5">
          {/* fluting: three recessed channels that give the bowl its volume */}
          <path d="M38 34 C38.6 50 41 64 45 76" stroke="#7a5716" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M50 34 V80" stroke="#7a5716" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M62 34 C61.4 50 59 64 55 76" stroke="#7a5716" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      )}
      {/* rim: the brightest band on the piece */}
      <rect x="24.5" y="25" width="51" height="7" rx="3.5" fill={`url(#${ids.goldSoft})`} />
      <rect x="24.5" y="25" width="51" height="2" rx="1" fill="#fff3d0" opacity="0.7" />
      {/* stem + knop */}
      <path d="M45.5 86 H54.5 L53 94 H47 Z" fill={`url(#${ids.gold})`} />
      <ellipse cx="50" cy="95.5" rx="7.5" ry="3.2" fill={`url(#${ids.goldSoft})`} />
      <Foot ids={ids} top={97} width={26} />
      {detail && (
        <path
          d="M33 32 C33.6 48 36 62 41 73 C36 66 31.5 52 31 32 Z"
          fill={`url(#${ids.sheen})`}
        />
      )}
    </g>
  );
}

function KnockoutCup({ ids, detail }: { ids: Ids; detail: boolean }): ReactNode {
  // Squat, wide, lidded, with closed ring handles — read at a glance as "the
  // other trophy" next to the league cup rather than as the same shape resized.
  return (
    <g>
      {/* finial */}
      <circle cx="50" cy="13" r="5.4" fill={`url(#${ids.gold})`} />
      <rect x="48.6" y="17" width="2.8" height="4" fill={`url(#${ids.goldSoft})`} />
      {/* domed lid */}
      <path d="M31 34 C31 24 39 20.5 50 20.5 C61 20.5 69 24 69 34 Z" fill={`url(#${ids.gold})`} />
      <rect x="28" y="33.5" width="44" height="5.6" rx="2.8" fill={`url(#${ids.goldSoft})`} />
      {/* ring handles, behind the bowl */}
      <g fill="none" stroke={`url(#${ids.gold})`} strokeWidth="4.6">
        <ellipse cx="21" cy="56" rx="10" ry="12" />
        <ellipse cx="79" cy="56" rx="10" ry="12" />
      </g>
      {/* bowl */}
      <path
        d="M28.5 39 H71.5 C71.5 58 64 74 50 82 C36 74 28.5 58 28.5 39 Z"
        fill={`url(#${ids.gold})`}
      />
      {detail && (
        <>
          <rect x="33" y="46" width="34" height="9" rx="2" fill={ENGRAVE} opacity="0.55" />
          <rect x="36" y="49.5" width="28" height="1.4" rx="0.7" fill="#ffd76a" opacity="0.45" />
          <path d={starPath(50, 68, 11)} fill="#fff0c4" opacity="0.3" />
        </>
      )}
      <path d="M46 82 H54 L52.5 92 H47.5 Z" fill={`url(#${ids.gold})`} />
      <Foot ids={ids} top={92} width={24} />
      {detail && (
        <path d="M33 40 C33.6 56 38 70 45 78 C37 73 31.5 58 31 40 Z" fill={`url(#${ids.sheen})`} />
      )}
    </g>
  );
}

function SuperCupSalver({ ids, detail }: { ids: Ids; detail: boolean }): ReactNode {
  // Not a cup at all: a shield-salver on a low stand. The format difference is
  // the point — a super cup that looks like the league cup teaches the player
  // nothing.
  const shield = 'M50 14 L84 25 V52 C84 74 69 89 50 97 C31 89 16 74 16 52 V25 Z';
  return (
    <g>
      <path d={shield} fill={`url(#${ids.gold})`} />
      <path
        d="M50 21 L78 30 V52 C78 70 65.5 83 50 90 C34.5 83 22 70 22 52 V30 Z"
        fill={ENGRAVE}
        opacity="0.42"
      />
      {detail && (
        <>
          {/* radial star: eight bars, geometric, not heraldic */}
          <path d={starPath(50, 53, 21, 8.8)} fill="#ffd76a" opacity="0.9" />
          <circle cx="50" cy="53" r="6.4" fill={ENGRAVE} opacity="0.6" />
          <circle cx="50" cy="53" r="2.6" fill={VOLT} opacity="0.55" />
          <rect x="30" y="78" width="40" height="5" rx="1.6" fill={ENGRAVE} opacity="0.6" />
        </>
      )}
      {/* the stand */}
      <path d="M42 96 H58 L56 102 H44 Z" fill={`url(#${ids.gold})`} />
      <Foot ids={ids} top={101} width={22} />
      {detail && <path d="M22 27 L46 19 L30 34 V70 C24 60 21.5 44 22 27 Z" fill={`url(#${ids.sheen})`} />}
    </g>
  );
}

function GoldenBoot({ ids, detail }: { ids: Ids; detail: boolean }): ReactNode {
  // The individual award. Mounted at an angle on a slim post, which is what
  // separates a trophy boot from a shop boot.
  return (
    <g>
      <g transform="rotate(-14 50 54)">
        {/* sole */}
        <path
          d="M17 66 C17 71 20 74 26 74 H72 C79 74 83 70.5 83 65.5 C83 61 79.5 58.5 73 58 L17 58 Z"
          fill={`url(#${ids.goldSoft})`}
        />
        {/* upper */}
        <path
          d="M20 58 C19 48 21 40 26 35 C31 30 38 29 44 32 C50 35 55 40 63 44 C71 48 79 50 82 56 C83.4 58.6 82.6 60 79 60 H22 C20.4 60 20 59.4 20 58 Z"
          fill={`url(#${ids.gold})`}
        />
        {detail && (
          <>
            {/* laces: four bars across the instep */}
            <g stroke="#7a5716" strokeWidth="1.7" strokeLinecap="round" opacity="0.55">
              <path d="M33 36 L41 41" />
              <path d="M31 41 L39 46" />
              <path d="M30 46 L37.5 51" />
              <path d="M29.5 51 L36 55" />
            </g>
            {/* studs */}
            <g fill="#8a6320" opacity="0.75">
              <circle cx="26" cy="71" r="2.2" />
              <circle cx="41" cy="71.5" r="2.2" />
              <circle cx="58" cy="71.5" r="2.2" />
              <circle cx="72" cy="70.5" r="2.2" />
            </g>
            <path d="M24 36 C21 44 20.6 51 21.6 58 H26 C25 50 25.6 43 28.6 34.6 Z" fill={`url(#${ids.sheen})`} />
          </>
        )}
      </g>
      {/* post */}
      <rect x="46.5" y="76" width="7" height="22" rx="2" fill={`url(#${ids.gold})`} />
      <Foot ids={ids} top={97} width={20} />
    </g>
  );
}

function LegacyMonolith({ ids, detail }: { ids: Ids; detail: boolean }): ReactNode {
  // Dynasty. A tapered column with a star per era stacked up it — the only
  // variant that is meant to look *counted* rather than won once.
  return (
    <g>
      <path d="M50 8 L64 22 V96 H36 V22 Z" fill={`url(#${ids.gold})`} />
      <path d="M50 8 L64 22 H36 Z" fill={`url(#${ids.goldSoft})`} />
      {detail && (
        <>
          <rect x="39" y="28" width="22" height="62" rx="2" fill={ENGRAVE} opacity="0.5" />
          <g fill="#ffd76a" opacity="0.85">
            {[42, 58, 74].map((y) => (
              <path key={y} d={starPath(50, y, 8.4)} />
            ))}
          </g>
          <rect x="39" y="86" width="22" height="1.4" rx="0.7" fill={VOLT} opacity="0.5" />
          <path d="M40 24 L50 12 V22 L44 30 V92 H40 Z" fill={`url(#${ids.sheen})`} />
        </>
      )}
      <rect x="33" y="94" width="34" height="5" rx="1.6" fill={`url(#${ids.goldSoft})`} />
      <Foot ids={ids} top={98} width={28} />
    </g>
  );
}

const RENDERERS: Record<SilverwareVariant, (props: { ids: Ids; detail: boolean }) => ReactNode> = {
  league: LeagueCup,
  cup: KnockoutCup,
  superCup: SuperCupSalver,
  boot: GoldenBoot,
  legacy: LegacyMonolith,
};

/* --- the component ---------------------------------------------------- */

export interface SilverwareProps {
  variant?: SilverwareVariant;
  /** Rendered height in px. Width follows the 100 × 132 box. */
  size?: number;
  /**
   * Announced name. Omit inside an already-labelled row or button and the
   * piece is marked decorative instead of read out twice.
   */
  label?: string;
  /**
   * Force the detail pass on or off. By default anything under 34px drops
   * fluting, engraving and the sheen, because at list-glyph sizes those layers
   * turn into mud and cost fill-rate for nothing.
   */
  detail?: boolean;
  /** Gold bloom behind the piece. Off in lists, on for hero staging. */
  glow?: boolean;
  className?: string;
}

const RATIO = 100 / 132;

function SilverwareInner({
  variant = 'league', size = 64, label, detail, glow = false, className,
}: SilverwareProps): ReactNode {
  const base = useSvgId('cf-silver');
  const ids: Ids = {
    gold: `${base}-gold`,
    goldSoft: `${base}-goldsoft`,
    sheen: `${base}-sheen`,
    plinth: `${base}-plinth`,
  };
  const showDetail = detail ?? size >= 34;
  const Piece = RENDERERS[variant] ?? LeagueCup;

  return (
    <svg
      viewBox="0 0 100 132"
      width={Math.round(size * RATIO)}
      height={size}
      className={cn('block shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Defs ids={ids} />
      {glow && (
        <ellipse cx="50" cy="66" rx="52" ry="58" fill="#ffd76a" opacity="0.12" />
      )}
      <Piece ids={ids} detail={showDetail} />
      <Plinth ids={ids} detail={showDetail} />
    </svg>
  );
}

/**
 * A single piece of silverware. Memoised: the trophy room renders one per
 * trophy per render and none of them ever change.
 */
export const Silverware = memo(SilverwareInner);
Silverware.displayName = 'Silverware';
