import type { AnyDomainEvent } from '../core/events';
import type { GameState, SocialPost } from '../game/state';
import type { SocialTemplate } from '../content/schema';
import type { Rng } from '../core/rng';
import type { Creator } from '../creators/creator';
import { creatorReach } from '../creators/creator';
import { clamp } from '../core/math';
import type { CascadeResult } from '../simulation/cascade';
import { expandCascade } from '../simulation/cascade';
import type { ContentHook, ContentRegistryPort, SocialPostKind } from '../simulation/ports';
import {
  blendTemplates, diversifyByTrigger, matchesConditions, pickTemplate, renderTemplate, seedFrom,
  templatesForTrigger, type TemplateRecency,
} from '../simulation/templating';
import { rivalriesOf, rivalOpponent } from '../rivalries/rivalries';
import { OUTLETS } from '../media/balance';
import { FAN_PERSONAS, SOCIAL_BALANCE as S, SPONSOR_ACCOUNTS } from './balance';
import { FALLBACK_SOCIAL_TEMPLATES } from './fallbackTemplates';
import { engagementFor, weightFor } from './engagement';
import { socialStanding, standingFacts } from './standing';

/**
 * The social feed.
 *
 * The failure mode this module is built against is a feed of plausible-sounding
 * noise disconnected from the game. Three rules prevent it:
 *
 *  1. Every post is rendered from a hook, and every hook carries the id of the
 *     domain event it came from. `relatedEventId` is never synthesised.
 *  2. Voices are structurally different, not just differently worded. A fan's
 *     stance is partisan, a rival's is always hostile to the subject, a
 *     creator's is filtered through their tone and their opinion of your club.
 *  3. Engagement is derived from the author's real reach and the event's real
 *     stakes. The random component is a ±10% band, never the signal.
 */

export interface SocialOptions {
  readonly cascade?: CascadeResult;
  readonly extraHooks?: readonly ContentHook[];
  readonly maxPosts?: number;
  readonly cycle?: number;
}

type Tone = Creator['style']['tone'];

interface Author {
  readonly kind: SocialPostKind;
  readonly name: string;
  readonly handle: string;
  readonly avatarSeed: string;
  readonly verified: boolean;
  readonly reach: number;
  readonly tone?: Tone;
  readonly tier?: string;
  readonly creator?: Creator;
  /** 0-1, set on leak accounts only. */
  readonly credibility?: number;
}

const handleFrom = (name: string, salt: string): string =>
  `@${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${salt.replace(/[^a-z0-9]/gi, '').slice(-3).toLowerCase()}`;

/** Creator stance: the same event reads differently through each tone. */
function toneStance(sentiment: number, tone: Tone): number {
  switch (tone) {
    case 'HYPE': return sentiment > 0 ? Math.min(1, sentiment * 1.3 + 0.1) : sentiment * 0.6;
    case 'ANALYTICAL': return sentiment * 0.55;
    case 'COMEDIC': return sentiment * 0.7 - 0.1;
    case 'PROVOCATIVE': return sentiment < 0 ? Math.max(-1, sentiment * 1.25) : sentiment * 0.4 - 0.25;
    case 'WHOLESOME': return sentiment * 0.6 + 0.15;
    case 'DRAMATIC': return Math.sign(sentiment) * Math.min(1, Math.abs(sentiment) * 1.35);
    default: return sentiment;
  }
}

/**
 * The business sector of the club's live deal, published as a fact so
 * sponsor-authored copy can speak in its own industry's voice. A bank and an
 * energy drink do not post alike, and a sector-gated line that cannot resolve
 * simply never runs — never misattributed.
 */
function activeSponsorSector(state: GameState): string | undefined {
  const deal = state.sponsors.active[0];
  return deal?.sector;
}

function stanceFor(author: Author, hook: ContentHook, state: GameState): number {  switch (author.kind) {
    case 'FAN': return clamp(hook.sentiment * 1.1, -1, 1);
    // Rivals are hostile whatever happened: gloating at your misery, bitter at
    // your success. Their sentiment is always negative toward the subject club.
    case 'RIVAL': return clamp(-Math.abs(hook.sentiment) * 0.85 - 0.05, -1, 1);
    case 'CREATOR': {
      const base = toneStance(hook.sentiment, author.tone ?? 'ANALYTICAL');
      const affinity = author.creator && hook.clubId === state.playerClubId
        ? (author.creator.clubSentiment / 100) * 0.25
        : 0;
      return clamp(base + affinity, -1, 1);
    }
    case 'CLUB': return clamp(hook.sentiment * 0.5 + 0.15, -1, 1);
    case 'PLAYER': return clamp(hook.sentiment * 0.7, -1, 1);
    case 'MEDIA': return clamp(hook.sentiment * 0.8, -1, 1);
    case 'SPONSOR': return clamp(Math.max(0.3, hook.sentiment), -1, 1);
    case 'LEAK': return clamp(hook.sentiment * 0.3, -1, 1);
    default: return hook.sentiment;
  }
}

function fanAuthors(
  state: GameState,
  clubId: string | undefined,
  kind: 'FAN' | 'RIVAL',
  count: number,
  rng: Rng,
): Author[] {
  const club = clubId ? state.clubs[clubId] : null;
  if (!club || count <= 0) return [];
  const personas = rng.sample(FAN_PERSONAS, count);
  return personas.map((persona, i) => ({
    kind,
    name: persona,
    handle: handleFrom(persona, `${club.abbreviation}${i}`),
    avatarSeed: seedFrom('fan', persona, club.abbreviation),
    verified: false,
    reach: Math.round(
      clamp(club.fans.onlineFollowers * S.fanReachFromFollowers, S.fanReachFloor, S.fanReachCeiling)
      * rng.float(0.5, 1.8),
    ),
  }));
}

function creatorAuthors(
  state: GameState,
  hook: ContentHook,
  count: number,
  rng: Rng,
): Author[] {
  if (count <= 0) return [];
  const pool = Object.values(state.creators).filter((c) => c.style.postingFrequency > 0);
  if (pool.length === 0) return [];
  const tierScore: Record<string, number> = { LOCAL: 1, RISING: 1.6, ESTABLISHED: 2.2, MAJOR: 3, GLOBAL: 3.6 };
  const remaining = pool.slice();
  const out: Author[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const chosen = rng.weighted(remaining, (c) => {
      const affinity = c.clubId && c.clubId === hook.clubId ? 3.5
        : c.clubId && c.clubId === hook.opponentClubId ? 2.5
          : c.clubId ? 0.6 : 1.4;
      return affinity * (tierScore[c.tier] ?? 1) * (0.5 + c.style.postingFrequency);
    });
    remaining.splice(remaining.indexOf(chosen), 1);
    // A creator attached to the other club in this story is a rival voice.
    const kind: SocialPostKind = chosen.clubId && chosen.clubId === hook.opponentClubId ? 'RIVAL' : 'CREATOR';
    out.push({
      kind,
      name: chosen.displayName,
      handle: chosen.handle.startsWith('@') ? chosen.handle : `@${chosen.handle}`,
      avatarSeed: chosen.avatarSeed,
      verified: chosen.tier === 'MAJOR' || chosen.tier === 'GLOBAL',
      reach: creatorReach(chosen),
      tone: chosen.style.tone,
      tier: chosen.tier,
      creator: chosen,
    });
  }
  return out;
}

function authorsFor(hook: ContentHook, state: GameState, rng: Rng): Author[] {
  const importance = clamp(hook.importance, 1, 5);
  const wanted = new Set<SocialPostKind>(hook.audiences);
  const authors: Author[] = [];
  const club = hook.clubId ? state.clubs[hook.clubId] : null;

  if (wanted.has('FAN')) {
    authors.push(...fanAuthors(state, hook.clubId, 'FAN', S.fanCountByImportance[importance] ?? 1, rng.fork('fans')));
  }
  if (wanted.has('RIVAL')) {
    const rivalCount = S.rivalCountByImportance[importance] ?? 0;
    const explicit = hook.opponentClubId;
    const topRivalry = hook.clubId ? rivalriesOf(state, hook.clubId)[0] : undefined;
    const rivalClub = explicit ?? (topRivalry && hook.clubId ? rivalOpponent(topRivalry, hook.clubId) : undefined);
    authors.push(...fanAuthors(state, rivalClub, 'RIVAL', rivalCount, rng.fork('rivals')));
  }
  if (wanted.has('CREATOR')) {
    authors.push(...creatorAuthors(state, hook, S.creatorCountByImportance[importance] ?? 0, rng.fork('creators')));
  }
  if (wanted.has('CLUB') && club && importance >= S.clubImportance) {
    authors.push({
      kind: 'CLUB',
      name: club.name,
      handle: handleFrom(club.shortName, 'fc'),
      avatarSeed: seedFrom('club', club.abbreviation),
      verified: true,
      reach: Math.max(5_000, club.fans.onlineFollowers),
    });
  }
  if (wanted.has('PLAYER') && hook.playerId && importance >= S.playerImportance) {
    const player = state.players[hook.playerId];
    if (player) {
      const linked = player.creatorId ? state.creators[player.creatorId] : undefined;
      authors.push({
        kind: 'PLAYER',
        name: player.displayName,
        handle: linked ? (linked.handle.startsWith('@') ? linked.handle : `@${linked.handle}`) : handleFrom(player.displayName, player.id),
        avatarSeed: player.portraitSeed,
        verified: player.reputation >= 55,
        reach: linked ? creatorReach(linked) : Math.round(player.reputation * S.playerReachPerReputation),
      });
    }
  }
  if (wanted.has('MEDIA') && importance >= S.mediaImportance) {
    const outlet = rng.fork('outlet').weighted(OUTLETS, (o) => o.reach / 1_000_000);
    authors.push({
      kind: 'MEDIA', name: outlet.name, handle: outlet.handle,
      avatarSeed: seedFrom('outlet', outlet.name), verified: true, reach: outlet.reach,
    });
  }
  if (wanted.has('SPONSOR') && importance >= S.sponsorImportance) {
    const sponsor = rng.fork('sponsor').pick(SPONSOR_ACCOUNTS);
    authors.push({
      kind: 'SPONSOR', name: sponsor.name, handle: sponsor.handle,
      avatarSeed: seedFrom('sponsor', sponsor.name), verified: true, reach: S.sponsorReach,
    });
  }
  if (wanted.has('LEAK')) {
    // Leaks are semi-reliable by design. Credibility rides on the post as a tag
    // so the UI can show the hedge rather than presenting a rumour as fact.
    const leakRng = rng.fork('leak');
    const credibility = leakRng.float(S.leakCredibility[0], S.leakCredibility[1]);
    authors.push({
      kind: 'LEAK',
      name: 'Transfer Room',
      handle: '@transferroom',
      avatarSeed: seedFrom('leak', hook.sourceEventId),
      verified: false,
      reach: Math.round(180_000 * credibility),
      credibility: Math.round(credibility * 100) / 100,
    });
  }
  return authors;
}

/**
 * Generate this cycle's posts. Deterministic for a given seed, state and event
 * batch.
 */
export function generatePosts(
  events: readonly AnyDomainEvent[],
  state: GameState,
  rng: Rng,
  registry: ContentRegistryPort | null,
  opts: SocialOptions = {},
): SocialPost[] {
  const cycle = opts.cycle ?? state.clock.cycle;
  const cascade = opts.cascade ?? expandCascade(events, state, { cycle });
  const allHooks = [...cascade.socialHooks, ...(opts.extraHooks ?? [])].filter((h) => h.cycle === cycle);
  if (allHooks.length === 0) return [];

  // How the club is currently perceived is published to every template as a
  // fact, and it also scales how hard hostile voices swing. A club everybody
  // finds funny is written about differently from one everybody fears — that
  // difference is the point of building a standing at all.
  const standing = socialStanding(state);
  const standingVocabulary = standingFacts(standing);

  const packTemplates = registry?.socialTemplates() ?? [];
  const templates = blendTemplates(packTemplates, FALLBACK_SOCIAL_TEMPLATES, S.builtInWeightWithPack);
  const byKey = new Map<string, SocialTemplate[]>();
  for (const template of templates) {
    const key = `${template.trigger}|${template.authorKind}`;
    const list = byKey.get(key);
    if (list) list.push(template); else byKey.set(key, [template]);
  }

  // Anti-repetition ledger, read straight off the retained feed so it survives
  // a save/load round trip and stays deterministic. `blocked` is the hard
  // window; `seen` biases selection toward lines nobody has read yet.
  const blocked = new Set<string>();
  const seenTemplates = new Set<string>();
  const blockedText = new Set<string>();
  for (const post of state.social.posts) {
    for (const tag of post.tags) {
      if (!tag.startsWith('tpl:')) continue;
      const id = tag.slice(4);
      seenTemplates.add(id);
      if (post.cycle >= cycle - S.hardRepeatCycles) blocked.add(id);
    }
    if (post.cycle >= cycle - S.hardRepeatCycles) blockedText.add(post.text);
  }
  const recent: TemplateRecency = { blocked, seen: seenTemplates };

  // Deduplicate hooks and take the highest-stakes ones; a busy matchday should
  // not bury the one thing that mattered. The per-trigger cap is what stops a
  // week of heavy defeats spending the entire budget on one trigger and hiding
  // every other kind of story the pack can tell.
  const seen = new Set<string>();
  const hooks = diversifyByTrigger(
    allHooks
      .filter((h) => {
        const key = `${h.sourceEventId}:${h.trigger}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.importance - a.importance || (a.sourceEventId < b.sourceEventId ? -1 : 1)),
    { limit: S.maxHooksPerCycle, perTrigger: S.maxHooksPerTrigger },
  );

  const posts: SocialPost[] = [];
  // A feed that repeats itself reads as generated. One line, once per cycle —
  // and not again for `hardRepeatCycles` cycles either.
  const usedText = new Set<string>(blockedText);
  for (const hook of hooks) {
    const hookRng = rng.fork(`social:${hook.sourceEventId}:${hook.trigger}`);
    const authors = authorsFor(hook, state, hookRng);
    let index = 0;
    for (const author of authors) {
      const authorRng = hookRng.fork(`a:${author.kind}:${index}`);
      const facts = {
        ...hook.facts,
        ...standingVocabulary,
        authorKind: author.kind,
        ...(author.tone ? { tone: author.tone } : {}),
        ...(author.tier ? { tier: author.tier } : {}),
        ...(author.kind === 'SPONSOR' ? { sector: activeSponsorSector(state) } : {}),
      };
      const pool = templatesForTrigger((key) => byKey.get(key), hook.trigger, `|${author.kind}`).filter(
        (template) => matchesConditions(template.conditions, facts) && renderTemplate(template.text, hook.tokens) !== null,
      );
      let template = pickTemplate(authorRng, pool, recent);
      let text = template ? renderTemplate(template.text, hook.tokens) : null;
      if (text && usedText.has(text)) {
        template = pickTemplate(authorRng, pool.filter((t) => t.id !== template?.id), recent);
        text = template ? renderTemplate(template.text, hook.tokens) : null;
      }
      if (!template || !text || usedText.has(text)) { index++; continue; }
      blocked.add(template.id);
      seenTemplates.add(template.id);
      usedText.add(text);

      const rawSentiment = clamp((stanceFor(author, hook, state) + template.sentiment) / 2, -1, 1);
      // Hostility is amplified against a club that has made itself a target and
      // damped against one the sport has decided it likes.
      const sentiment = rawSentiment < 0
        ? clamp(rawSentiment * standing.hostilityMultiplier, -1, 1)
        : rawSentiment;
      const engagement = engagementFor(
        Math.round(author.reach * (hook.clubId === state.playerClubId ? standing.reachMultiplier : 1)),
        hook.importance, sentiment, authorRng,
      );
      posts.push({
        id: `sp_${hook.sourceEventId}_${hook.trigger}_${author.kind}_${index}`.toLowerCase(),
        kind: author.kind,
        authorName: author.name,
        authorHandle: author.handle,
        avatarSeed: author.avatarSeed,
        verified: author.verified,
        text,
        cycle,
        likes: engagement.likes,
        reposts: engagement.reposts,
        replies: engagement.replies,
        sentiment,
        weight: weightFor(author.kind, hook.importance, engagement.likes),
        relatedEventId: hook.sourceEventId,
        entities: hook.entities.map((e) => ({ kind: e.kind, id: e.id, name: e.name })),
        tags: [
          ...hook.tags, ...(template.tags ?? []), `tpl:${template.id}`, `trigger:${hook.trigger}`,
          // Marks a post written by an actual creator entity, so the debate pass
          // can tell a pundit apart from a supporter with a strong opinion.
          ...(author.creator ? ['creator-voice'] : []),
          ...(author.credibility !== undefined ? [`credibility:${author.credibility}`] : []),
        ],
      });
      index++;
    }
  }

  const withDebates = [
    ...posts,
    ...generateDebates(posts, hooks, byKey, recent, blocked, state, rng, cycle),
  ];
  // Trim by weight, but not so hard that the diversity won upstream is thrown
  // away here: a single trigger may not take more than its share of the feed.
  const limit = opts.maxPosts ?? S.maxPostsPerCycle;
  const takenPerTrigger = new Map<string, number>();
  const kept: SocialPost[] = [];
  const overflow: SocialPost[] = [];
  for (const post of withDebates.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1))) {
    const trigger = post.tags.find((t) => t.startsWith('trigger:')) ?? 'trigger:debate';
    const used = takenPerTrigger.get(trigger) ?? 0;
    if (used >= S.maxPostsPerTrigger) { overflow.push(post); continue; }
    takenPerTrigger.set(trigger, used + 1);
    kept.push(post);
    if (kept.length >= limit) break;
  }
  // Only if diversity could not fill the feed do the crowded-out posts return.
  for (const post of overflow) {
    if (kept.length >= limit) break;
    kept.push(post);
  }
  return kept.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1));
}

/**
 * Arguments emerge rather than being scripted: when two creators land on
 * opposite sides of the same event, the more provocative one quote-posts the
 * other. The reply is anchored to the same source event, so it stays traceable.
 */
function generateDebates(
  posts: readonly SocialPost[],
  hooks: readonly ContentHook[],
  byKey: ReadonlyMap<string, SocialTemplate[]>,
  recent: TemplateRecency,
  blocked: Set<string>,
  state: GameState,
  rng: Rng,
  cycle: number,
): SocialPost[] {
  const byEvent = new Map<string, SocialPost[]>();
  for (const post of posts) {
    if (!post.tags.includes('creator-voice')) continue;
    const key = post.relatedEventId ?? '';
    const list = byEvent.get(key);
    if (list) list.push(post); else byEvent.set(key, [post]);
  }

  const out: SocialPost[] = [];
  for (const [eventId, group] of [...byEvent.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (out.length >= S.maxDebatesPerCycle) break;
    if (group.length < 2) continue;
    const sorted = group.slice().sort((a, b) => b.sentiment - a.sentiment);
    const positive = sorted[0];
    const negative = sorted[sorted.length - 1];
    if (!positive || !negative || positive.sentiment - negative.sentiment < S.debateSentimentGap) continue;

    const hook = hooks.find((h) => h.sourceEventId === eventId);
    if (!hook) continue;
    const debateRng = rng.fork(`debate:${eventId}`);
    // The unhappier voice is the one that starts the argument.
    const challenger = negative;
    const target = positive;
    const pool = (byKey.get('DEBATE|CREATOR') ?? []).filter(
      (template) => renderTemplate(template.text, hook.tokens) !== null,
    );
    const template = pickTemplate(debateRng, pool, recent);
    if (!template) continue;
    const text = renderTemplate(template.text, hook.tokens);
    if (!text) continue;
    blocked.add(template.id);

    const sentiment = clamp((challenger.sentiment + template.sentiment) / 2, -1, 1);
    const reach = Math.round((challenger.likes + target.likes) * S.quoteReachShare * 6);
    const engagement = engagementFor(reach, hook.importance, sentiment, debateRng);
    out.push({
      id: `sp_${eventId}_debate_${out.length}`.toLowerCase(),
      kind: challenger.kind,
      authorName: challenger.authorName,
      authorHandle: challenger.authorHandle,
      avatarSeed: challenger.avatarSeed,
      verified: challenger.verified,
      text,
      cycle,
      likes: engagement.likes,
      reposts: engagement.reposts,
      replies: Math.round(engagement.replies * 1.6),
      sentiment,
      weight: weightFor(challenger.kind, hook.importance, engagement.likes) + 4,
      relatedEventId: eventId,
      entities: target.entities,
      quoted: { authorName: target.authorName, text: target.text },
      tags: [...hook.tags, `tpl:${template.id}`, 'debate'],
    });
  }
  void state;
  return out;
}

/**
 * Reach and follower movement implied by the feed's most recent cycle.
 * Positive coverage converts; hostile coverage costs, but less than it gains —
 * outrage still travels.
 */
export function socialReach(state: GameState): { impressions: number; followerDelta: number } {
  const posts = state.social.posts;
  if (posts.length === 0) return { impressions: 0, followerDelta: 0 };
  let latest = 0;
  for (const post of posts) if (post.cycle > latest) latest = post.cycle;

  let impressions = 0;
  let positive = 0;
  let negative = 0;
  for (const post of posts) {
    if (post.cycle !== latest) continue;
    const postImpressions = post.likes * S.impressionsPerLike + post.reposts * S.impressionsPerRepost;
    impressions += postImpressions;
    if (post.sentiment >= 0) positive += postImpressions * post.sentiment;
    else negative += postImpressions * -post.sentiment;
  }
  const followerDelta = Math.round(
    positive * S.followerGainPerImpression - negative * S.followerLossPerImpression,
  );
  return { impressions: Math.round(impressions), followerDelta };
}


/* --- the interactive layer ----------------------------------------------- */

/**
 * The social layer's public surface.
 *
 * Re-exported from here rather than added to the engine's root barrel so the
 * whole feature area is reachable through the module that already owns the
 * feed. Everything below turns the feed from a thing the player reads into a
 * thing the player plays.
 */
export * from './worldState';
export * from './engagement';
export * from './standing';
export * from './moments';
export * from './effects';
export * from './postFactory';
export * from './compose';
export * from './reactions';
export * from './pressConference';
export * from './community';
export * from './trending';
export * from './milestones';
export * from './socialTick';
