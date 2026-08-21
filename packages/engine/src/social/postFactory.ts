import type { SocialTemplate } from '../content/schema';
import type { GameState, SocialPost } from '../game/state';
import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { ContentHook, ContentRegistryPort, SocialPostKind } from '../simulation/ports';
import {
  blendTemplates, matchesConditions, pickTemplate, renderTemplate, templatesForTrigger,
  type TemplateRecency,
} from '../simulation/templating';
import { SOCIAL_BALANCE as S } from './balance';
import { FALLBACK_SOCIAL_TEMPLATES } from './fallbackTemplates';
import { engagementFor, weightFor } from './socialEngine';
import { socialStanding, standingFacts } from './standing';

/**
 * Rendering a post outside the world tick.
 *
 * The interactive layer publishes posts too — the club's own account, the
 * press reacting to a conference, a creator delivering a drop, a supporter
 * reacting to a poll result — and every one of them has to go through the same
 * three gates the world's chatter does:
 *
 *   1. it renders from an authored template, or it is not published at all;
 *   2. it obeys the same anti-repetition ledger, read off the retained feed;
 *   3. its engagement comes from real reach and real stakes, on the same scale.
 *
 * Anything that skipped those would be immediately visible as the one part of
 * the feed that reads like placeholder copy.
 */

export interface PostRenderContext {
  readonly state: GameState;
  readonly cycle: number;
  readonly byKey: ReadonlyMap<string, SocialTemplate[]>;
  readonly recency: TemplateRecency;
  readonly blocked: Set<string>;
  readonly seen: Set<string>;
  readonly usedText: Set<string>;
  readonly standingFacts: Record<string, string | number>;
  readonly reachMultiplier: number;
}

/**
 * Build the shared rendering context once per action or per tick.
 *
 * The recency sets are read straight off `state.social.posts`, exactly as the
 * world tick does, so a line the feed used last week is unavailable to the
 * player's own post this week and vice versa.
 */
export function postRenderContext(
  state: GameState,
  registry: ContentRegistryPort | null,
  cycle: number = state.clock.cycle,
): PostRenderContext {
  const packTemplates = registry?.socialTemplates() ?? [];
  const templates = blendTemplates(packTemplates, FALLBACK_SOCIAL_TEMPLATES, S.builtInWeightWithPack);
  const byKey = new Map<string, SocialTemplate[]>();
  for (const template of templates) {
    const key = `${template.trigger}|${template.authorKind}`;
    const list = byKey.get(key);
    if (list) list.push(template); else byKey.set(key, [template]);
  }

  const blocked = new Set<string>();
  const seen = new Set<string>();
  const usedText = new Set<string>();
  for (const post of state.social.posts) {
    for (const tag of post.tags) {
      if (!tag.startsWith('tpl:')) continue;
      const id = tag.slice(4);
      seen.add(id);
      if (post.cycle >= cycle - S.hardRepeatCycles) blocked.add(id);
    }
    if (post.cycle >= cycle - S.hardRepeatCycles) usedText.add(post.text);
  }

  const standing = socialStanding(state);
  return {
    state,
    cycle,
    byKey,
    recency: { blocked, seen },
    blocked,
    seen,
    usedText,
    standingFacts: standingFacts(standing),
    reachMultiplier: standing.reachMultiplier,
  };
}

export interface PostAuthor {
  readonly kind: SocialPostKind;
  readonly name: string;
  readonly handle: string;
  readonly avatarSeed: string;
  readonly verified: boolean;
  readonly reach: number;
}

export interface PostSpec {
  readonly id: string;
  readonly author: PostAuthor;
  readonly hook: ContentHook;
  /** Overrides the hook's trigger when the author is reacting to a sub-beat. */
  readonly trigger?: string;
  /**
   * Triggers to fall back to when the specific one has nothing that renders.
   *
   * The player can compose about any moment the journal contains, and no pack
   * will ever have a bespoke provocative line for "the training ground roof is
   * finished". These are the general-purpose pools that catch that case.
   */
  readonly fallbackTriggers?: readonly string[];
  /** Extra facts a template may key on — tone, standing, answer taken. */
  readonly facts?: Readonly<Record<string, string | number | boolean>>;
  /** Author sentiment before the template's own is blended in. */
  readonly sentiment: number;
  readonly extraTags?: readonly string[];
  readonly quoted?: { readonly authorName: string; readonly text: string };
  /** Multiplier on reach, for a viral moment or a fatigued third post. */
  readonly reachMultiplier?: number;
  /** Set when the text is authored by the player's own choice of tone. */
  readonly weightBonus?: number;
}

/**
 * Render one post, or nothing.
 *
 * Returning null rather than a half-filled string is the important behaviour:
 * a template whose tokens we cannot fill, or whose line the feed used three
 * days ago, produces silence, and silence is always better than a post that
 * reads as generated.
 */
export function renderPost(
  ctx: PostRenderContext,
  rng: Rng,
  spec: PostSpec,
): SocialPost | null {
  const trigger = spec.trigger ?? spec.hook.trigger;
  const facts = {
    ...spec.hook.facts,
    ...ctx.standingFacts,
    ...(spec.facts ?? {}),
    authorKind: spec.author.kind,
  };

  const usable = (t: SocialTemplate): boolean =>
    matchesConditions(t.conditions, facts) && renderTemplate(t.text, spec.hook.tokens) !== null;
  const lookup = (key: string): readonly SocialTemplate[] | undefined => ctx.byKey.get(key);
  let pool = templatesForTrigger(lookup, trigger, `|${spec.author.kind}`).filter(usable);
  for (const alternative of spec.fallbackTriggers ?? []) {
    if (pool.length > 0) break;
    pool = templatesForTrigger(lookup, alternative, `|${spec.author.kind}`).filter(usable);
  }
  if (pool.length === 0) return null;

  let template = pickTemplate(rng, pool, ctx.recency);
  let text = template ? renderTemplate(template.text, spec.hook.tokens) : null;
  if (text && ctx.usedText.has(text)) {
    const retry = pickTemplate(rng, pool.filter((t) => t.id !== template?.id), ctx.recency);
    if (retry) {
      const retryText = renderTemplate(retry.text, spec.hook.tokens);
      if (retryText && !ctx.usedText.has(retryText)) { template = retry; text = retryText; }
    }
  }
  if (!template || !text || ctx.usedText.has(text)) return null;

  ctx.blocked.add(template.id);
  ctx.seen.add(template.id);
  ctx.usedText.add(text);

  const sentiment = clamp((spec.sentiment + template.sentiment) / 2, -1, 1);
  const reach = Math.max(
    1,
    Math.round(spec.author.reach * (spec.reachMultiplier ?? 1) * ctx.reachMultiplier),
  );
  const engagement = engagementFor(reach, spec.hook.importance, sentiment, rng);

  return {
    id: spec.id,
    kind: spec.author.kind,
    authorName: spec.author.name,
    authorHandle: spec.author.handle,
    avatarSeed: spec.author.avatarSeed,
    verified: spec.author.verified,
    text,
    cycle: ctx.cycle,
    likes: engagement.likes,
    reposts: engagement.reposts,
    replies: engagement.replies,
    sentiment,
    weight: clamp(
      weightFor(spec.author.kind, spec.hook.importance, engagement.likes) + (spec.weightBonus ?? 0),
      1, 100,
    ),
    relatedEventId: spec.hook.sourceEventId,
    entities: spec.hook.entities.map((e) => ({ kind: e.kind, id: e.id, name: e.name })),
    ...(spec.quoted ? { quoted: spec.quoted } : {}),
    tags: [
      ...spec.hook.tags,
      ...(template.tags ?? []),
      `tpl:${template.id}`,
      `trigger:${trigger}`,
      ...(spec.extraTags ?? []),
    ],
  };
}

/**
 * Render the first spec that produces something.
 *
 * Used where the world should say *one* thing about a beat and there are
 * several voices that could plausibly carry it.
 */
export function renderFirst(
  ctx: PostRenderContext,
  rng: Rng,
  specs: readonly PostSpec[],
): SocialPost | null {
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    if (!spec) continue;
    const post = renderPost(ctx, rng.forkSequential('spec', i), spec);
    if (post) return post;
  }
  return null;
}

/** Append posts to state, respecting the same retention window the tick uses. */
export const appendPosts = (state: GameState, posts: readonly SocialPost[]): GameState => {
  if (posts.length === 0) return state;
  const known = new Set(state.social.posts.map((p) => p.id));
  const fresh = posts.filter((p) => !known.has(p.id));
  if (fresh.length === 0) return state;
  return {
    ...state,
    social: {
      ...state.social,
      posts: [...state.social.posts, ...fresh].slice(-S.retention),
    },
  };
};
