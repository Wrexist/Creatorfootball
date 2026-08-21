import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { CommentaryLine } from '../content/schema';
import { BASE_COMMENTARY } from '../content/packs/base/commentary';
import {
  COMMENTARY_TEMPLATES, COMMENTARY_TONES, PACK_TONE_TO_LIVE, CommentaryBook, packLinesToTemplates, render,
} from './commentary';
import { MATCH_EVENT_TYPES } from './events';

describe('the commentary book', () => {
  it('ships enough lines to carry a match without repeating itself', () => {
    expect(COMMENTARY_TEMPLATES.length).toBeGreaterThanOrEqual(150);
  });

  it('has unique ids and spans every tone', () => {
    const ids = new Set(COMMENTARY_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(COMMENTARY_TEMPLATES.length);
    for (const tone of COMMENTARY_TONES) {
      expect(COMMENTARY_TEMPLATES.some((t) => t.tone === tone), tone).toBe(true);
    }
  });

  it('covers every event type the simulator actually emits', () => {
    const covered = new Set(COMMENTARY_TEMPLATES.map((t) => t.event));
    const emitted = MATCH_EVENT_TYPES.filter((t) => t !== 'PERIOD_END' || true);
    const missing = emitted.filter((t) => !covered.has(t));
    // Only the types the engine never emits directly are allowed to be missing.
    expect(missing).toEqual([]);
  });

  it('only references entities through tokens, never a real name', () => {
    for (const t of COMMENTARY_TEMPLATES) {
      const tokens = t.text.match(/\{[a-z]+\}/g) ?? [];
      for (const token of tokens) {
        expect(['{player}', '{club}', '{opponent}', '{minute}', '{score}', '{assist}', '{rule}', '{detail}'])
          .toContain(token);
      }
      expect(t.text.length).toBeGreaterThan(5);
    }
  });

  it('never uses vocabulary claimed by an existing competition', () => {
    const denied = /gamechanger|secret weapon|president penalty|rulebreaker/i;
    for (const t of COMMENTARY_TEMPLATES) expect(t.text).not.toMatch(denied);
  });

  it('substitutes every token and leaves none behind', () => {
    const out = render('{player} for {club} against {opponent} on {minute}, {score}, from {assist}.', {
      player: 'R. Varane', club: 'Northside', opponent: 'Southgate', minute: 14, score: '2-1', assist: 'K. Moro',
    });
    expect(out).toBe('R. Varane for Northside against Southgate on 14, 2-1, from K. Moro.');
    expect(render('{player}', {})).not.toMatch(/\{/);
  });
});

describe('the selector', () => {
  it('exhausts the pool before repeating a line', () => {
    const book = new CommentaryBook(new Rng('sel'));
    const pool = COMMENTARY_TEMPLATES.filter((t) => t.event === 'GOAL' && !t.tags).length;
    const seen = new Set<string>();
    for (let i = 0; i < pool; i++) seen.add(book.line('GOAL', { player: 'X', score: '1-0' }));
    expect(seen.size).toBe(pool);
  });

  it('recycles rather than going silent once the pool is spent', () => {
    const book = new CommentaryBook(new Rng('sel2'));
    for (let i = 0; i < 200; i++) {
      expect(book.line('GOAL', { player: 'X' }).length).toBeGreaterThan(0);
    }
  });

  it('prefers a matching variant and never returns one meant for another', () => {
    const byText = new Map(COMMENTARY_TEMPLATES.map((t) => [render(t.text, {
      player: 'X', club: 'C', opponent: 'O', minute: 1, score: '0-0', assist: 'A',
    }), t]));
    const book = new CommentaryBook(new Rng('sel3'));
    let matched = 0;
    for (let i = 0; i < 40; i++) {
      const line = book.line('GOAL', {
        player: 'X', club: 'C', opponent: 'O', minute: 1, score: '0-0', assist: 'A',
      }, { tags: ['header'] });
      const template = byText.get(line);
      // A generic, untagged line is always allowed; a line tagged for a
      // different variant never is.
      if (template?.tags) {
        expect(template.tags).toContain('header');
        matched += 1;
      }
    }
    expect(matched).toBeGreaterThan(0);
  });

  it('is deterministic for a given stream', () => {
    const a = new CommentaryBook(new Rng('same'));
    const b = new CommentaryBook(new Rng('same'));
    for (let i = 0; i < 20; i++) {
      expect(a.line('SHOT', { player: 'X' })).toBe(b.line('SHOT', { player: 'X' }));
    }
  });

  it('falls back to something readable for an unseeded event type', () => {
    const book = new CommentaryBook(new Rng('sel4'));
    expect(book.line('MATCH_START', {}).length).toBeGreaterThan(0);
  });
});

/**
 * The authored bank in the base pack was loaded into the registry and then read
 * by nobody: the live book only ever saw its own built-in table. These tests
 * pin the merge — registry lines join the pool, their tone vocabulary is
 * translated explicitly, and a headless engine with no pack still works.
 */
describe('merging registry commentary', () => {
  const packLine = (over: Partial<CommentaryLine> & { id: string; text: string }): CommentaryLine => ({
    eventType: 'SHOT', tone: 'NEUTRAL', weight: 1, ...over,
  });

  it('maps every pack tone onto a live tone, explicitly', () => {
    const packTones: readonly CommentaryLine['tone'][] = ['NEUTRAL', 'HYPE', 'CRITICAL', 'DRAMATIC', 'WRY'];
    for (const tone of packTones) {
      expect(COMMENTARY_TONES).toContain(PACK_TONE_TO_LIVE[tone]);
    }
    // The pack's CRITICAL voice is cold judgment of a mistake — the live book
    // expresses that as ANALYTICAL. The mapping must be deliberate, not lost.
    expect(PACK_TONE_TO_LIVE.CRITICAL).toBe('ANALYTICAL');
  });

  it('reads registry lines that no runtime ever read before', () => {
    const mine = packLine({ id: 'pack_x1', text: '{player} pings one from the merged bank.', tone: 'NEUTRAL', weight: 500 });
    const book = new CommentaryBook(new Rng('merge'), [mine]);
    // The heavy weight makes the authored line win its first selection.
    expect(book.line('SHOT', { player: 'X' })).toBe('X pings one from the merged bank.');
  });

  it('still speaks from the built-in bank when there is no pack', () => {
    for (let i = 0; i < 20; i++) {
      expect(new CommentaryBook(new Rng('headless')).line('SHOT', { player: 'X' }).length)
        .toBeGreaterThan(0);
    }
    // And an empty pack is the same as no pack at all.
    const bare = new CommentaryBook(new Rng('headless2'));
    const empty = new CommentaryBook(new Rng('headless2'), []);
    expect(empty.line('SHOT', { player: 'X' })).toBe(bare.line('SHOT', { player: 'X' }));
  });

  it('skips pack lines bound to unknown event types or carrying conditions', () => {
    const gated = packLine({ id: 'pack_g1', text: '{player} never appears.', tone: 'HYPE', weight: 9_000, conditions: { reputation: 50 } });
    const stray = packLine({ id: 'pack_s1', text: '{player} also never appears.', tone: 'HYPE', weight: 9_000, eventType: 'NOT_A_MATCH_EVENT' });
    const book = new CommentaryBook(new Rng('gated'), [gated, stray]);
    for (let i = 0; i < 30; i++) {
      const line = book.line('SHOT', { player: 'X' });
      expect(line).not.toContain('never appears');
    }
  });

  it('is deterministic for a given stream and pack', () => {
    const pack = BASE_COMMENTARY.slice(0, 40);
    const a = new CommentaryBook(new Rng('same-pack'), pack);
    const b = new CommentaryBook(new Rng('same-pack'), pack);
    for (let i = 0; i < 25; i++) {
      expect(a.line('GOAL', { player: 'X', score: '1-0' })).toBe(b.line('GOAL', { player: 'X', score: '1-0' }));
    }
  });

  it('converts only schema-valid lines and keeps the weight through the merge', () => {
    const converted = packLinesToTemplates([
      packLine({ id: 'pack_c1', text: '{player} tries his luck.', tone: 'CRITICAL', weight: 7 }),
    ]);
    expect(converted).toHaveLength(1);
    expect(converted[0]?.tone).toBe('ANALYTICAL');
    expect(converted[0]?.weight).toBe(7);
    expect(MATCH_EVENT_TYPES).toContain(converted[0]?.event);
  });
});

describe('the base pack commentary depth', () => {
  // Depth where the events are frequent: these six types fire dozens of times
  // per match, and each used to recycle after a handful of lines.
  const FLOORS: Readonly<Record<string, number>> = {
    SHOT: 26, MISS: 23, SAVE: 23, PASS: 15, CARRY: 15, CROSS: 15,
  };
  for (const [eventType, floor] of Object.entries(FLOORS)) {
    it(`ships real depth for ${eventType}`, () => {
      expect(BASE_COMMENTARY.filter((c) => c.eventType === eventType).length,
        `thin pack commentary for ${eventType}`).toBeGreaterThanOrEqual(floor);
    });
  }
});
