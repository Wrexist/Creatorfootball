import { useCallback, useEffect, useRef } from 'react';
import {
  socialTickDue, tickSocialWorld,
  type GameState,
} from '@cf/engine';
import { useGameStore } from '@/state/gameStore';
import { contentRegistry } from '@/state/content';

/**
 * The bridge between the social screens and the social engine.
 *
 * Two responsibilities, both deliberately thin.
 *
 * The **registry** is the loaded content pack. Every authored line the player's
 * own posts, the press reaction and the creator drops render from comes out of
 * it; the shared accessor in `@/state/content` builds it once for the whole app.
 *
 * The **tick** advances the social world — settling promises against results,
 * closing polls, delivering content, moving the pundit — and it is driven from
 * here rather than from the cycle because the cycle is not this workstream's to
 * change. `tickSocialWorld` records the cycle it ran for and refuses to run
 * twice, so calling it on mount is safe, idempotent and deterministic. When the
 * world tick eventually owns this, the same function moves there unchanged.
 */

/**
 * Bring the social world up to the current matchweek.
 *
 * Called by every social screen. The guard inside the engine makes repeated
 * calls free; the ref here only avoids scheduling redundant store writes in the
 * same render pass.
 */
export function useSocialWorld(state: GameState): void {
  const apply = useGameStore((s) => s.apply);
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    if (!socialTickDue(state)) return;
    running.current = true;
    apply((current) => tickSocialWorld(current, { at: Date.now(), registry: contentRegistry() }).state);
    running.current = false;
  }, [state, apply]);
}

/**
 * Run one social action against the store.
 *
 * Every action in this feature is an engine function of the shape
 * `(state, input) => { state, ok, reason? }`, so the screens never branch on
 * game rules — they call this, show the refusal if there is one, and re-render
 * from the new state.
 */
export function useSocialAction(): <R extends { state: GameState; ok: boolean; reason?: string }>(
  run: (state: GameState) => R,
) => { ok: boolean; reason?: string } {
  const apply = useGameStore((s) => s.apply);
  return useCallback((run) => {
    let outcome: { ok: boolean; reason?: string } = { ok: false };
    apply((current) => {
      const result = run(current);
      outcome = result.ok
        ? { ok: true }
        : { ok: false, ...(result.reason ? { reason: result.reason } : {}) };
      return result.ok ? result.state : current;
    });
    return outcome;
  }, [apply]);
}
