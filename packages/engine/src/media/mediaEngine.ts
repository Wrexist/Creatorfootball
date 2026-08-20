import type { AnyDomainEvent, EventImportance } from '../core/events';
import type { GameState, NewsStory } from '../game/state';
import type { MediaTemplate } from '../content/schema';
import type { Rng } from '../core/rng';
import type { Manager } from '../creators/manager';
import { clamp } from '../core/math';
import type { CascadeResult } from '../simulation/cascade';
import { expandCascade } from '../simulation/cascade';
import type { ContentHook, ContentRegistryPort } from '../simulation/ports';
import {
  blendTemplates, matchesConditions, pickTemplate, renderTemplate, seedFrom, sentimentBand,
  templatesForTrigger, type TemplateRecency,
} from '../simulation/templating';
import { MEDIA_BALANCE as M, OUTLETS, outletByName, type Outlet } from './balance';
import { FALLBACK_MEDIA_TEMPLATES } from './fallbackTemplates';

/**
 * The media engine.
 *
 * Every story is a rendering of a *hook*, and every hook came from a domain
 * event — directly, through the cascade, or through emergent-pattern detection
 * over accumulated history. There is no path in this module that invents news.
 *
 * Importance is the load-bearing number: it decides what gets published at all,
 * how large the UI renders it, and how far it travels into the social feed. It
 * is derived from the stakes (margin, fee, derby heat, whether it is the
 * player's club), never from the template alone.
 */

export interface MediaOptions {
  /** Precomputed cascade; recomputed from `events` when absent. */
  readonly cascade?: CascadeResult;
  /** Extra hooks — emergent stories, world-tick summaries. */
  readonly extraHooks?: readonly ContentHook[];
  readonly maxStories?: number;
  readonly cycle?: number;
}

interface Candidate {
  readonly hook: ContentHook;
  readonly importance: EventImportance;
  readonly rank: number;
}

/** Stakes-aware importance. This is what stops a 1-0 reading like a 6-0. */
function stakeImportance(hook: ContentHook, _state: GameState): EventImportance {
  let importance: number = hook.importance;
  const margin = Number(hook.facts.margin ?? 0);
  if (margin >= M.routMargin) importance += M.routImportanceBonus;
  if (hook.facts.derby === true) importance += M.derbyImportanceBonus;
  // A knock-on reaction is never bigger news than the thing it reacted to.
  importance -= hook.depth;
  return clamp(Math.round(importance), 1, 5) as EventImportance;
}

function archetypeAmplifier(manager: Manager | null): { negative: number; positive: number } {
  if (!manager) return { negative: 1, positive: 1 };
  const id = manager.archetypeId.toLowerCase();
  for (const row of M.archetypeAmplify) {
    if (id.includes(row.match)) return { negative: row.negative, positive: row.positive };
  }
  return { negative: 1, positive: 1 };
}

/**
 * The manager's media handling and archetype shape coverage of their own club.
 * A great communicator does not stop bad results — they stop bad results from
 * becoming bad weeks.
 */
function applyManagerDamping(sentiment: number, hook: ContentHook, state: GameState): number {
  if (hook.clubId !== state.playerClubId) return sentiment;
  const manager = state.managers[state.playerManagerId] ?? null;
  if (!manager) return sentiment;
  const amp = archetypeAmplifier(manager);
  const styleNeg = M.styleNegative[manager.mediaStyle] ?? 1;
  const stylePos = M.stylePositive[manager.mediaStyle] ?? 1;
  if (sentiment < 0) {
    const damping = (manager.attributes.mediaHandling / 100) * M.mediaHandlingDamping;
    return sentiment * (1 - damping) * styleNeg * amp.negative;
  }
  const lift = 1 + (manager.attributes.brandBuilding / 100) * 0.2;
  return clamp(sentiment * stylePos * amp.positive * lift, -1, 1);
}

function chooseOutlet(template: MediaTemplate | null, hook: ContentHook, rng: Rng): Outlet {
  const named = (template?.outlets ?? []).map(outletByName).filter((o): o is Outlet => o !== null);
  const pool = named.length > 0 ? named : OUTLETS;
  // Hot, negative stories gravitate to outlets that run hot.
  return rng.weighted(pool, (o) => {
    const heatFit = hook.sentiment < -0.3 ? o.bias : 1 / o.bias;
    return Math.max(0.05, heatFit * (0.5 + o.reach / 3_000_000));
  });
}

/**
 * What the press has already printed.
 *
 * `blocked` is the hard window — a template inside it is not a candidate while
 * any alternative exists — and `seen` is everything in the retained archive,
 * which biases selection toward stories that have never run. A soft weight
 * penalty alone let the same headline carry a quarter of a season.
 */
function templateRecency(state: GameState, cycle: number): { recency: TemplateRecency; blocked: Set<string>; seen: Set<string> } {
  const blocked = new Set<string>();
  const seen = new Set<string>();
  for (const story of state.media.stories) {
    for (const tag of story.tags) {
      if (!tag.startsWith('tpl:')) continue;
      const id = tag.slice(4);
      seen.add(id);
      if (story.cycle >= cycle - M.hardRepeatCycles) blocked.add(id);
    }
  }
  return { recency: { blocked, seen }, blocked, seen };
}

function recentHeadlines(state: GameState, cycle: number): Set<string> {
  const out = new Set<string>();
  for (const story of state.media.stories) {
    if (story.cycle >= cycle - M.hardRepeatCycles) out.add(story.headline);
  }
  return out;
}

/**
 * Generate this cycle's stories.
 *
 * Deterministic: the same events, state and seed produce the same stories.
 */
export function generateStories(
  events: readonly AnyDomainEvent[],
  state: GameState,
  rng: Rng,
  registry: ContentRegistryPort | null,
  opts: MediaOptions = {},
): NewsStory[] {
  const cycle = opts.cycle ?? state.clock.cycle;
  const cascade = opts.cascade ?? expandCascade(events, state, { cycle });
  const hooks: ContentHook[] = [...cascade.mediaHooks, ...(opts.extraHooks ?? [])];
  if (hooks.length === 0) return [];

  const packTemplates = registry?.mediaTemplates() ?? [];
  const templates = blendTemplates(packTemplates, FALLBACK_MEDIA_TEMPLATES, M.builtInWeightWithPack);
  const byTrigger = new Map<string, MediaTemplate[]>();
  for (const t of templates) {
    const list = byTrigger.get(t.trigger);
    if (list) list.push(t); else byTrigger.set(t.trigger, [t]);
  }

  const manager = state.managers[state.playerManagerId] ?? null;
  const damping = manager ? (manager.attributes.mediaHandling / 100) * M.mediaHandlingDamping : 0;
  const spikeRng = rng.fork(`media:spike:${cycle}`);

  // 1. Rank candidates by stakes, and let a well-handled press office spike the
  //    small negative stories before they are ever written.
  const candidates: Candidate[] = [];
  const seenKeys = new Set<string>();
  for (const hook of hooks) {
    if (hook.cycle !== cycle) continue;
    const key = `${hook.sourceEventId}:${hook.trigger}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const importance = stakeImportance(hook, state);
    const ownClubNegative = hook.clubId === state.playerClubId && hook.sentiment < 0;
    if (ownClubNegative && importance <= 2 && spikeRng.chance(damping * M.minorStorySpikeChance)) continue;
    candidates.push({
      hook,
      importance,
      rank: importance * 10 + (hook.clubId === state.playerClubId ? M.playerClubRankBonus : 0) - hook.depth,
    });
  }
  candidates.sort((a, b) => b.rank - a.rank || (a.hook.sourceEventId < b.hook.sourceEventId ? -1 : 1));

  const limit = opts.maxStories ?? M.maxStoriesPerCycle;
  // Per-trigger cap. `alwaysPublishImportance` is an escape hatch for the story
  // that must not be trimmed, but with twelve clubs playing every week it let a
  // single trigger publish eleven near-identical stories a cycle and crowd out
  // every other kind the pack can write. One trigger, a couple of stories.
  const perTrigger = new Map<string, number>();
  const chosen: Candidate[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const used = perTrigger.get(candidate.hook.trigger) ?? 0;
    if (used >= M.maxStoriesPerTrigger) continue;
    if (chosen.length >= limit && candidate.importance < M.alwaysPublishImportance) continue;
    perTrigger.set(candidate.hook.trigger, used + 1);
    chosen.push(candidate);
  }

  // 2. Render. A template we cannot fill is skipped rather than published half-baked.
  const { recency, blocked: usedTemplates, seen: seenTemplates } = templateRecency(state, cycle);
  const usedHeadlines = recentHeadlines(state, cycle);
  const stories: NewsStory[] = [];

  for (const candidate of chosen) {
    const hook = candidate.hook;
    const local = rng.fork(`media:${hook.sourceEventId}:${hook.trigger}`);
    const pool = templatesForTrigger((key) => byTrigger.get(key), hook.trigger).filter(
      (t) => matchesConditions(t.conditions, hook.facts) && renderTemplate(t.headline, hook.tokens) !== null && renderTemplate(t.body, hook.tokens) !== null,
    );
    if (pool.length === 0) continue;

    let template: MediaTemplate | null = null;
    let headline: string | null = null;
    for (let attempt = 0; attempt < M.rerollAttempts; attempt++) {
      const pick = pickTemplate(local, pool, recency);
      if (!pick) break;
      const rendered = renderTemplate(pick.headline, hook.tokens);
      template = pick;
      headline = rendered;
      if (rendered && !usedHeadlines.has(rendered)) break;
    }
    if (!template || !headline) continue;
    const body = renderTemplate(template.body, hook.tokens);
    if (!body) continue;

    const outlet = chooseOutlet(template, hook, local);
    const rawSentiment = clamp((hook.sentiment + template.sentiment) / 2 * outlet.bias, -1, 1);
    const sentiment = clamp(applyManagerDamping(rawSentiment, hook, state), -1, 1);

    usedTemplates.add(template.id);
    seenTemplates.add(template.id);
    usedHeadlines.add(headline);

    stories.push({
      id: `st_${hook.sourceEventId}_${hook.trigger}`.toLowerCase(),
      headline,
      body,
      outlet: outlet.name,
      cycle,
      importance: candidate.importance,
      sentiment,
      entities: hook.entities.map((e) => ({ kind: e.kind, id: e.id, name: e.name })),
      tags: [...hook.tags, `tpl:${template.id}`, `trigger:${hook.trigger}`, `mood:${sentimentBand(sentiment)}`],
      imageSeed: seedFrom(hook.trigger, hook.sourceEventId, hook.clubId ?? 'world'),
      read: false,
    });
  }

  return stories.sort((a, b) => b.importance - a.importance || (a.id < b.id ? -1 : 1));
}

/** How far a published story travels. Used by the social engine and fan growth. */
export function storyReach(story: NewsStory): number {
  const outlet = outletByName(story.outlet);
  const base = outlet?.reach ?? 500_000;
  return Math.round(base * (0.35 + story.importance * 0.22));
}

/** Total media pressure on a club this cycle — feeds rivalry heat and fan mood. */
export function mediaVolumeFor(stories: readonly NewsStory[], clubId: string): number {
  let volume = 0;
  for (const s of stories) {
    if (s.entities.some((e) => e.kind === 'club' && e.id === clubId)) volume += s.importance;
  }
  return volume;
}
