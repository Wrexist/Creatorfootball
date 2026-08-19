import { create } from 'zustand';

/**
 * UI-only state.
 *
 * Deliberately separate from game state: nothing here is saved, nothing here
 * affects simulation, and a bug here can never corrupt a dynasty. Sheets,
 * toasts and transient presentation flags live here and nowhere else.
 */

export interface ToastMessage {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly tone: 'neutral' | 'success' | 'warning' | 'danger' | 'volt';
  readonly durationMs: number;
  readonly icon?: string;
}

export interface SheetState {
  readonly id: string;
  readonly payload?: unknown;
}

interface UiState {
  sheet: SheetState | null;
  toasts: ToastMessage[];
  reducedEffects: boolean;
  navHidden: boolean;
  /** Set while a cinematic hero moment owns the screen. */
  cinematic: string | null;

  openSheet: (id: string, payload?: unknown) => void;
  closeSheet: () => void;
  toast: (t: Omit<ToastMessage, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  dismissToast: (id: string) => void;
  setReducedEffects: (value: boolean) => void;
  setNavHidden: (value: boolean) => void;
  setCinematic: (id: string | null) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set) => ({
  sheet: null,
  toasts: [],
  reducedEffects: false,
  navHidden: false,
  cinematic: null,

  openSheet: (id, payload) => set({ sheet: { id, payload } }),
  closeSheet: () => set({ sheet: null }),

  toast: (t) =>
    set((state) => ({
      toasts: [
        // Cap the stack: more than three at once is noise, not feedback.
        ...state.toasts.slice(-2),
        { ...t, id: `toast_${++toastSeq}`, durationMs: t.durationMs ?? 3200 },
      ],
    })),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setReducedEffects: (value) => {
    set({ reducedEffects: value });
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.reducedEffects = String(value);
    }
  },

  setNavHidden: (value) => set({ navHidden: value }),
  setCinematic: (id) => set({ cinematic: id }),
}));
