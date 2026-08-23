import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SFX_CUES, installAudioUnlock, resetAudioForTests, setAudioDriver, setSfxEnabled, sfx, sfxEnabled,
  type AudioDriver, type SfxCue, type SfxOptions,
} from './audio';

/**
 * The driver contract, tested against a fake.
 *
 * Two properties matter more than any waveform: a cue must never escape the
 * settings toggle, and a platform with no audio at all must be indistinguishable
 * from a quiet one. The synthesis itself is deliberately not asserted — the test
 * environment is Node, where there is no `AudioContext`, which is exactly the
 * no-op case the third block below pins down.
 */

interface Spy extends AudioDriver {
  readonly played: { cue: SfxCue; options?: SfxOptions }[];
  readonly ambienceCalls: boolean[];
  readonly suspends: number;
  readonly resumes: number;
}

function spyDriver(): Spy {
  const driver = {
    played: [] as { cue: SfxCue; options?: SfxOptions }[],
    ambienceCalls: [] as boolean[],
    suspends: 0,
    resumes: 0,
    play(cue: SfxCue, options?: SfxOptions) {
      driver.played.push({ cue, options });
    },
    ambience(on: boolean) {
      driver.ambienceCalls.push(on);
    },
    suspend() {
      driver.suspends += 1;
    },
    resume() {
      driver.resumes += 1;
    },
  };
  return driver as unknown as Spy;
}

afterEach(() => {
  resetAudioForTests();
});

describe('sfx dispatch', () => {
  it('sends every cue to the installed driver', () => {
    const driver = spyDriver();
    setAudioDriver(driver);

    sfx.tick();
    sfx.select();
    sfx.kickOff();
    sfx.fullTime();
    sfx.goal();
    sfx.decisionTick();
    sfx.trophy();
    sfx.signing();
    sfx.reward();

    expect(driver.played.map((p) => p.cue)).toEqual([...SFX_CUES]);
  });

  it('passes intensity through for the cues that escalate', () => {
    const driver = spyDriver();
    setAudioDriver(driver);

    sfx.goal(0.35);
    sfx.decisionTick(1);

    expect(driver.played[0]?.options).toEqual({ intensity: 0.35 });
    expect(driver.played[1]?.options).toEqual({ intensity: 1 });
  });

  it('survives a driver that throws on every call', () => {
    setAudioDriver({
      play() { throw new Error('device lost'); },
      ambience() { throw new Error('device lost'); },
    });

    expect(() => sfx.goal()).not.toThrow();
    expect(() => sfx.ambience(true)).not.toThrow();
  });
});

describe('the settings toggle gates everything', () => {
  it('defaults to on', () => {
    expect(sfxEnabled()).toBe(true);
  });

  it('plays nothing at all while sound is off', () => {
    const driver = spyDriver();
    setAudioDriver(driver);
    setSfxEnabled(false);

    for (const cue of SFX_CUES) sfx.fire(cue);
    sfx.ambience(true);

    expect(sfxEnabled()).toBe(false);
    expect(driver.played).toEqual([]);
    expect(driver.ambienceCalls.every((on) => on === false)).toBe(true);
  });

  it('stops the crowd bed and suspends the hardware the moment it is switched off', () => {
    const driver = spyDriver();
    setAudioDriver(driver);
    sfx.ambience(true);
    expect(driver.ambienceCalls.at(-1)).toBe(true);

    setSfxEnabled(false);

    expect(driver.ambienceCalls.at(-1)).toBe(false);
    expect(driver.suspends).toBe(1);
  });

  it('restores the bed when sound comes back on, because the match is still running', () => {
    const driver = spyDriver();
    setAudioDriver(driver);
    sfx.ambience(true);
    setSfxEnabled(false);
    setSfxEnabled(true);

    expect(driver.resumes).toBe(1);
    expect(driver.ambienceCalls.at(-1)).toBe(true);
  });

  it('does not restore a bed nobody asked for', () => {
    const driver = spyDriver();
    setAudioDriver(driver);
    setSfxEnabled(false);
    setSfxEnabled(true);

    expect(driver.ambienceCalls.every((on) => on === false)).toBe(true);
  });
});

describe('the no-op fallback', () => {
  it('is silent, and silent safely, with no WebAudio on the platform', () => {
    // Node: no `window`, therefore no `AudioContext`, therefore no driver.
    expect(typeof globalThis.window).toBe('undefined');

    for (const cue of SFX_CUES) expect(() => sfx.fire(cue)).not.toThrow();
    expect(() => sfx.ambience(true)).not.toThrow();
    expect(() => sfx.ambience(false)).not.toThrow();
    expect(() => setSfxEnabled(false)).not.toThrow();
    expect(() => setSfxEnabled(true)).not.toThrow();
  });

  it('installs no listeners when there is no document to listen to', () => {
    // The unlock hook is called unconditionally from app boot; off-DOM it must
    // hand back a teardown rather than reaching for `window`.
    expect(() => installAudioUnlock()()).not.toThrow();
  });

  it('falls back to the built-in engine when a custom driver is removed', () => {
    const driver = spyDriver();
    setAudioDriver(driver);
    sfx.tick();
    expect(driver.played).toHaveLength(1);

    setAudioDriver(null);
    sfx.tick();

    // Still one: the built-in engine is unavailable in Node, so the second tick
    // went nowhere — but it did not throw, and it did not reach the old driver.
    expect(driver.played).toHaveLength(1);
  });
});

describe('driver replacement', () => {
  it('disposes the driver it replaces', () => {
    const dispose = vi.fn();
    setAudioDriver({ play() {}, ambience() {}, dispose });
    setAudioDriver(spyDriver());
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
