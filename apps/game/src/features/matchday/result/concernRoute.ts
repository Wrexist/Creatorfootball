import { buildPath, ROUTES } from '@/app/routes';
import type { ClubConcern } from '@cf/engine';

/**
 * Where the player can actually do something about a concern.
 *
 * The result screen's final card used to say "needs a decision" and then offer
 * none. Each kind maps to the screen that owns the fix; a player-shaped
 * problem goes straight to that player. A CONTRACT concern without a player id
 * has no single destination worth guessing at, so it stays informational.
 */
export function concernRoute(concern: ClubConcern): string | null {
  switch (concern.kind) {
    case 'INJURY':
    case 'CONTRACT':
      return concern.playerId
        ? buildPath(ROUTES.player, { playerId: concern.playerId })
        : null;
    case 'FINANCE':
      return ROUTES.finances;
    case 'MORALE':
      return ROUTES.squad;
    case 'FORM':
      return ROUTES.tactics;
    case 'FANS':
      return ROUTES.fans;
    case 'NONE':
      return null;
  }
}
