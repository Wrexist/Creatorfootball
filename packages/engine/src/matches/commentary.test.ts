import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { COMMENTARY_TEMPLATES, COMMENTARY_TONES, CommentaryBook, render } from './commentary';
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
