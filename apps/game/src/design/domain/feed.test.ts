import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STORY_MOTIFS, StoryArt, displayTags, storyMotifFor, type StoryMotif } from './feed';

/**
 * Editorial art is the only picture in the news feed, and it is chosen from the
 * story's own tags rather than authored per story — so the mapping is the whole
 * asset. Two things must hold: the classification agrees with what a reader
 * would call the story, and an unrecognised story still gets a picture.
 */

const markup = (props: { seed: string; motif?: StoryMotif | null }): string =>
  renderToStaticMarkup(createElement(StoryArt, props));

describe('storyMotifFor', () => {
  const cases: readonly (readonly [string, StoryMotif])[] = [
    ['trigger:TRANSFER_COMPLETED', 'transfer'],
    ['trigger:MARQUEE_SIGNING', 'transfer'],
    ['trigger:CONTRACT_EXPIRING', 'transfer'],
    ['trigger:INJURY_BLOW', 'injury'],
    ['trigger:PLAYER_RECOVERED', 'injury'],
    ['trigger:RED_CARD', 'injury'],
    ['trigger:DERBY_DEFEAT', 'rivalry'],
    ['trigger:EMERGENT_RIVALRY_BOILING', 'rivalry'],
    ['trigger:QUOTE_DUNK', 'rivalry'],
    ['trigger:FAN_UNREST', 'fans'],
    ['trigger:ATTENDANCE_RECORDED', 'fans'],
    ['trigger:CONTENT_DROP', 'fans'],
    ['trigger:STATEMENT_WIN', 'result'],
    ['trigger:MATCH_DRAWN', 'result'],
    ['trigger:TROPHY_WON', 'result'],
  ];

  it.each(cases)('classifies %s as %s', (tag, motif) => {
    expect(storyMotifFor([tag])).toBe(motif);
  });

  it('reads the plain vocabulary a content pack might use', () => {
    expect(storyMotifFor(['derby'])).toBe('rivalry');
    expect(storyMotifFor(['injury', 'squad'])).toBe('injury');
    expect(storyMotifFor(['reaction'])).toBe('result');
  });

  /**
   * A derby result is a rivalry story. If precedence ever flips, every derby in
   * the game illustrates itself with a scoreboard and the feed loses the one
   * fixture it should be loudest about.
   */
  it('prefers rivalry over result when a story is both', () => {
    expect(storyMotifFor(['trigger:DERBY_WIN', 'result'])).toBe('rivalry');
  });

  it('returns null rather than guessing', () => {
    expect(storyMotifFor([])).toBeNull();
    expect(storyMotifFor(undefined)).toBeNull();
    expect(storyMotifFor(['trigger:FACILITY_UPGRADED'])).toBeNull();
    expect(storyMotifFor(['trigger:SPONSOR_SIGNED'])).toBeNull();
  });
});

describe('StoryArt', () => {
  it('draws the seeded bands with no motif, and keeps drawing them with one', () => {
    const plain = markup({ seed: 'story-1' });
    expect(plain).toContain('<svg');
    expect(plain).toContain('aria-hidden="true"');
    for (const motif of STORY_MOTIFS) {
      const withMotif = markup({ seed: 'story-1', motif });
      // The bands survive underneath: the motif is an overlay, never a swap.
      expect(withMotif.length).toBeGreaterThan(plain.length);
      expect(withMotif).toContain('translate(140 46)');
    }
  });

  it('is deterministic for a seed', () => {
    expect(markup({ seed: 'abc', motif: 'transfer' })).toBe(markup({ seed: 'abc', motif: 'transfer' }));
  });

  it('draws a different motif for each kind', () => {
    const drawn = new Set(STORY_MOTIFS.map((motif) => markup({ seed: 'abc', motif })));
    expect(drawn.size).toBe(STORY_MOTIFS.length);
  });
});

describe('displayTags', () => {
  /**
   * A story's tags are two vocabularies sharing one array: topic words meant
   * for the reader, and namespaced keys meant for the engine. The second kind
   * shipped to players as chips on the story sheet — a match report captioned
   * `tpl:md_k_match_lost`, `trigger:SHOCK_DEFEAT`, `mood:NEGATIVE`.
   */
  it('drops every namespaced tag', () => {
    expect(displayTags(['tpl:md_k_match_lost', 'trigger:SHOCK_DEFEAT', 'mood:NEGATIVE']))
      .toEqual([]);
  });

  it('keeps the topic tags and presents them as words', () => {
    expect(displayTags(['match', 'result'])).toEqual(['Match', 'Result']);
    expect(displayTags(['fan_unrest'])).toEqual(['Fan unrest']);
  });

  it('keeps the reader tags out of a list that mixes both', () => {
    expect(displayTags(['match', 'tpl:md_k_match_lost', 'result', 'mood:NEGATIVE']))
      .toEqual(['Match', 'Result']);
  });

  it('hides a prefix nobody has invented yet', () => {
    // Content packs may invent their own vocabulary, so the rule is the
    // separator rather than a list of known prefixes to keep in step with.
    expect(displayTags(['source:community_pack', 'transfer'])).toEqual(['Transfer']);
  });

  it('does not repeat a tag that differs only in case', () => {
    expect(displayTags(['result', 'Result'])).toEqual(['Result']);
  });

  it('answers with an empty list rather than throwing on nothing', () => {
    expect(displayTags(undefined)).toEqual([]);
    expect(displayTags([])).toEqual([]);
  });
});
