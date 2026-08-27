import type { ReactNode } from 'react';
import type { ClubVisualIdentity } from '@cf/engine';
import { ART_ASSETS, useSvgId } from '@/design';

/**
 * The kit, drawn from the same three colours and the same pattern field that
 * the badge and the match renderer read.
 *
 * It is here because `kitPattern` is otherwise an invisible choice at creation
 * time — the player would be picking "Hoops" from a list and finding out what
 * that meant an hour later, on a pitch. A 72px shirt costs one path and closes
 * that loop immediately.
 */
export function KitPreview({
  visual, size = 72, label,
}: { visual: ClubVisualIdentity; size?: number; label?: string }): ReactNode {
  const clipId = useSvgId('cf-kit-clip');
  const gradientId = useSvgId('cf-kit-grad');
  const { primary, secondary, accent, kitPattern } = visual;

  const shirt =
    'M22 14 L36 8 C40 14 56 14 60 8 L74 14 L84 30 L72 38 L72 84 C72 88 70 90 66 90 L30 90 C26 90 24 88 24 84 L24 38 L12 30 Z';

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className="block shrink-0"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shirt} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect width="96" height="96" fill={kitPattern === 'GRADIENT' ? `url(#${gradientId})` : primary} />

        {kitPattern === 'STRIPES' &&
          [0, 2, 4, 6].map((i) => (
            <rect key={i} x={12 + i * 12} y="0" width="12" height="96" fill={secondary} />
          ))}

        {kitPattern === 'HOOPS' &&
          [0, 1, 2, 3].map((i) => (
            <rect key={i} x="0" y={12 + i * 22} width="96" height="11" fill={secondary} />
          ))}

        {kitPattern === 'SASH' && (
          <path d="M-10 78 L70 -10 L94 6 L14 96 Z" fill={secondary} />
        )}

        {kitPattern === 'HALVES' && <rect x="48" y="0" width="48" height="96" fill={secondary} />}

        {/* C3 breaks up the flat club colour. Inside the clip so it stops at
            the shirt, and last so it sits over the pattern. An <image> whose
            href 404s renders nothing at all, which is the whole fallback: the
            kit is the flat fill it has always been. 8% is the ceiling the
            entry sets, and the tile is authored neutral grey so `overlay`
            changes value without tinting the club's colour. */}
        <image
          href={ART_ASSETS.kitFabric}
          x="0"
          y="0"
          width="96"
          height="96"
          preserveAspectRatio="xMidYMid slice"
          opacity="0.08"
          style={{ mixBlendMode: 'overlay' }}
          aria-hidden="true"
        />
      </g>

      <path d={shirt} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" opacity="0.9" />
      <path
        d="M36 8 C40 14 56 14 60 8"
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
