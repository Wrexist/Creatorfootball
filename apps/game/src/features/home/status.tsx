import type { ReactNode } from 'react';
import {
  EmptyState, ErrorState, GlassButton, GlassPanel, Skeleton, SkeletonRegion, IconBall,
} from '@/design';
import { useGameStore, type GamePhase } from '@/state/gameStore';

/**
 * The three states every screen must have, in one place.
 *
 * Screens behind the router are not guaranteed a loaded save: a cold start, a
 * damaged save or a deep link all land here first. Rather than each screen
 * inventing its own "no data" branch, they render this inside their `Screen`
 * scaffold so the header, title and navigation stay exactly where the player
 * left them while the state resolves.
 */
export function ScreenStatus({
  phase,
  error,
  onStart,
}: {
  phase: GamePhase;
  error: string | null;
  onStart?: () => void;
}): ReactNode {
  const boot = useGameStore((s) => s.boot);

  if (phase === 'ERROR') {
    return (
      <ErrorState
        title="We could not open your club"
        description="Your save could not be read. Nothing has been overwritten — try again, and if it keeps failing you can start a new dynasty from the title screen."
        {...(error ? { detail: error } : {})}
        onRetry={() => void boot()}
      />
    );
  }

  if (phase === 'NO_SAVE') {
    return (
      <EmptyState
        icon={<IconBall />}
        title="No club yet"
        description="Create a manager and take over a club to begin. Everything on this screen fills in from your first matchweek."
        {...(onStart ? { action: <GlassButton variant="primary" onClick={onStart}>Start a career</GlassButton> } : {})}
      />
    );
  }

  return (
    <SkeletonRegion loading label="Loading your club">
      <div className="flex flex-col gap-4">
        <Skeleton variant="block" height={168} />
        <GlassPanel padding="md">
          <Skeleton variant="title" />
          <div className="mt-3">
            <Skeleton variant="text" lines={3} />
          </div>
        </GlassPanel>
        <Skeleton variant="block" height={96} />
        <Skeleton variant="block" height={96} />
      </div>
    </SkeletonRegion>
  );
}
