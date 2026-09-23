import { MemoryStorage, SAVE_KEY, saveGame, type GameState } from '@cf/engine';
import { Capacitor } from '@capacitor/core';

export async function exportCareer(state: GameState): Promise<'EXPORTED' | 'CANCELLED'> {
  const memory = new MemoryStorage();
  const saved = await saveGame(memory, state, Date.now());
  if (!saved.ok) throw new Error('The career could not be validated for export.');
  const raw = await memory.get(SAVE_KEY);
  if (!raw) throw new Error('The career export is empty.');
  const filename = `creator-football-season-${state.clock.season}-week-${state.clock.week}.json`;
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const savedFile = await Filesystem.writeFile({ path: `career-exports/${filename}`, data: raw, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    try {
      await Share.share({ title: 'Creator Football career backup', url: savedFile.uri, dialogTitle: 'Save your career backup' });
      return 'EXPORTED';
    } catch (error) {
      // Both native implementations of the pinned Share plugin use this exact
      // message for dismissal. File/permission/bridge failures still propagate.
      if (error && typeof error === 'object' && 'message' in error && error.message === 'Share canceled') return 'CANCELLED';
      throw error;
    }
  }
  const url = URL.createObjectURL(new Blob([raw!], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'EXPORTED';
}
