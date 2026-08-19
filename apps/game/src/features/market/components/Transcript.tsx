import { memo, useMemo, type ReactNode } from 'react';
import { Divider, cn } from '@/design';

/**
 * The record of the talks, read as a conversation.
 *
 * The engine hands back a flat list of beats: who spoke, on which matchweek,
 * and what they said. Rendering that as a table would turn a negotiation back
 * into a form. So beats are bubbles, our side sits on the right, the other side
 * on the left, and the weeks are separated the way a chat log separates days —
 * because that is what the player is actually doing: talking to someone for
 * several weeks and watching them run out of patience.
 */

export interface TranscriptBeat {
  readonly cycle: number;
  readonly actor: string;
  readonly text: string;
}

export interface TranscriptProps {
  beats: readonly TranscriptBeat[];
  /** Beats by this actor render as ours. */
  ourActor: string;
  className?: string;
}

interface Group {
  readonly cycle: number;
  readonly beats: readonly (TranscriptBeat & { readonly index: number })[];
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const Beat = memo(function Beat({
  beat, ours,
}: { beat: TranscriptBeat; ours: boolean }): ReactNode {
  return (
    <li className={cn('flex items-start gap-2.5', ours && 'flex-row-reverse')}>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-pill text-[10px] font-bold',
          ours ? 'bg-volt/20 text-volt' : 'bg-white/[0.08] text-ink-muted',
        )}
      >
        {initials(beat.actor)}
      </span>
      <span className={cn('flex min-w-0 max-w-[86%] flex-col gap-1', ours && 'items-end')}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
          {beat.actor}
        </span>
        <span
          className={cn(
            'rounded-lg px-3 py-2 text-[14px] leading-relaxed text-ink text-pretty',
            ours
              ? 'rounded-tr-xs bg-volt/12 text-right'
              : 'rounded-tl-xs bg-white/[0.06]',
          )}
        >
          {beat.text}
        </span>
      </span>
    </li>
  );
});

export const Transcript = memo(function Transcript({
  beats, ourActor, className,
}: TranscriptProps): ReactNode {
  const groups = useMemo(() => {
    const out: Group[] = [];
    beats.forEach((beat, index) => {
      const last = out[out.length - 1];
      if (last && last.cycle === beat.cycle) {
        (last.beats as (TranscriptBeat & { index: number })[]).push({ ...beat, index });
      } else {
        out.push({ cycle: beat.cycle, beats: [{ ...beat, index }] });
      }
    });
    return out;
  }, [beats]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {groups.map((group) => (
        <section key={`${group.cycle}-${group.beats[0]?.index ?? 0}`} className="flex flex-col gap-3">
          <Divider label={`Matchweek ${group.cycle}`} />
          <ul className="flex flex-col gap-3">
            {group.beats.map((beat) => (
              <Beat key={beat.index} beat={beat} ours={beat.actor === ourActor} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
});
