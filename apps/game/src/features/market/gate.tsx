import type { ReactNode } from 'react';
import type { GameState } from '@cf/engine';
import { ErrorState, Screen, Skeleton, SkeletonRegion } from '@/design';
import { useGameStore } from '@/state/gameStore';

/**
 * Loading and failure are screens, not a spinner bolted onto a screen.
 *
 * Every route in this workstream renders through the same three-state gate, so
 * a save that is still booting shows the shape of what is coming rather than an
 * empty frame, and a damaged save says so in the player's language.
 */
export type GateState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly state: GameState };

export function useGameStatus(): GateState {
  const phase = useGameStore((s) => s.phase);
  const state = useGameStore((s) => s.state);
  const error = useGameStore((s) => s.error);

  if (phase === 'READY' && state) return { status: 'ready', state };
  if (phase === 'ERROR') {
    return { status: 'error', message: error ?? 'Your save could not be read.' };
  }
  if (phase === 'NO_SAVE') {
    return { status: 'error', message: 'There is no save to open yet. Start a career first.' };
  }
  return { status: 'loading' };
}

export interface GateScreenProps {
  gate: Exclude<GateState, { status: 'ready' }>;
  title: ReactNode;
  onBack?: () => void;
}

/** The loading skeleton mirrors the real layout: a summary block, then rows. */
export function GateScreen({ gate, title, onBack }: GateScreenProps): ReactNode {
  const boot = useGameStore((s) => s.boot);
  return (
    <Screen title={title} {...(onBack ? { onBack } : {})}>
      {gate.status === 'loading' ? (
        <SkeletonRegion
          loading
          label={`Loading ${typeof title === 'string' ? title.toLowerCase() : 'screen'}`}
          className="flex flex-col gap-4"
        >
          <Skeleton variant="block" height={148} />
          <Skeleton variant="row" lines={5} />
        </SkeletonRegion>
      ) : (
        <ErrorState
          title="This screen needs a save"
          description={gate.message}
          onRetry={() => void boot()}
          retryLabel="Reload the save"
        />
      )}
    </Screen>
  );
}
