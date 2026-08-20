import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { DecisionOption, DecisionPrompt } from '@cf/engine';
import { GlassPill, GlassSheet, cn, haptics, useDesignMotion } from '@/design';
import { useMatchStore } from '@/state/matchStore';
import { RISK_LABEL, RISK_TONE, TRIGGER_LABEL } from '../shared/format';

/**
 * The live decision.
 *
 * This is the interaction the whole match mode exists to deliver, so it is
 * built around one question: can a player who has looked away for ten seconds
 * glance back and choose correctly in under three?
 *
 *   - one sentence of situation, set large;
 *   - two or three options, each a full-width target well past 44pt, each
 *     stating its own downside rather than hiding it behind a stat;
 *   - a countdown that is visible without being read — the ring drains, the
 *     seconds are secondary, and the last five seconds turn amber then red.
 *
 * The countdown is written straight to the DOM from a `requestAnimationFrame`
 * loop. Re-rendering a sheet sixty times a second to move a ring would be the
 * single most expensive thing on screen at the exact moment the player needs
 * the interface to feel instant.
 */

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function DecisionOverlay(): ReactNode {
  const decision = useMatchStore((s) => s.decision);
  const deadline = useMatchStore((s) => s.decisionDeadline);
  const choose = useMatchStore((s) => s.chooseOption);

  const ringRef = useRef<SVGCircleElement>(null);
  const secondsRef = useRef<HTMLSpanElement>(null);
  const firedRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const pick = useCallback(
    (optionId: string) => {
      haptics.impact();
      choose(optionId);
    },
    [choose],
  );

  useEffect(() => {
    if (decision) haptics.warning();
  }, [decision]);

  useEffect(() => {
    if (!decision || deadline === null) return;
    firedRef.current = null;
    startedAtRef.current = Date.now();
    // Measure the ring against the window the store actually set, not against
    // the prompt's declared timeout. A prompt that declares none still gets a
    // generous deadline so an abandoned match can reach a result; the ring is
    // hidden in that case, but the fraction must stay sane either way.
    const total = Math.max(1, deadline - startedAtRef.current);
    let raf = 0;

    const step = (): void => {
      const remaining = Math.max(0, deadline - Date.now());
      const fraction = remaining / total;

      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
        ringRef.current.style.stroke =
          fraction > 0.4 ? 'var(--color-volt)' : fraction > 0.18 ? 'var(--color-warning)' : 'var(--color-danger)';
      }
      if (secondsRef.current) {
        secondsRef.current.textContent = String(Math.ceil(remaining / 1000));
      }

      if (remaining <= 0) {
        // Time is up: the engine's own default is applied. Doing nothing is
        // itself a managerial choice, and the match must never stall.
        if (firedRef.current !== decision.id) {
          firedRef.current = decision.id;
          choose(decision.defaultOptionId);
        }
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [decision, deadline, choose]);

  return (
    <GlassSheet
      open={decision !== null}
      onClose={noop}
      dismissible={false}
      size="auto"
      title={decision ? TRIGGER_LABEL[decision.trigger] : undefined}
    >
      {decision && (
        <DecisionBody decision={decision} onPick={pick} ringRef={ringRef} secondsRef={secondsRef} />
      )}
    </GlassSheet>
  );
}

const noop = (): void => {};

function DecisionBody({
  decision, onPick, ringRef, secondsRef,
}: {
  decision: DecisionPrompt;
  onPick: (optionId: string) => void;
  ringRef: RefObject<SVGCircleElement | null>;
  secondsRef: RefObject<HTMLSpanElement | null>;
}): ReactNode {
  const timed = decision.timeoutSeconds > 0;

  return (
    <div className="pb-1">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-balance text-[21px] font-bold leading-[1.2] tracking-[-0.02em] text-ink">
          {decision.situation}
        </p>
        {timed && (
          <div className="relative shrink-0" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
              <circle cx="24" cy="24" r={RING_RADIUS} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
              <circle
                ref={ringRef}
                cx="24"
                cy="24"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--color-volt)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={0}
              />
            </svg>
            <span
              ref={secondsRef}
              className="tnum absolute inset-0 flex items-center justify-center text-[15px] font-bold text-ink"
            >
              {decision.timeoutSeconds}
            </span>
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        {decision.minute}&apos; · your call
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {decision.options.map((option) => (
          <OptionButton
            key={option.id}
            option={option}
            isDefault={option.id === decision.defaultOptionId && timed}
            onPick={onPick}
          />
        ))}
      </div>

      {timed && (
        <p className="mt-3 text-center text-[12px] text-ink-dim">
          Do nothing and the bench makes the safe call for you.
        </p>
      )}
    </div>
  );
}

function OptionButton({
  option, isDefault, onPick,
}: {
  option: DecisionOption;
  isDefault: boolean;
  onPick: (optionId: string) => void;
}): ReactNode {
  const m = useDesignMotion();

  return (
    <button
      type="button"
      onClick={() => onPick(option.id)}
      className={cn(
        'group relative w-full rounded-lg border border-white/10 bg-white/[0.05] p-3.5 text-left',
        'min-h-[76px] transition-colors duration-[var(--duration-fast)]',
        'hover:border-volt/40 hover:bg-white/10 active:bg-white/[0.14]',
        'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        !m.reduced && 'motion-safe:active:scale-[0.99]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[17px] font-bold tracking-[-0.01em] text-ink">{option.label}</span>
        <GlassPill tone={RISK_TONE[option.risk]} size="sm">
          {RISK_LABEL[option.risk]}
        </GlassPill>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-ink-muted text-pretty">{option.effect}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
        <span>{option.durationMinutes} min</span>
        {isDefault && <span className="text-volt">· auto pick</span>}
      </div>
    </button>
  );
}
