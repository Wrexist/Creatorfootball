import { useMemo } from 'react';
import { hashSeed } from './seed';

/**
 * Sound effects abstraction — the audio twin of `haptics.ts`.
 *
 * Components call `sfx.goal()` and never learn what an `AudioContext` is. The
 * contract is identical to haptics: one flat set of named cues, a driver behind
 * them, a settings-bound enable flag, and a silent no-op whenever the platform
 * cannot oblige. Nothing here ever throws into a caller — a cue that fails is a
 * cue that did not play, never a button press that did not register.
 *
 * ## Why synthesis rather than audio files
 *
 * The repo's prime directive is procedural-first: every asset is an override
 * layer over a working generated path, and a missing file must never be
 * load-bearing. Ten `.m4a` files in `public/audio/` would be ten chances to 404
 * on a cold cache, ten licences to track, and ~300KB of download before the
 * first whistle. Every cue below is instead built at play time out of
 * oscillators, seeded noise buffers, biquad filters and envelopes: zero bytes on
 * disk, zero network, zero decode latency, and a "broadcast package" palette
 * that can be tuned by changing a number rather than re-exporting a stem.
 *
 * A hand-made pack can still arrive later — install an `AudioDriver` that plays
 * files and the synthesised engine steps aside, exactly as the native shell
 * installs a haptic driver.
 *
 * ## The three rules the engine holds to
 *
 *   - **Lazy.** No `window`, no `AudioContext`, nothing at module scope. The
 *     context is created on the first cue and resumed on the first user
 *     gesture, because every browser refuses audio before one. This file is
 *     therefore safe to import from a test runner or a server render.
 *   - **Quiet.** Cues are short (< ~1.5s) and mixed low. Ambience is a floor,
 *     not a texture; UI ticks are rationed to interactions that mean something.
 *   - **Interruptible.** Switching the setting off, or hiding the tab, stops
 *     the ambience bed and suspends the context so a backgrounded match makes
 *     no sound and burns no CPU.
 */

/* --- the cue vocabulary ------------------------------------------------ */

export const SFX_CUES = [
  /** A value moved under the finger: tab switch, segmented control. Very sparse. */
  'uiTick',
  /** A choice was committed: primary button, confirmed option. */
  'uiSelect',
  /** One long peep. The match is on. */
  'kickOff',
  /** Three peeps. It is over. */
  'fullTime',
  /** The crowd noise swell behind a goal. */
  'goalRoar',
  /** The decision countdown. `intensity` escalates it as the ring drains. */
  'decisionTick',
  /** Gold arpeggio. Trophies only. */
  'trophyFanfare',
  /** The signing reveal: low swell into a bell. */
  'signingSting',
  /** Something was earned: objective claimed, reward opened. */
  'rewardChime',
] as const;

export type SfxCue = (typeof SFX_CUES)[number];

export interface SfxOptions {
  /** 0..1. Only some cues read it; the rest ignore it. */
  readonly intensity?: number;
}

/**
 * What a platform must provide to make noise. The built-in WebAudio engine
 * implements this; a native shell (or a future sample-based pack) can replace
 * it wholesale via `setAudioDriver`.
 */
export interface AudioDriver {
  play(cue: SfxCue, options?: SfxOptions): void;
  /** Start or stop the crowd bed. Idempotent. */
  ambience(on: boolean): void;
  /** A user gesture just happened — a good moment to create/resume hardware. */
  unlock?(): void;
  /** The tab went away, or sound was switched off. */
  suspend?(): void;
  resume?(): void;
  /** Release everything. */
  dispose?(): void;
}

/* --- module state ------------------------------------------------------ */

let override: AudioDriver | null = null;
let builtIn: AudioDriver | null | undefined;
let enabled = true;
let ambienceWanted = false;
/** Assume visible until something tells us otherwise; SSR has no document. */
let visible = true;
let unlockTeardown: (() => void) | null = null;

/**
 * Installed by a shell that wants to own playback. Passing null restores the
 * built-in WebAudio engine (or the no-op, where WebAudio is unavailable).
 */
export function setAudioDriver(next: AudioDriver | null): void {
  if (override && override !== next) safely(() => override?.dispose?.());
  override = next;
  // Whatever is now in charge inherits the state the old driver held.
  syncAmbience();
}

/** Resets everything this module remembers. Tests only. */
export function resetAudioForTests(): void {
  safely(() => override?.dispose?.());
  safely(() => builtIn?.dispose?.());
  override = null;
  builtIn = undefined;
  enabled = true;
  ambienceWanted = false;
  visible = true;
  unlockTeardown?.();
  unlockTeardown = null;
}

/** Bound to `GameSettings.sound`. */
export function setSfxEnabled(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  if (!enabled) {
    // Stop the bed immediately rather than at the next natural boundary: a
    // player reaching for this switch wants silence now.
    safely(() => currentDriver()?.ambience(false));
    safely(() => currentDriver()?.suspend?.());
  } else {
    safely(() => currentDriver()?.resume?.());
    syncAmbience();
  }
}

export function sfxEnabled(): boolean {
  return enabled;
}

/** The driver in charge right now, or null if this platform cannot play audio. */
function currentDriver(): AudioDriver | null {
  if (override) return override;
  if (builtIn === undefined) builtIn = createWebAudioDriver();
  return builtIn;
}

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    /* audio is strictly decorative — failure is silent by design */
  }
}

function syncAmbience(): void {
  const driver = currentDriver();
  if (!driver) return;
  safely(() => driver.ambience(enabled && ambienceWanted && visible));
}

function fire(cue: SfxCue, options?: SfxOptions): void {
  if (!enabled || !visible) return;
  const driver = currentDriver();
  if (!driver) return;
  safely(() => driver.play(cue, options));
}

/* --- the public surface ------------------------------------------------- */

export const sfx = {
  /** Sparse. Tabs and segmented controls, not every tap. */
  tick: () => fire('uiTick'),
  /** A choice committed: primary action, decision option picked. */
  select: () => fire('uiSelect'),
  kickOff: () => fire('kickOff'),
  fullTime: () => fire('fullTime'),
  /** `intensity` 1 for our goal, lower for a goal against. */
  goal: (intensity = 1) => fire('goalRoar', { intensity }),
  /** `intensity` 0 at the start of the countdown, 1 on the last second. */
  decisionTick: (intensity = 0) => fire('decisionTick', { intensity }),
  trophy: () => fire('trophyFanfare'),
  signing: () => fire('signingSting'),
  reward: () => fire('rewardChime'),

  /**
   * The crowd bed. Live match only — it is a floor under the match, and a menu
   * that hums is a menu the player mutes.
   */
  ambience: (on: boolean): void => {
    ambienceWanted = on;
    syncAmbience();
  },

  fire,
} as const;

/** Stable identity so it can sit in a dependency array without re-running. */
export function useSfx(): typeof sfx {
  return useMemo(() => sfx, []);
}

/**
 * Wires the two browser facts this module cannot learn on its own: the first
 * user gesture (which is the only moment an `AudioContext` may start) and page
 * visibility (a hidden tab must fall silent). Called once from app boot;
 * returns its own teardown.
 */
export function installAudioUnlock(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  unlockTeardown?.();

  const onGesture = (): void => {
    // Create the context inside the gesture, whether or not a cue is due:
    // a context created later, from a timer, starts suspended on iOS.
    safely(() => currentDriver()?.unlock?.());
  };
  const onVisibility = (): void => {
    visible = document.visibilityState !== 'hidden';
    if (visible) safely(() => currentDriver()?.resume?.());
    else safely(() => currentDriver()?.suspend?.());
    syncAmbience();
  };

  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture);
  document.addEventListener('visibilitychange', onVisibility);
  visible = document.visibilityState !== 'hidden';

  const teardown = (): void => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    document.removeEventListener('visibilitychange', onVisibility);
    if (unlockTeardown === teardown) unlockTeardown = null;
  };
  unlockTeardown = teardown;
  return teardown;
}

/* ======================================================================== *
 * The synthesised engine.
 *
 * Everything below is one implementation of `AudioDriver`. It is exported so a
 * test can build one against a mock context, but nothing in the product refers
 * to it directly.
 * ======================================================================== */

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Master trim. Individual cue peaks below are relative to this. */
const MASTER = 0.5;
/** Audio params reject 0 in exponential ramps; this is the practical floor. */
const SILENCE = 0.0001;

/**
 * A tiny xorshift, seeded from the cue's name.
 *
 * Noise buffers need tens of thousands of samples, so `SeedStream`'s per-value
 * string hashing is the wrong shape here — but `Math.random()` is banned in the
 * app layer (it desynchronises from the simulation and the linter enforces it),
 * and rightly so. This keeps the determinism: the same buffer every session, on
 * every device, for the same seed.
 */
function noiseSampler(seed: string): () => number {
  let x = hashSeed(seed) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return (x / 0x100000000) * 2 - 1;
  };
}

export function createWebAudioDriver(): AudioDriver | null {
  const maybeCtor = audioContextCtor();
  if (!maybeCtor) return null;
  const Ctor: AudioContextCtor = maybeCtor;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let bed: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  const buffers = new Map<string, AudioBuffer>();

  function ensure(): AudioContext | null {
    if (!ctx) {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    // Browsers park the context whenever it was built outside a gesture, and
    // again every time the page is backgrounded. Asking is cheap; a suspended
    // context silently swallows everything scheduled on it.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  }

  /* --- primitives ------------------------------------------------------ */

  /** White-ish (`tilt` 0) to brown-ish (`tilt` 1) noise, cached per seed. */
  function noise(context: AudioContext, seconds: number, seed: string, tilt = 0): AudioBuffer {
    const key = `${seed}:${seconds}:${tilt}`;
    const cached = buffers.get(key);
    if (cached) return cached;

    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    const sample = noiseSampler(seed);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = sample();
      // A one-pole low-pass, run at `tilt` strength, is the cheapest honest
      // brown noise there is. The gain compensates for what it removes.
      last = last * 0.96 * tilt + white * (1 - 0.96 * tilt);
      data[i] = (tilt > 0 ? last * (1 + 2.6 * tilt) : white) * 0.9;
    }
    buffers.set(key, buffer);
    return buffer;
  }

  /**
   * Attack/decay on a gain node. Exponential in both directions because linear
   * fades read as clicks at these lengths.
   */
  function shape(gain: GainNode, at: number, peak: number, attack: number, decay: number): void {
    const g = gain.gain;
    g.setValueAtTime(SILENCE, at);
    g.exponentialRampToValueAtTime(Math.max(SILENCE, peak), at + attack);
    g.exponentialRampToValueAtTime(SILENCE, at + attack + decay);
  }

  interface ToneSpec {
    at: number;
    freq: number;
    /** Glide target, if the note bends. */
    to?: number;
    type?: OscillatorType;
    peak: number;
    attack?: number;
    decay: number;
    /** Optional low-pass, so a saw or square never arrives as a buzz. */
    cutoff?: number;
  }

  function tone(context: AudioContext, spec: ToneSpec): void {
    const { at, freq, to, type = 'sine', peak, attack = 0.006, decay, cutoff } = spec;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + attack + decay);

    const gain = context.createGain();
    shape(gain, at, peak, attack, decay);

    let tail: AudioNode = gain;
    if (cutoff !== undefined) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, at);
      gain.connect(filter);
      tail = filter;
    }
    osc.connect(gain);
    if (master) tail.connect(master);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  }

  interface NoiseSpec {
    at: number;
    seconds: number;
    seed: string;
    tilt?: number;
    peak: number;
    attack?: number;
    decay: number;
    filter?: BiquadFilterType;
    freq?: number;
    freqTo?: number;
    q?: number;
  }

  function noiseBurst(context: AudioContext, spec: NoiseSpec): void {
    const {
      at, seconds, seed, tilt = 0, peak, attack = 0.01, decay,
      filter = 'lowpass', freq = 1200, freqTo, q = 0.9,
    } = spec;

    const source = context.createBufferSource();
    source.buffer = noise(context, seconds, seed, tilt);

    const band = context.createBiquadFilter();
    band.type = filter;
    band.frequency.setValueAtTime(freq, at);
    if (freqTo !== undefined) band.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), at + attack + decay);
    band.Q.value = q;

    const gain = context.createGain();
    shape(gain, at, peak, attack, decay);

    source.connect(band);
    band.connect(gain);
    if (master) gain.connect(master);
    source.start(at);
    source.stop(at + attack + decay + 0.05);
  }

  /**
   * A referee's pea whistle: two close sine partials, warbled by a low-frequency
   * oscillator, over a band of breath noise. Pitched high but mixed low — this
   * is the one cue that can genuinely hurt at volume.
   */
  function whistle(context: AudioContext, at: number, length: number, peak: number): void {
    const gain = context.createGain();
    gain.gain.setValueAtTime(SILENCE, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.03);
    gain.gain.setValueAtTime(peak, at + length - 0.07);
    gain.gain.exponentialRampToValueAtTime(SILENCE, at + length);

    const lfo = context.createOscillator();
    lfo.frequency.value = 22;
    const lfoDepth = context.createGain();
    lfoDepth.gain.value = 55;
    lfo.connect(lfoDepth);

    for (const [freq, level] of [[2320, 1], [3160, 0.42]] as const) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, at);
      lfoDepth.connect(osc.frequency);
      const trim = context.createGain();
      trim.gain.value = level;
      osc.connect(trim);
      trim.connect(gain);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }

    const breath = context.createBufferSource();
    breath.buffer = noise(context, 0.6, 'whistle-breath');
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2900;
    band.Q.value = 6;
    const breathGain = context.createGain();
    breathGain.gain.value = 0.16;
    breath.connect(band);
    band.connect(breathGain);
    breathGain.connect(gain);
    breath.start(at);
    breath.stop(at + length + 0.05);

    lfo.start(at);
    lfo.stop(at + length + 0.05);
    if (master) gain.connect(master);
  }

  /* --- the cues -------------------------------------------------------- */

  function render(cue: SfxCue, context: AudioContext, options?: SfxOptions): void {
    const t = context.currentTime + 0.01;
    const intensity = Math.min(1, Math.max(0, options?.intensity ?? 0));

    switch (cue) {
      case 'uiTick':
        tone(context, { at: t, freq: 1560, type: 'triangle', peak: 0.045, attack: 0.003, decay: 0.032, cutoff: 5200 });
        break;

      case 'uiSelect':
        // A rising pair. Up means "taken", and it is the whole reason this is
        // two notes rather than a louder one.
        tone(context, { at: t, freq: 760, type: 'triangle', peak: 0.06, attack: 0.004, decay: 0.055, cutoff: 4200 });
        tone(context, { at: t + 0.05, freq: 1140, type: 'triangle', peak: 0.05, attack: 0.004, decay: 0.09, cutoff: 5200 });
        break;

      case 'kickOff':
        whistle(context, t, 0.42, 0.13);
        break;

      case 'fullTime':
        whistle(context, t, 0.15, 0.12);
        whistle(context, t + 0.24, 0.15, 0.12);
        whistle(context, t + 0.48, 0.52, 0.13);
        break;

      case 'goalRoar': {
        // The swell is the cue; the sub and the stab only give it a front edge.
        const level = 0.34 * (0.55 + 0.45 * intensity);
        noiseBurst(context, {
          at: t, seconds: 1.6, seed: 'goal-roar', tilt: 0.55,
          peak: level, attack: 0.34, decay: 0.95,
          filter: 'lowpass', freq: 320, freqTo: 1750, q: 1.2,
        });
        tone(context, { at: t, freq: 96, to: 54, type: 'sine', peak: 0.2 * intensity + 0.06, attack: 0.012, decay: 0.5 });
        tone(context, { at: t, freq: 880, to: 1320, type: 'triangle', peak: 0.07, attack: 0.008, decay: 0.26, cutoff: 5000 });
        break;
      }

      case 'decisionTick': {
        // Escalation is pitch and bite, not volume: a countdown that simply gets
        // louder is a countdown the player turns off.
        const freq = 720 + 460 * intensity;
        tone(context, {
          at: t, freq, type: intensity > 0.66 ? 'square' : 'triangle',
          peak: 0.035 + 0.03 * intensity, attack: 0.003, decay: 0.045 + 0.02 * intensity,
          cutoff: 2200 + 1800 * intensity,
        });
        if (intensity > 0.85) {
          tone(context, { at: t + 0.055, freq: freq * 1.5, type: 'triangle', peak: 0.03, attack: 0.003, decay: 0.05, cutoff: 5000 });
        }
        break;
      }

      case 'trophyFanfare': {
        // D major over four notes, ending an octave up. Bright, brief, and the
        // only cue allowed to feel like a fanfare.
        const notes = [587.33, 739.99, 880, 1174.66];
        notes.forEach((freq, i) => {
          const at = t + i * 0.085;
          const last = i === notes.length - 1;
          tone(context, { at, freq, type: 'triangle', peak: 0.085, attack: 0.006, decay: last ? 0.85 : 0.34, cutoff: 6500 });
          tone(context, { at, freq: freq * 2, type: 'sine', peak: 0.03, attack: 0.006, decay: last ? 0.6 : 0.22 });
        });
        noiseBurst(context, {
          at: t + 0.24, seconds: 0.9, seed: 'trophy-shimmer',
          peak: 0.03, attack: 0.16, decay: 0.6, filter: 'highpass', freq: 4200, q: 0.7,
        });
        break;
      }

      case 'signingSting':
        // A rise that resolves onto a bell: the card is handed to you.
        tone(context, { at: t, freq: 196, to: 392, type: 'sine', peak: 0.16, attack: 0.05, decay: 0.34 });
        noiseBurst(context, {
          at: t, seconds: 0.8, seed: 'signing-whoosh', tilt: 0.3,
          peak: 0.06, attack: 0.3, decay: 0.24, filter: 'highpass', freq: 420, freqTo: 3200, q: 0.8,
        });
        tone(context, { at: t + 0.3, freq: 784, type: 'sine', peak: 0.09, attack: 0.005, decay: 0.55, cutoff: 6000 });
        tone(context, { at: t + 0.3, freq: 1176, type: 'sine', peak: 0.045, attack: 0.005, decay: 0.4 });
        break;

      case 'rewardChime':
        tone(context, { at: t, freq: 1046.5, type: 'sine', peak: 0.075, attack: 0.005, decay: 0.5 });
        tone(context, { at: t + 0.06, freq: 1568, type: 'sine', peak: 0.05, attack: 0.005, decay: 0.42 });
        tone(context, { at: t + 0.12, freq: 2093, type: 'sine', peak: 0.025, attack: 0.005, decay: 0.3 });
        break;
    }
  }

  /* --- the crowd bed --------------------------------------------------- */

  function startBed(context: AudioContext): void {
    if (bed) {
      // Already running (or fading out) — pull it back up rather than stacking
      // a second source on top of the first.
      bed.gain.gain.cancelScheduledValues(context.currentTime);
      bed.gain.gain.setValueAtTime(Math.max(SILENCE, bed.gain.gain.value), context.currentTime);
      bed.gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 1.2);
      return;
    }

    const source = context.createBufferSource();
    source.buffer = noise(context, 4, 'crowd-bed', 0.85);
    source.loop = true;

    const body = context.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 420;
    body.Q.value = 0.6;

    const gain = context.createGain();
    gain.gain.setValueAtTime(SILENCE, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 1.2);

    // A very slow breathe, so the bed never sits perfectly still and reveals
    // its four-second loop point.
    const swell = context.createOscillator();
    swell.frequency.value = 0.06;
    const swellDepth = context.createGain();
    swellDepth.gain.value = 0.018;
    swell.connect(swellDepth);
    swellDepth.connect(gain.gain);
    swell.start();

    source.connect(body);
    body.connect(gain);
    if (master) gain.connect(master);
    source.start();

    bed = { source, gain };
  }

  function stopBed(context: AudioContext): void {
    if (!bed) return;
    const { source, gain } = bed;
    bed = null;
    const at = context.currentTime;
    gain.gain.cancelScheduledValues(at);
    gain.gain.setValueAtTime(Math.max(SILENCE, gain.gain.value), at);
    gain.gain.exponentialRampToValueAtTime(SILENCE, at + 0.7);
    // Stopping the source is what actually frees it; the fade is only so the
    // crowd leaves the stadium rather than being switched off at the mains.
    try {
      source.stop(at + 0.75);
    } catch {
      /* already stopped */
    }
  }

  return {
    play(cue, options) {
      const context = ensure();
      if (!context) return;
      render(cue, context, options);
    },
    ambience(on) {
      if (!on) {
        // Never build a context just to be told to be quiet.
        if (ctx) stopBed(ctx);
        return;
      }
      const context = ensure();
      if (!context) return;
      startBed(context);
    },
    unlock() {
      ensure();
    },
    suspend() {
      if (ctx) stopBed(ctx);
      void ctx?.suspend?.().catch(() => {});
    },
    resume() {
      void ctx?.resume?.().catch(() => {});
    },
    dispose() {
      if (ctx) stopBed(ctx);
      buffers.clear();
      void ctx?.close?.().catch(() => {});
      ctx = null;
      master = null;
    },
  };
}
