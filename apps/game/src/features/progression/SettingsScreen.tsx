import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSettings, GameState } from '@cf/engine';
import {
  Divider, GlassButton, GlassPanel, GlassSegmented, GlassToggle, IconSettings, IconWarning,
  KeyValueRow, Screen, SectionHeader, useConfirm, useToast,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { GateScreen, useGameStatus } from './gate';
import { updateSettings } from './engine';

/**
 * Settings.
 *
 * Presentation, accessibility and save management. Two things are treated with
 * more care than the rest: difficulty, which is stated in terms of what it
 * actually changes rather than as a vague dial, and abandoning a save, which is
 * irreversible and therefore goes through an explicit, named confirmation.
 */

const SPEEDS = [
  { value: 'SLOW' as const, label: 'Slow' },
  { value: 'NORMAL' as const, label: 'Normal' },
  { value: 'FAST' as const, label: 'Fast' },
  { value: 'INSTANT' as const, label: 'Instant' },
];

const PRESENTATIONS = [
  { value: 'PITCH' as const, label: 'Pitch' },
  { value: 'BROADCAST' as const, label: 'Broadcast' },
];

const DIFFICULTIES = [
  { value: 'CASUAL' as const, label: 'Casual' },
  { value: 'STANDARD' as const, label: 'Standard' },
  { value: 'DEMANDING' as const, label: 'Demanding' },
];

const DIFFICULTY_BLURB: Record<GameSettings['difficulty'], string> = {
  CASUAL: 'Boards are patient, budgets are kinder and rivals bid less aggressively.',
  STANDARD: 'The game as designed. Objectives are set against what your club can actually do.',
  DEMANDING: 'Expectations rise faster, the market is sharper and mistakes stay expensive.',
};

const PRESENTATION_BLURB: Record<GameSettings['presentation'], string> = {
  PITCH: 'The animated pitch. Shows shape, movement and space.',
  BROADCAST: 'A television-style feed. Cheaper to render and easier to read at a glance.',
};

const REGIONS = [
  { value: 'GLOBAL', label: 'Worldwide' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'EU', label: 'European Union' },
];

function SettingsView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const abandon = useGameStore((s) => s.abandon);
  const save = useGameStore((s) => s.save);
  const meta = useGameStore((s) => s.meta);
  const reducedEffects = useUiStore((s) => s.reducedEffects);
  const setReducedEffects = useUiStore((s) => s.setReducedEffects);
  const [busy, setBusy] = useState(false);

  const settings = state.settings;

  const handleAbandon = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Abandon this save?',
      description:
        'This deletes the whole career — every season, every signing, every record. It cannot be undone and there is no backup after this point.',
      confirmLabel: 'Delete my career',
      cancelLabel: 'Keep playing',
      destructive: true,
      body: (
        <div className="rounded-lg border border-danger/30 bg-danger/[0.07] p-3">
          <p className="text-[13px] font-semibold text-ink">
            {state.clubs[state.playerClubId]?.name ?? 'Your club'}
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">
            Season {state.clock.season}, matchweek {state.clock.week} · {state.legacy.trophies.length} trophies
          </p>
        </div>
      ),
    });
    if (!ok) return;
    setBusy(true);
    await abandon();
    setBusy(false);
    navigate(ROUTES.splash);
  };

  return (
    <Screen
      title="Settings"
      subtitle="Presentation, accessibility and your save"
      aside={
        <GlassPanel title="Your save" padding="md">
          <KeyValueRow label="Club" value={state.clubs[state.playerClubId]?.shortName ?? '—'} />
          <KeyValueRow label="Season" value={state.clock.season} />
          <KeyValueRow label="Matchweek" value={state.clock.week} />
          <KeyValueRow label="Seed" value={state.seed} hint="Two saves with the same seed build the same world" />
          <KeyValueRow
            label="Last written"
            value={meta ? new Date(meta.savedAt).toLocaleString() : 'Not yet'}
            divided={false}
          />
          <GlassButton
            className="mt-3"
            variant="secondary"
            size="sm"
            block
            loading={busy}
            onClick={() => { void save(); toast.success('Saved'); }}
          >
            Save now
          </GlassButton>
        </GlassPanel>
      }
    >
      <GlassPanel title="Matchday" padding="md">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">Match speed</p>
            <GlassSegmented
              options={SPEEDS}
              value={settings.matchSpeed}
              onChange={(matchSpeed) => updateSettings({ matchSpeed })}
              aria-label="Match speed"
              block
              nested
          size="sm"
        />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">Presentation</p>
            <GlassSegmented
              options={PRESENTATIONS}
              value={settings.presentation}
              onChange={(presentation) => updateSettings({ presentation })}
              aria-label="Match presentation"
              block
              nested
            />
            <p className="mt-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
              {PRESENTATION_BLURB[settings.presentation]}
            </p>
          </div>
          <GlassToggle
            asRow
            label="Commentary"
            description="Written commentary on every match event."
            checked={settings.commentary}
            onChange={(commentary) => updateSettings({ commentary })}
          />
          <GlassToggle
            asRow
            label="Auto-resolve live decisions"
            description="If you do not answer a live prompt in time, pick the safe option automatically."
            checked={settings.autoDecisionTimeout}
            onChange={(autoDecisionTimeout) => updateSettings({ autoDecisionTimeout })}
          />
        </div>
      </GlassPanel>

      <GlassPanel title="Accessibility" padding="md">
        <GlassToggle
          asRow
          label="Reduce motion"
          description="Removes transitions and cinematic movement. Your device setting is honoured regardless; this forces it on."
          checked={settings.reducedMotion}
          onChange={(reducedMotion) => updateSettings({ reducedMotion })}
        />
        <GlassToggle
          asRow
          label="Reduce effects"
          description="Turns off the glass blur. Use this if the interface feels heavy on your device."
          checked={reducedEffects}
          onChange={setReducedEffects}
        />
        <GlassToggle
          asRow
          label="Haptics"
          description="Vibration feedback on presses and match moments."
          checked={settings.haptics}
          onChange={(haptics) => updateSettings({ haptics })}
        />
        <GlassToggle
          asRow
          label="Sound effects"
          description="Whistles, the crowd, and the moments worth hearing. Nothing plays until you touch the screen."
          checked={settings.sound}
          onChange={(sound) => updateSettings({ sound })}
        />
      </GlassPanel>

      <GlassPanel title="Difficulty" padding="md">
        <GlassSegmented
          options={DIFFICULTIES}
          value={settings.difficulty}
          onChange={(difficulty) => updateSettings({ difficulty })}
          aria-label="Difficulty"
          block
          nested
          size="sm"
        />
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted text-pretty">
          {DIFFICULTY_BLURB[settings.difficulty]}
        </p>
      </GlassPanel>

      <GlassPanel title="Region" padding="md">
        <GlassSegmented
          options={REGIONS}
          value={settings.region || 'GLOBAL'}
          onChange={(region) => updateSettings({ region })}
          aria-label="Region"
          block
          nested
          size="sm"
        />
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted text-pretty">
          Region decides which licensed content packs may be shown to you. The base game is
          complete everywhere.
        </p>
        <GlassButton
          className="mt-3"
          variant="secondary"
          size="sm"
          block
          icon={<IconSettings />}
          onClick={() => navigate(ROUTES.contentPacks)}
        >
          Content packs
        </GlassButton>
      </GlassPanel>

      <SectionHeader title="Save management" subtitle="The irreversible corner" />
      <GlassPanel padding="md" accent="danger">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-pill bg-danger/15 text-danger"
          >
            <IconWarning size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">Abandon this save</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
              Deletes the career permanently. There is no undo, and the backup goes with it.
            </p>
          </div>
        </div>
        <Divider className="my-3" />
        <GlassButton
          variant="danger"
          block
          loading={busy}
          onClick={() => void handleAbandon()}
        >
          Abandon save
        </GlassButton>
      </GlassPanel>
    </Screen>
  );
}

export function SettingsScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Settings" />;
  return <SettingsView state={gate.state} />;
}
