import { memo, type ReactNode } from 'react';
import type { Club, Side, TacticSetup } from '@cf/engine';
import { cn, haptics } from '@/design';
import { useMatchStore } from '@/state/matchStore';
import type { KitPalette } from '../shared/kit';
import { BroadcastView } from './BroadcastView';
import { EventFeed } from './EventFeed';

/**
 * The half of the screen that is not the pitch.
 *
 * The old layout put a single-line ticker under the pitch and left the rest of
 * the phone empty — 400 points of nothing between the last thing that happened
 * and the controls. The space was not the problem; not composing it was. The
 * pitch takes the height a landscape pitch is worth and no more, and everything
 * below it belongs to the story: what just happened, in full sentences, or the
 * numbers behind it, on a tab of its own.
 *
 * Two tabs and not three: "Feed" answers *what is happening*, "Stats" answers
 * *how it is going*, and those are the only two questions a manager asks a
 * screen while the ball is moving.
 */

export interface StoryPanelProps {
  home: Club;
  away: Club;
  homePalette: KitPalette;
  awayPalette: KitPalette;
  playerSide: Side;
  tactics: TacticSetup;
  className?: string;
}

export const StoryPanel = memo(function StoryPanel({
  home, away, homePalette, awayPalette, playerSide, tactics, className,
}: StoryPanelProps): ReactNode {
  const presentation = useMatchStore((s) => s.presentation);
  const setPresentation = useMatchStore((s) => s.setPresentation);
  const feed = presentation === 'PITCH';

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-surface-1/70',
        className,
      )}
      aria-label={feed ? 'Match feed' : 'Match statistics'}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-1">
        <h2 className="min-w-0 flex-1 text-[12px] font-bold uppercase tracking-[0.16em] text-ink-dim">
          {feed ? 'What is happening' : 'How it is going'}
        </h2>
        <div role="radiogroup" aria-label="Lower panel" className="flex items-center gap-0.5 rounded-pill bg-white/[0.06] p-0.5">
          <PanelTab label="Feed" selected={feed} onPress={() => setPresentation('PITCH')} />
          <PanelTab label="Stats" selected={!feed} onPress={() => setPresentation('BROADCAST')} />
        </div>
      </div>

      <div className="scroll-y min-h-0 flex-1 px-3 py-1">
        {feed ? (
          <EventFeed perspective={playerSide} />
        ) : (
          <BroadcastView
            home={home}
            away={away}
            homePalette={homePalette}
            awayPalette={awayPalette}
            playerSide={playerSide}
            tactics={tactics}
            embedded
          />
        )}
      </div>
    </section>
  );
});

function PanelTab({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }): ReactNode {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => {
        if (selected) return;
        haptics.selection();
        onPress();
      }}
      className={cn(
        'min-h-11 rounded-pill px-3.5 text-[11px] font-bold uppercase tracking-[0.1em]',
        'outline-none transition-colors duration-[var(--duration-fast)]',
        'focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        selected ? 'bg-volt/16 text-volt' : 'text-ink-dim hover:text-ink-muted',
      )}
    >
      {label}
    </button>
  );
}
