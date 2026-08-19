import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState, GlassButton } from '@/design';

/**
 * The last line of defence.
 *
 * A render crash in one feature screen must not take the whole app to a white
 * page, and — more importantly for this product — it must not imply that the
 * save is gone. Nothing here touches storage: the game state is still in memory
 * and still on disk, and the copy says so, because "something went wrong" next
 * to a football club the player has run for six seasons reads as "you have lost
 * it" unless you say otherwise.
 */
interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] render failure', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full w-full items-center justify-center bg-base px-6">
        <div className="w-full max-w-[440px]">
          <ErrorState
            title="This screen stopped working"
            description="Your save has not been touched — it is still on this device exactly as it was. Reloading usually clears it."
            detail={error.message}
            onRetry={() => this.setState({ error: null })}
            retryLabel="Try this screen again"
          />
          <div className="mt-3 flex justify-center">
            <GlassButton variant="ghost" size="md" onClick={() => window.location.reload()}>
              Reload the game
            </GlassButton>
          </div>
        </div>
      </div>
    );
  }
}
