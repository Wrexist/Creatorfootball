import { describe, expect, it } from 'vitest';
import { BASE_PACK, MemoryStorage, SAVE_KEY, createNewGame, saveGame } from '@cf/engine';
import { inspectCareer, MAX_IMPORT_BYTES } from './importSave';
describe('local career import inspection', () => {
  it('round trips an exported career with stable identities and settings', async () => {
    const state=createNewGame({seed:'import',now:1000,manager:{kind:'PREMADE',templateId:BASE_PACK.data.managers![0]!.id},club:{kind:'TEMPLATE',templateId:BASE_PACK.data.clubs![0]!.id}});
    const storage=new MemoryStorage(); await saveGame(storage,state,1000);
    expect(await inspectCareer((await storage.get(SAVE_KEY))!)).toEqual(state);
  });
  it('rejects malformed, truncated and oversized files without writing any local save', async () => {
    for(const text of ['not JSON','{}','{"version":5,"state":{}}']) await expect(inspectCareer(text)).rejects.toThrow('damaged');
    await expect(inspectCareer('x'.repeat(MAX_IMPORT_BYTES+1))).rejects.toThrow('8 MB');
  });
});
