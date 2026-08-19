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

/** Stable, human-legible slug used for content-pack ids and asset lookup. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
