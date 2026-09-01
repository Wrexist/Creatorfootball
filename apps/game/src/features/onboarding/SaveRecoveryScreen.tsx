import { useState, type ReactNode } from 'react';
import { GlassButton, GlassPanel, IconWarning, KeyValueRow, useConfirm } from '@/design';
import { useGameStore } from '@/state/gameStore';

/**
 * The save could not be read.
 *
 * The rule this screen exists to enforce: a damaged save is never silently
 * discarded. We say what happened, we say plainly that nothing has been
 * deleted, and starting over is an explicit, confirmed choice the player makes
 * — not something the app does on their behalf while showing a spinner.
 *
 * It is also not apologetic-to-the-point-of-uselessness. The two things a
 * player can actually do are the two buttons, in the order they should try
 * them.
 */
export function SaveRecoveryScreen(): ReactNode {
  const error = useGameStore((s) => s.error);
  const source = useGameStore((s) => s.errorSource);
  // The save is fine and the connection is not: the advice is "try again",
  // and "start over" would throw away a career for a network blip.
  const contentFailed = source === 'CONTENT';
  const boot = useGameStore((s) => s.boot);
  const abandon = useGameStore((s) => s.abandon);
  const confirm = useConfirm();
  const [retrying, setRetrying] = useState(false);

  const retry = async (): Promise<void> => {
    setRetrying(true);
    await boot();
    setRetrying(false);
  };

  const startOver = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Delete the damaged save?',
      description:
        'This removes the save file for good and takes you back to the title screen to start a new career. There is no way back from this.',
      confirmLabel: 'Delete and start over',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (ok) await abandon();
  };

  return (
    <div className="scroll-y flex h-full w-full items-center justify-center bg-base px-6 py-[calc(var(--safe-top)+24px)]">
      <div className="w-full max-w-[420px]" role="alert">
        <span
          aria-hidden="true"
          className="mb-5 flex size-14 items-center justify-center rounded-pill bg-warning/12 text-warning [&_svg]:size-7"
        >
          <IconWarning />
        </span>

        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-ink">
          {contentFailed ? 'Your league could not be prepared' : 'We could not open your save'}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted text-pretty">
          {error ?? 'The save file could not be read.'}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted text-pretty">
          {contentFailed
            ? 'Your save is fine and has not been touched. This is almost always the connection dropping partway through.'
            : 'Nothing has been deleted. The file is still on this device exactly as it was, so if this is a version problem an update may well fix it.'}
        </p>

        <GlassPanel level={1} radius="lg" padding="sm" className="mt-6">
          <KeyValueRow label="Save file" value="Untouched" divided />
          <KeyValueRow label="Backup" value={contentFailed ? 'Untouched' : 'Checked and unusable'} divided />
          <KeyValueRow label="What we changed" value="Nothing" />
        </GlassPanel>

        <div className="mt-6 flex flex-col gap-2.5">
          <GlassButton variant="primary" size="lg" block loading={retrying} onClick={() => void retry()}>
            Try again
          </GlassButton>
          {!contentFailed && (
            <GlassButton variant="ghost" size="md" block onClick={() => void startOver()}>
              Start a new career instead
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
}
