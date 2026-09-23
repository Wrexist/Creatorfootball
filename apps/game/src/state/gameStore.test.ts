import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_PACK, MemoryStorage, SAVE_KEY, createNewGame, nextFixture } from '@cf/engine';
vi.mock('@/platform/storage', async () => {
  const { MemoryStorage: Adapter } = await import('@cf/engine');
  return { storage: new Adapter() };
});
import { storage } from '@/platform/storage';
import { useGameStore } from './gameStore';

const fresh = () => createNewGame({seed:'store-redesign',now:1000,
  manager:{kind:'PREMADE',templateId:BASE_PACK.data.managers![0]!.id},
  club:{kind:'TEMPLATE',templateId:BASE_PACK.data.clubs![0]!.id},
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await useGameStore.getState().abandon();
  useGameStore.setState({state:fresh(),phase:'READY',busy:false});
});
describe('ordered career persistence', () => {
  it('cancels a waiting import when the career is abandoned without resurrecting it', async () => {
    useGameStore.getState().apply(s => ({...s,settings:{...s.settings,sound:false}}));
    const importing=useGameStore.getState().replaceCareer(fresh());
    const abandoning=useGameStore.getState().abandon();
    expect(await importing).toBe(false);
    await abandoning;
    expect(await storage.get(SAVE_KEY)).toBeNull();
    expect(useGameStore.getState().state).toBeNull();
    expect(useGameStore.getState().busy).toBe(false);
  });
  it('replaces a local career only after successful persistence', async () => {
    const original=useGameStore.getState().state!;
    const imported={...original,settings:{...original.settings,commentary:false}};
    vi.spyOn(storage,'set').mockRejectedValue(new Error('Quota exceeded'));
    expect(await useGameStore.getState().replaceCareer(imported)).toBe(false);
    expect(useGameStore.getState().state).toBe(original);
    expect(useGameStore.getState().busy).toBe(false);
    vi.restoreAllMocks();
    expect(await useGameStore.getState().replaceCareer(imported)).toBe(true);
    const saved=JSON.parse((await storage.get(SAVE_KEY))!);
    expect(saved.state.settings.commentary).toBe(false);
    expect(useGameStore.getState().state?.settings.commentary).toBe(false);
  });
  it('retains both fast consecutive changes on disk', async () => {
    const original = storage.set.bind(storage);
    vi.spyOn(storage,'set').mockImplementation(async (key,value) => {
      await new Promise(resolve => setTimeout(resolve,2));
      await original(key,value);
    });
    useGameStore.getState().apply(s => ({...s,settings:{...s.settings,matchSpeed:'FAST'}}));
    useGameStore.getState().apply(s => ({...s,settings:{...s.settings,commentary:false}}));
    expect(await useGameStore.getState().save()).toBe(true);
    const saved = JSON.parse((await storage.get(SAVE_KEY))!);
    expect(saved.state.settings).toMatchObject({matchSpeed:'FAST',commentary:false});
  });
  it('reports a failed write without dropping the live career', async () => {
    vi.spyOn(storage,'set').mockRejectedValue(new Error('Quota exceeded'));
    expect(await useGameStore.getState().save()).toBe(false);
    expect(useGameStore.getState().persistFailed).toBe(true);
    expect(useGameStore.getState().state?.saveId).toBe(fresh().saveId);
  });
  it('commits a result once, and retains the full report for reload', async () => {
    const state = useGameStore.getState().state!;
    const fixture = nextFixture(state)!;
    const result = useGameStore.getState().createSimulator(fixture.id)!.finish();
    useGameStore.getState().recordMatch(result);
    expect(await useGameStore.getState().advance(result)).not.toBeNull();
    expect(await useGameStore.getState().advance(result)).toBeNull();
    expect(useGameStore.getState().state?.clock.week).toBe(1);
    const saved = JSON.parse((await storage.get(SAVE_KEY))!);
    expect(saved.state.latestMatchReport.matchId).toBe(result.matchId);
    expect(useGameStore.getState().createSimulator(fixture.id)).toBeNull();
  });
  it('does not resurrect a career after deletion with a write already queued', async () => {
    useGameStore.getState().apply(s => ({...s,settings:{...s.settings,sound:false}}));
    await useGameStore.getState().abandon();
    expect(await storage.get(SAVE_KEY)).toBeNull();
    expect(useGameStore.getState().state).toBeNull();
    expect(storage).toBeInstanceOf(MemoryStorage);
  });
  it('does not resurrect a career when deletion races with metadata loading', async () => {
    await useGameStore.getState().save();
    const original = storage.get.bind(storage);
    let release!: () => void;
    let reached!: () => void;
    const waiting = new Promise<void>(resolve => { reached = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(storage,'get').mockImplementation(async key => {
      if (key.includes('meta')) { reached(); await held; }
      return original(key);
    });
    const booting = useGameStore.getState().boot();
    await waiting;
    await useGameStore.getState().abandon();
    release();
    await booting;
    expect(useGameStore.getState().state).toBeNull();
    expect(useGameStore.getState().phase).toBe('NO_SAVE');
  });
});
