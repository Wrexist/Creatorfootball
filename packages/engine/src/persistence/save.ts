import type { GameState } from '../game/state';
import type { StorageAdapter } from './storage';
import { err, ok, type Result } from '../core/result';

/**
 * Save architecture.
 *
 * Rules the whole product depends on:
 *  - Saves are versioned and migrated forward. An old save must never be
 *    silently discarded, and must never be loaded into a newer engine unchecked.
 *  - Every write is validated before it replaces the previous good save, and the
 *    previous good save is retained as a backup. A corrupt write can therefore
 *    cost at most one cycle of progress, never the whole dynasty.
 *  - No progression lives only in component state.
 */

export const SAVE_VERSION = 7;
export const SAVE_KEY = 'cf.save.v1';
export const BACKUP_KEY = 'cf.save.backup.v1';
export const META_KEY = 'cf.save.meta.v1';

export interface SaveEnvelope {
  readonly version: number;
  readonly savedAt: number;
  /** Cheap integrity check: catches truncated writes and hand-edited saves. */
  readonly checksum: string;
  readonly state: GameState;
}

export interface SaveMeta {
  readonly saveId: string;
  readonly clubName: string;
  readonly managerName: string;
  readonly season: number;
  readonly week: number;
  readonly cycle: number;
  readonly savedAt: number;
  readonly version: number;
}

export type LoadError =
  | { code: 'NOT_FOUND' }
  | { code: 'CORRUPT'; detail: string }
  | { code: 'UNSUPPORTED_VERSION'; found: number }
  | { code: 'MIGRATION_FAILED'; from: number; detail: string };

/** FNV-1a over the serialised state. Not cryptographic — it only needs to catch damage. */
export function checksum(payload: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations are keyed by the version they upgrade FROM. To add one: bump
 * SAVE_VERSION and register the transform here. Never edit an existing entry —
 * saves already in the wild ran through it.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 0 -> 1: the first shipped schema. Nothing to transform.
  // 1 -> 2: the board-confidence system. Saves from before it existed have no
  // board state at all, which the board module reads as "no ultimatum history".
  1: (state) => ({ ...state, boardPressure: { lastUltimatumCycle: null } }),
  // 2 -> 3: decision recency memory. Older saves simply have not been asked
  // anything yet, so an empty list is exactly what they mean.
  2: (state) => ({ ...state, decisionMemory: { recentTriggers: [] } }),
  // 3 -> 4: the career record of graded decisions. No call has been graded
  // into an older save, so the honest seed is an empty record, which the UI
  // reads as "no history yet" rather than a row of zeroes.
  3: (state) => ({ ...state, decisionRecord: {} }),
  // 4 -> 5: the sound-effects setting. Audio arrived after these saves were
  // written; the default is on, matching a new game, so an existing career
  // gains the audio layer rather than silently opting out of it.
  4: (state) => ({
    ...state,
    settings: { ...(state.settings as Record<string, unknown> | undefined), sound: true },
  }),
  // 5 -> 6: the opponent's observation record. An existing career has been
  // played, but nobody was writing any of it down, so the honest seed is an
  // empty record: the league starts watching from here. The player is read
  // again after a couple of matches rather than being retroactively countered
  // for a shape the AI never actually saw.
  5: (state) => ({ ...state, opponentModel: { samples: [] } }),
  // 6 -> 7: entity ids became scoped to the career that created them. An
  // existing save's ids are already written into every club, fixture and
  // ledger account it holds, so they are left exactly as they are — rewriting
  // them would be a far larger and riskier operation than the collision
  // warrants. What it gains is a token for the ids it creates from now on,
  // taken from its own save id so that two existing careers with different
  // seeds stop sharing season ids going forward.
  6: (state) => ({
    ...state,
    idToken: String(state.saveId ?? 'legacy').replace(/^save_/, '') || 'legacy',
  }),
};

export function migrate(raw: Record<string, unknown>, from: number): Result<GameState, LoadError> {
  let state = raw;
  let version = from;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      return err({ code: 'MIGRATION_FAILED', from: version, detail: `No migration registered for v${version}` });
    }
    try {
      state = step(state);
    } catch (error) {
      return err({ code: 'MIGRATION_FAILED', from: version, detail: String(error) });
    }
    version++;
  }
  return ok(state as unknown as GameState);
}

/** Structural checks that must hold for a save to be considered loadable. */
export function validateState(state: GameState): string[] {
  const problems: string[] = [];
  const check = (condition: unknown, message: string) => { if (!condition) problems.push(message); };

  check(typeof state.saveId === 'string' && state.saveId.length > 0, 'Missing saveId');
  check(typeof state.seed === 'string' && state.seed.length > 0, 'Missing seed');
  check(state.clock && Number.isFinite(state.clock.cycle), 'Invalid clock');
  check(!!state.clubs && Object.keys(state.clubs).length > 0, 'No clubs in save');
  check(!!state.clubs?.[state.playerClubId], 'Player club missing from clubs');
  check(!!state.players, 'No players record');
  check(!!state.ledger, 'No ledger snapshot');
  check(!!state.currentSeasonId && !!state.seasons?.[state.currentSeasonId], 'Current season missing');

  // A player owned by two clubs is the single most damaging corruption we can
  // ship, because it silently duplicates value. Check it on every load.
  const owners = new Map<string, string>();
  for (const club of Object.values(state.clubs ?? {})) {
    for (const playerId of [...club.squad, ...club.youthSquad]) {
      const existing = owners.get(playerId);
      if (existing && existing !== club.id) {
        problems.push(`Player ${playerId} is in the squad of both ${existing} and ${club.id}`);
      }
      owners.set(playerId, club.id);
      if (!state.players?.[playerId]) problems.push(`Squad references unknown player ${playerId}`);
    }
  }

  return problems;
}

/**
 * Storage adapters are hostile infrastructure, not pure functions.
 *
 * A real device refuses writes: Safari throws `QuotaExceededError` once the
 * origin is full, private mode throws on the first write, and a native
 * key-value plugin can reject for reasons we never see. These helpers turn
 * every one of those into a value.
 *
 * This matters more than it looks. `saveGame` used to let an adapter rejection
 * escape as a rejected promise, which meant the one caller that persists
 * without awaiting (`gameStore.apply`) produced an unhandled rejection and
 * never set the "changes could not be saved" flag, and the caller that
 * advances the week threw away the entire simulated cycle — match result
 * included — because the *write* failed after the simulation had succeeded.
 * A full disk cost the player a week of football. Failures are now returned,
 * so callers can keep the state they already computed and warn instead.
 */
async function tryRead(storage: StorageAdapter, key: string): Promise<Result<string | null, string>> {
  try {
    return ok(await storage.get(key));
  } catch (error) {
    return err(`Storage read failed for ${key}: ${String(error)}`);
  }
}

async function tryWrite(storage: StorageAdapter, key: string, value: string): Promise<string | null> {
  try {
    await storage.set(key, value);
    return null;
  } catch (error) {
    return `Storage write failed for ${key}: ${String(error)}`;
  }
}

export async function saveGame(
  storage: StorageAdapter,
  state: GameState,
  now: number,
): Promise<Result<SaveMeta, string>> {
  const problems = validateState(state);
  if (problems.length > 0) {
    // Refuse to overwrite a good save with a bad one.
    return err(`Refusing to save invalid state: ${problems.slice(0, 3).join('; ')}`);
  }

  let payload: string;
  try {
    payload = JSON.stringify(state);
  } catch (error) {
    return err(`Save serialisation failed: ${String(error)}`);
  }

  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: now,
    checksum: checksum(payload),
    state,
  };

  let serialised: string;
  try {
    serialised = JSON.stringify(envelope);
  } catch (error) {
    return err(`Save serialisation failed: ${String(error)}`);
  }

  // Promote the current save to backup before writing the new one. A failure
  // here is not fatal: it costs us the safety net for this write, but the
  // existing save is still intact and the new one is still worth attempting.
  const previous = await tryRead(storage, SAVE_KEY);
  if (previous.ok && previous.value) await tryWrite(storage, BACKUP_KEY, previous.value);

  const wrote = await tryWrite(storage, SAVE_KEY, serialised);
  // The previous save is untouched on failure, so the player loses this write
  // rather than their career. Metadata is deliberately not updated: it must
  // never advertise a save that was not written.
  if (wrote) return err(wrote);

  const club = state.clubs[state.playerClubId];
  const manager = state.managers[state.playerManagerId];
  const meta: SaveMeta = {
    saveId: state.saveId,
    clubName: club?.name ?? 'Unknown Club',
    managerName: manager?.name ?? 'Unknown Manager',
    season: state.clock.season,
    week: state.clock.week,
    cycle: state.clock.cycle,
    savedAt: now,
    version: SAVE_VERSION,
  };
  const wroteMeta = await tryWrite(storage, META_KEY, JSON.stringify(meta));
  if (wroteMeta) return err(wroteMeta);
  return ok(meta);
}

async function readEnvelope(storage: StorageAdapter, key: string): Promise<Result<GameState, LoadError>> {
  const read = await tryRead(storage, key);
  if (!read.ok) return err({ code: 'CORRUPT', detail: read.error });
  const raw = read.value;
  if (!raw) return err({ code: 'NOT_FOUND' });

  let parsed: SaveEnvelope;
  try {
    parsed = JSON.parse(raw) as SaveEnvelope;
  } catch (error) {
    return err({ code: 'CORRUPT', detail: `Unparseable JSON: ${String(error)}` });
  }

  if (typeof parsed?.version !== 'number' || !parsed.state) {
    return err({ code: 'CORRUPT', detail: 'Envelope missing version or state' });
  }
  if (parsed.version > SAVE_VERSION) {
    return err({ code: 'UNSUPPORTED_VERSION', found: parsed.version });
  }

  const actual = checksum(JSON.stringify(parsed.state));
  if (parsed.checksum && parsed.checksum !== actual) {
    return err({ code: 'CORRUPT', detail: 'Checksum mismatch' });
  }

  const migrated = migrate(parsed.state as unknown as Record<string, unknown>, parsed.version);
  if (!migrated.ok) return migrated;

  const problems = validateState(migrated.value);
  if (problems.length > 0) {
    return err({ code: 'CORRUPT', detail: problems.slice(0, 3).join('; ') });
  }
  return ok(migrated.value);
}

/**
 * Load, falling back to the backup if the primary save is damaged. The caller
 * is told which one it got so the UI can be honest about losing a cycle rather
 * than pretending nothing happened.
 */
export async function loadGame(
  storage: StorageAdapter,
): Promise<Result<{ state: GameState; recoveredFromBackup: boolean }, LoadError>> {
  const primary = await readEnvelope(storage, SAVE_KEY);
  if (primary.ok) return ok({ state: primary.value, recoveredFromBackup: false });
  if (primary.error.code === 'NOT_FOUND') return err(primary.error);

  const backup = await readEnvelope(storage, BACKUP_KEY);
  if (backup.ok) return ok({ state: backup.value, recoveredFromBackup: true });
  return err(primary.error);
}

export async function loadMeta(storage: StorageAdapter): Promise<SaveMeta | null> {
  const read = await tryRead(storage, META_KEY);
  if (!read.ok) return null;
  const raw = read.value;
  if (!raw) return null;
  try { return JSON.parse(raw) as SaveMeta; } catch { return null; }
}

/**
 * Abandoning a career must succeed even on a storage layer that is refusing
 * writes, otherwise the player is trapped on a save they asked to delete.
 */
export async function deleteSave(storage: StorageAdapter): Promise<void> {
  for (const key of [SAVE_KEY, BACKUP_KEY, META_KEY]) {
    try { await storage.remove(key); } catch { /* nothing left to do but continue */ }
  }
}
