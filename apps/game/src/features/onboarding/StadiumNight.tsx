import type { ReactNode } from 'react';
import { cn, useDesignMotion, useSvgId } from '@/design';

/**
 * The cold open: a stadium at night, drawn rather than photographed.
 *
 * The beat sheet asks for a full-bleed hero and one line of copy, and what the
 * title screen had instead was a wordmark at the top, a button at the bottom
 * and roughly 750px of black in between. Black is not restraint, it is an
 * absent asset — the first twenty-five seconds are supposed to say "this looks
 * expensive" and a void says nothing at all.
 *
 * It is procedural for the same reason the crests are: this product ships no
 * image files, and a bitmap of a stadium would be the single largest asset in
 * the bundle, wrong at every aspect ratio, and impossible to tint. Everything
 * here is gradients and one small SVG — a few hundred bytes, sharp at any
 * density, and it takes the club palette if it is ever asked to.
 *
 * Cost discipline, because this is the first frame the player ever sees: no
 * blur, no filter, no animation loop, one paint. Under reduced motion nothing
 * changes, because nothing moves in the first place — the composition is the
 * effect.
 */
export function StadiumNight({ className }: { className?: string }): ReactNode {
  const m = useDesignMotion();
  const id = useSvgId('stadium');

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden bg-void', className)}
    >
      {/* Night sky, warmed very slightly where the floodlights spill into it. */}
      <span
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #05070a 0%, #070c12 34%, #0a1017 52%, #05070a 100%)',
        }}
      />

      {/* Two floodlight banks. Cold, wide, and deliberately not symmetrical —
          a perfectly mirrored pair reads as a logo, not a ground. */}
      <span
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(40% 32% at 13% 4%, rgba(214,232,255,0.34), transparent 68%)',
            'radial-gradient(36% 28% at 86% 2%, rgba(214,232,255,0.26), transparent 68%)',
            'radial-gradient(78% 30% at 50% 47%, rgba(200,255,46,0.16), transparent 74%)',
          ].join(','),
        }}
      />

      {/* The far stand: one dark mass with a crowd texture in it. Dots rather
          than faces — at this size a crowd is a frequency, not a set of people. */}
      <span
        className="absolute inset-x-0"
        style={{
          top: '40%',
          height: '16%',
          background: 'linear-gradient(180deg, rgba(10,14,20,0.0), rgba(9,13,19,0.95) 42%, rgba(6,9,13,1))',
        }}
      />
      <span
        className="absolute inset-x-0 opacity-60"
        style={{
          top: '41%',
          height: '13%',
          backgroundImage:
            'radial-gradient(rgba(190,210,235,0.55) 0.6px, transparent 0.7px), radial-gradient(rgba(200,255,46,0.35) 0.5px, transparent 0.6px)',
          backgroundSize: '5px 4px, 11px 9px',
          backgroundPosition: '0 0, 3px 2px',
          maskImage: 'linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)',
        }}
      />

      {/* The pitch, in perspective. A trapezoid of mown stripes, the markings
          drawn over it in the same white the floodlights are throwing. */}
      <div
        className="absolute inset-x-[-30%] bottom-[-6%]"
        style={{ top: '50%', perspective: '520px', perspectiveOrigin: '50% 0%' }}
      >
        <div
          className="absolute inset-0 origin-top"
          style={{ transform: 'rotateX(62deg)' }}
        >
          <span
            className="absolute inset-0"
            style={{
              background: [
                'repeating-linear-gradient(90deg, rgba(24,58,36,0.95) 0 7%, rgba(19,48,30,0.95) 7% 14%)',
                'radial-gradient(60% 70% at 50% 0%, rgba(120,180,130,0.28), transparent 72%)',
              ].join(','),
            }}
          />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8f2ff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#e8f2ff" stopOpacity="0.06" />
              </linearGradient>
            </defs>
            <g stroke={`url(#${id})`} strokeWidth="0.55" fill="none">
              <line x1="0" y1="34" x2="100" y2="34" />
              <circle cx="50" cy="34" r="11" />
              <rect x="32" y="82" width="36" height="18" />
              <rect x="42" y="93" width="16" height="7" />
            </g>
            <circle cx="50" cy="34" r="0.9" fill="#e8f2ff" fillOpacity="0.45" />
          </svg>
        </div>
      </div>

      {/* The scrim that makes the type readable. It is a design decision as much
          as a legibility one: the ground stays a suggestion behind the words
          rather than competing with them. */}
      <span
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(180deg, rgba(5,6,7,0.70) 0%, rgba(5,6,7,0.26) 26%, rgba(5,6,7,0.16) 46%, rgba(5,6,7,0.62) 80%, rgba(5,6,7,0.96) 100%)',
            'radial-gradient(130% 74% at 50% 46%, transparent 34%, rgba(5,6,7,0.62) 100%)',
          ].join(','),
        }}
      />

      {/* The horizon: the lit far touchline, and a soft spill above it so the
          stand and the grass meet in light rather than at a seam. Static — this
          is the first frame of the product and it must cost one paint. */}
      <span
        className="absolute inset-x-0"
        style={{
          top: '46%',
          height: '9%',
          background: 'linear-gradient(180deg, transparent, rgba(214,232,255,0.10) 62%, transparent)',
        }}
      />
      <span
        className={cn('absolute inset-x-0 h-px', m.reduced && 'opacity-80')}
        style={{
          top: '50%',
          background:
            'linear-gradient(90deg, transparent 6%, rgba(232,242,255,0.55) 30%, rgba(200,255,46,0.7) 50%, rgba(232,242,255,0.55) 70%, transparent 94%)',
        }}
      />
    </div>
  );
}
