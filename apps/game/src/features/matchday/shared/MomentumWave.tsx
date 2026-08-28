import { memo, useMemo, type ReactNode } from 'react';
import { cn, useSvgId } from '@/design';

/**
 * Momentum over time, as a two-sided wave.
 *
 * Above the centre line is the home side, below it the away side, each filled
 * in that club's own colour — so the shape of a match ("we were on top for
 * twenty minutes and then it turned") is readable in one look, with no legend.
 *
 * The series is downsampled to at most 120 points before it reaches the DOM.
 * A live match produces one sample per tick and a full match run at instant
 * speed would otherwise hand React a 300-point path string several times a
 * second for no visible gain.
 */

export interface MomentumWaveProps {
  /** -1 (away dominant) .. +1 (home dominant). */
  values: readonly number[];
  homeColor: string;
  awayColor: string;
  homeLabel: string;
  awayLabel: string;
  height?: number;
  /** Fractional positions (0-1) of goals, drawn as markers. */
  markers?: readonly { readonly at: number; readonly side: 'home' | 'away'; readonly label: string }[];
  className?: string;
}

const MAX_POINTS = 120;
const WIDTH = 300;

export const MomentumWave = memo(function MomentumWave({
  values, homeColor, awayColor, homeLabel, awayLabel, height = 84, markers, className,
}: MomentumWaveProps): ReactNode {
  const id = useSvgId('momentum');

  const { area, line } = useMemo(() => {
    if (values.length < 2) return { area: '', line: '' };
    const step = Math.max(1, Math.ceil(values.length / MAX_POINTS));
    const points: string[] = [];
    for (let i = 0; i < values.length; i += step) {
      const v = Math.max(-1, Math.min(1, values[i] ?? 0));
      const x = (i / (values.length - 1)) * WIDTH;
      const y = height / 2 - v * (height / 2 - 2);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const last = Math.max(-1, Math.min(1, values[values.length - 1] ?? 0));
    points.push(`${WIDTH},${(height / 2 - last * (height / 2 - 2)).toFixed(1)}`);
    const polyline = points.join(' L ');
    return {
      line: `M ${polyline}`,
      area: `M 0,${height / 2} L ${polyline} L ${WIDTH},${height / 2} Z`,
    };
  }, [values, height]);

  return (
    <figure className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="block h-[var(--wave-h)] w-full"
        style={{ ['--wave-h' as string]: `${height}px` }}
        role="img"
        aria-label={`Momentum over time. Above the line is ${homeLabel}, below is ${awayLabel}.`}
      >
        <defs>
          <clipPath id={`${id}-top`}>
            <rect x="0" y="0" width={WIDTH} height={height / 2} />
          </clipPath>
          <clipPath id={`${id}-bottom`}>
            <rect x="0" y={height / 2} width={WIDTH} height={height / 2} />
          </clipPath>
        </defs>

        {area !== '' && (
          <>
            <path d={area} fill={homeColor} opacity={0.42} clipPath={`url(#${id}-top)`} />
            <path d={area} fill={awayColor} opacity={0.42} clipPath={`url(#${id}-bottom)`} />
            <path d={line} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </>
        )}

        <line
          x1="0" y1={height / 2} x2={WIDTH} y2={height / 2}
          stroke="rgb(255 255 255 / 0.22)" strokeWidth="1" vectorEffect="non-scaling-stroke"
        />

        {markers?.map((marker, index) => (
          <circle
            key={`${marker.label}-${index}`}
            cx={marker.at * WIDTH}
            cy={height / 2}
            r="3.5"
            fill={marker.side === 'home' ? homeColor : awayColor}
            stroke="#f4f6f8"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-micro font-semibold uppercase tracking-[0.14em] text-ink-dim">
        <span>{homeLabel}</span>
        <span>{awayLabel}</span>
      </figcaption>
    </figure>
  );
});
