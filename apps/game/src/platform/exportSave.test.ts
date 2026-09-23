import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_PACK, createNewGame } from '@cf/engine';
import { inspectCareer } from './importSave';
const mocks = vi.hoisted(() => ({ writeFile: vi.fn(), share: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: mocks, Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' } }));
vi.mock('@capacitor/share', () => ({ Share: mocks }));
import { exportCareer } from './exportSave';
const fresh = () => createNewGame({ seed: 'native-export', now: 1000, manager: { kind: 'PREMADE', templateId: BASE_PACK.data.managers![0]!.id }, club: { kind: 'TEMPLATE', templateId: BASE_PACK.data.clubs![0]!.id } });
beforeEach(() => { vi.resetAllMocks(); });
describe('native career export boundary', () => {
  it('shares an importable career from the restricted cache directory', async () => {
    const state = fresh();
    mocks.writeFile.mockResolvedValue({ uri: 'file:///cache/career-exports/career.json' });
    await exportCareer(state);
    const file = mocks.writeFile.mock.calls[0]![0];
    expect(file).toMatchObject({ directory: 'CACHE', encoding: 'utf8', recursive: true });
    expect(file.path).toMatch(/^career-exports\/creator-football-season-\d+-week-\d+\.json$/);
    const inspected = await inspectCareer(file.data);
    expect(inspected.playerClubId).toBe(state.playerClubId);
    expect(mocks.share.mock.calls[0]![0].url).toBe('file:///cache/career-exports/career.json');
  });
  it('does not open a share sheet after a failed write', async () => {
    mocks.writeFile.mockRejectedValue(new Error('No space left'));
    await expect(exportCareer(fresh())).rejects.toThrow('No space left');
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it('treats dismissing the native share sheet as a normal cancellation', async () => {
    mocks.writeFile.mockResolvedValue({ uri: 'file:///cache/career-exports/career.json' });
    mocks.share.mockRejectedValue(new Error('Share canceled'));
    await expect(exportCareer(fresh())).resolves.toBe('CANCELLED');
  });
  it('keeps real sharing failures visible', async () => {
    mocks.writeFile.mockResolvedValue({ uri: 'file:///cache/career-exports/career.json' });
    mocks.share.mockRejectedValue(new Error('Permission denied'));
    await expect(exportCareer(fresh())).rejects.toThrow('Permission denied');
  });
});
