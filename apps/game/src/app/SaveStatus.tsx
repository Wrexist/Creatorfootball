import type { ReactNode } from 'react';
import { useGameStore } from '@/state/gameStore';
import { exportCareer } from '@/platform/exportSave';
import { GlassButton, useToast } from '@/design';

export function SaveStatus(): ReactNode {
  const failed = useGameStore(s => s.unsaved && s.saveError !== null);
  const conflict = useGameStore(s => s.saveConflict);
  const toast = useToast();
  if (!failed && !conflict) return null;
  const exportNow = async (): Promise<void> => {
    const state = useGameStore.getState().state;
    if (!state) return;
    try { await exportCareer(state); } catch (error) { toast.error('Export failed', String(error)); }
  };
  return <aside role="alert" className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[100] mx-auto max-w-md rounded-xl border border-warning bg-base p-3 shadow-xl">
    <p className="text-sm font-semibold">{conflict ? 'This career changed in another tab' : 'Progress is not saved'}</p>
    <p className="mt-1 text-sm text-ink-muted">{conflict ? 'Export this session before reloading. Changes are paused to protect the saved career.' : 'Keep this tab open. Free storage, retry saving, or export your progress.'}</p>
    <div className="mt-2 flex gap-2">
      <GlassButton variant="secondary" size="sm" onClick={() => void exportNow()}>Export save</GlassButton>
      <GlassButton variant="primary" size="sm" onClick={() => conflict ? window.location.reload() : void useGameStore.getState().save()}>{conflict ? 'Reload saved career' : 'Retry save'}</GlassButton>
    </div>
  </aside>;
}
