import { SAVE_KEY, type StorageAdapter } from '@cf/engine';

export class SaveConflict extends Error {
  constructor() { super('Another tab changed this career. Export this session or reload the saved version.'); }
}

/** Cross-tab transaction lock plus optimistic revision check. */
export class SaveCoordinator {
  private revision: string | null | undefined;
  constructor(private readonly adapter: StorageAdapter) {}
  async readRevision(): Promise<string | null> { return this.adapter.get(SAVE_KEY); }
  acceptRevision(revision: string | null): void { this.revision = revision; }
  async write<T>(operation: () => Promise<T>): Promise<T> {
    const guarded = async (): Promise<T> => {
      const current = await this.readRevision();
      if (this.revision !== undefined && current !== this.revision) throw new SaveConflict();
      try { return await operation(); }
      finally { this.revision = await this.readRevision(); }
    };
    if (typeof window === 'undefined') return guarded();
    if (!navigator.locks) throw new Error('This browser cannot coordinate career saves. Export your progress and use a current browser.');
    return navigator.locks.request('creator-football:career-write', guarded);
  }
}
