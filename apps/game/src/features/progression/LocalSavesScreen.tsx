import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKUP_KEY, type GameState } from '@cf/engine';
import { GlassButton, GlassPanel, GlassSheet, Screen, SectionHeader, useConfirm } from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { storage } from '@/platform/storage';
import { exportCareer } from '@/platform/exportSave';
import { inspectCareer, MAX_IMPORT_BYTES } from '@/platform/importSave';

export function LocalSavesScreen(): ReactNode {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const current = useGameStore(s => s.state);
  const storeBusy = useGameStore(s => s.busy || s.saveConflict);
  const [candidate, setCandidate] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inspect = async (read: () => Promise<string | null>): Promise<void> => {
    setBusy(true); setMessage(null);
    try { const raw = await read(); if (!raw) throw new Error('No previous local backup is available yet.'); setCandidate(await inspectCareer(raw)); }
    catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  };
  const restore = async (): Promise<void> => {
    if (!candidate) return;
    const approved = await confirm({ title: current ? 'Replace this career?' : 'Import this career?', description: current
      ? 'This replaces the career on this device. Export your current career first if you want to keep both.'
      : 'The inspected career will become your local save on this device.', confirmLabel: 'Restore career', destructive: !!current });
    if (!approved) return;
    setBusy(true);
    try {
      if (!await useGameStore.getState().replaceCareer(candidate)) throw new Error('The career could not be saved. Your current career is still open. Resolve any save warning and retry.');
      navigate(ROUTES.home, { replace: true });
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); setCandidate(null); }
  };
  return <Screen title="Local saves" subtitle="Your career. In your hands." onBack={() => navigate(current ? ROUTES.settings : ROUTES.onboarding)}>
    <GlassPanel padding="md" accent="volt"><h2 className="font-display text-2xl font-bold">Keep your story safe</h2><p className="mt-2 text-sm text-ink-muted">Progress saves automatically on this device. Export a career file to keep a separate backup or move it to another device. No account or cloud save is required.</p></GlassPanel>
    {message && <p role="alert" className="text-sm">{message}</p>}
    {current && <GlassPanel padding="md"><h2 className="font-display text-xl font-bold">{current.clubs[current.playerClubId]?.name}</h2><p className="my-2 text-sm text-ink-muted">Season {current.clock.season} · Week {current.clock.week}</p><GlassButton block variant="primary" disabled={busy || storeBusy} onClick={() => { setBusy(true); setMessage(null); void exportCareer(current).then(result => setMessage(result === 'EXPORTED' ? 'Backup ready. Keep the file somewhere you can find again.' : null)).catch(error => setMessage(String(error))).finally(() => setBusy(false)); }}>Export career file</GlassButton></GlassPanel>}
    <SectionHeader title="Bring a career back" subtitle="Inspected before it replaces anything" />
    <GlassPanel padding="md"><label htmlFor="career-file" className="block font-semibold">Choose a career file</label><p id="file-help" className="my-2 text-sm text-ink-muted">Creator Football JSON, up to 8 MB. Purchases are restored separately through your store account.</p><input id="career-file" type="file" accept=".json,application/json" aria-describedby="file-help" disabled={busy || storeBusy} className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-volt file:px-3 file:text-black" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > MAX_IMPORT_BYTES) { setMessage('Choose a career file smaller than 8 MB.'); return; } void inspect(() => file.text()); }} /></GlassPanel>
    <GlassButton block disabled={busy || storeBusy} onClick={() => void inspect(() => storage.get(BACKUP_KEY))}>Inspect previous local backup</GlassButton>
    <p className="text-sm text-ink-muted">The previous valid save is retained automatically. Clearing app data or uninstalling can remove local careers. Keep an exported file before changing devices.</p>
    <GlassSheet title="Career ready to restore" open={!!candidate} onClose={() => !busy && setCandidate(null)} dismissible={!busy}>
      {candidate && <div className="space-y-4 p-4"><h2 className="font-display text-2xl">{candidate.clubs[candidate.playerClubId]?.name}</h2><p>Season {candidate.clock.season} · Week {candidate.clock.week}</p><p className="text-sm text-ink-muted">The file passed the game's integrity and version checks. Restoring it does not change your store purchases.</p><GlassButton variant="primary" block loading={busy} disabled={storeBusy} onClick={() => void restore()}>Restore this career</GlassButton><GlassButton block onClick={() => setCandidate(null)}>Keep current career</GlassButton></div>}
    </GlassSheet>
  </Screen>;
}
