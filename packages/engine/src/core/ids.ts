import { asId } from './brand';

/**
 * Deterministic id generation. Ids are derived from a save-scoped counter, not
 * from Math.random or Date.now, so two runs of the same seed produce byte-identical
 * saves — a precondition for the replay and audit tooling.
 */
export class IdFactory {
  private counters = new Map<string, number>();

  constructor(private readonly prefix: string) {}

  next<T extends string>(kind: string): T {
    const n = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, n);
    return asId<T>(`${this.prefix}_${kind}_${n.toString(36)}`);
  }

  serialize(): Record<string, number> { return Object.fromEntries(this.counters); }

  static restore(prefix: string, counters: Record<string, number>): IdFactory {
    const f = new IdFactory(prefix);
    for (const [k, v] of Object.entries(counters)) f.counters.set(k, v);
    return f;
  }
}

/**
 * A short token that is unique to one career.
 *
 * Entity ids used to be identical in every save ever created: clubs were
 * `club_0`..`club_11`, the first season was literally `season_1`, and fixture
 * and match ids were derived from those. Two careers therefore shared their
 * ids exactly. That already cost one silent bug — a match result from a new
 * career being dropped because a previous career had "already played" a match
 * with the same id — and it is a trap for anything that keys by entity id
 * across a save boundary: analytics, a future cloud save, crash grouping.
 *
 * Derived from the seed and the creation time, so it is a pure function of
 * `createNewGame`'s inputs and two runs of the same inputs still produce a
 * byte-identical world. Kept to six base36 characters — about two billion
 * values — because this prefix is repeated on every club reference in the
 * save, including every ledger account, and length here costs real bytes.
 */
export function saveToken(seed: string, now: number): string {
  const payload = `${seed}|${now}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).padStart(6, '0').slice(-6);
}

/** Stable, human-legible slug used for content-pack ids and asset lookup. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
