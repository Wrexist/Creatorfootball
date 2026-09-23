import { loadGame, MemoryStorage, SAVE_KEY, type GameState } from '@cf/engine';

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export async function inspectCareer(raw: string): Promise<GameState> {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES) throw new Error('This file exceeds the 8 MB career limit.');
  const memory = new MemoryStorage();
  await memory.set(SAVE_KEY, raw);
  const result = await loadGame(memory);
  if (!result.ok) throw new Error(result.error.code === 'UNSUPPORTED_VERSION'
    ? 'This career needs a newer version of Creator Football.' : 'This file is damaged or is not a Creator Football career. Your current save has not changed.');
  return result.value.state;
}
