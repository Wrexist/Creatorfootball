import { isFiniteNumber } from '../core/math';
import { IDENTITY_KINDS, isLicensed } from '../licensing/identity';
import { ATTRIBUTE_KEYS, overallFor, type Attributes } from '../players/attributes';
import { MENTAL_KEYS } from '../players/mental';
import { POSITIONS, type Position } from '../players/positions';
import { MATCH_EVENT_TYPES } from '../matches/events';
import { CREATOR_ATTRIBUTE_KEYS, CREATOR_ROLES, CREATOR_TIERS, TIER_REACH } from '../creators/creator';
import { CONTENT_PACK_VERSION, type ContentPack, type ValidationIssue } from './schema';

/**
 * Pack validation.
 *
 * This is the gate that stands between a malformed community pack and a
 * corrupted save. It is deliberately noisy: everything it can prove is wrong is
 * an error, everything it can only suspect is a warning, and the registry
 * refuses to load anything carrying an error.
 *
 * The classes of failure it must catch, in the order they hurt:
 *   1. licensed content with no rights metadata (a legal problem, not a bug)
 *   2. duplicate ids (silently shadows content)
 *   3. dangling references (crashes at generation time, far from the cause)
 *   4. out-of-range or non-finite numbers (poisons the simulation)
 *   5. missing required fields and schema-shape violations
 */

const ERROR = 'error' as const;
const WARNING = 'warning' as const;

const VALID_TONES = new Set(['NEUTRAL', 'HYPE', 'CRITICAL', 'DRAMATIC', 'WRY']);
const VALID_CREATOR_TONES = new Set(['HYPE', 'ANALYTICAL', 'COMEDIC', 'PROVOCATIVE', 'WHOLESOME', 'DRAMATIC']);
const VALID_PLATFORMS = new Set(['SHORTFORM', 'LONGFORM', 'STREAM', 'PODCAST', 'TEXT']);
const VALID_BADGE_SHAPES = new Set(['SHIELD', 'CIRCLE', 'CREST', 'HEX', 'DIAMOND']);
const VALID_BADGE_MOTIFS = new Set(['PHOENIX', 'WOLF', 'ANCHOR', 'CROWN', 'BOLT', 'STAR', 'LION', 'TOWER', 'SERPENT', 'FLAME', 'COMPASS', 'HAMMER']);
const VALID_STYLES = new Set(['CLASSIC', 'MODERN', 'STREET', 'RETRO', 'MINIMAL', 'BOLD']);
const VALID_KIT_PATTERNS = new Set(['SOLID', 'STRIPES', 'HOOPS', 'SASH', 'HALVES', 'GRADIENT']);
const VALID_PHILOSOPHIES = new Set(['YOUTH_ACADEMY', 'BIG_SPENDERS', 'DATA_DRIVEN', 'CREATOR_FIRST', 'DEFENSIVE_ROCK', 'LOCAL_ROOTS', 'ENTERTAINERS', 'VETERAN_CORE']);
const VALID_FAN_CULTURES = new Set(['ULTRAS', 'FAMILY', 'ONLINE_NATIVE', 'TRADITIONAL', 'BANDWAGON', 'DIEHARD']);
const VALID_OBJECTIVE_SOURCES = new Set(['SEASON', 'DYNAMIC', 'SPONSOR', 'BOARD', 'FANS']);
const VALID_REWARD_KINDS = new Set(['CASH', 'PREMIUM', 'RULE_CARD', 'SCOUT_CREDIT', 'COSMETIC', 'FACILITY_CREDIT', 'REPUTATION']);
const VALID_SPONSOR_SLOTS = new Set(['SHIRT', 'SLEEVE', 'STADIUM', 'TRAINING', 'CREATOR']);
const VALID_TREATMENTS = new Set(['STANDARD', 'FEATURED', 'LIMITED']);
const VALID_FACILITY_CATEGORIES = new Set(['PERFORMANCE', 'DEVELOPMENT', 'COMMERCIAL', 'FAN']);
const VALID_SOCIAL_AUTHORS = new Set(['FAN', 'CREATOR', 'MEDIA', 'CLUB', 'PLAYER', 'RIVAL', 'SPONSOR', 'LEAK']);
const VALID_PACK_KINDS = new Set(['BASE', 'COMMUNITY', 'LICENSED', 'SEASONAL']);
const VALID_EVENT_TYPES = new Set<string>(MATCH_EVENT_TYPES);
const VALID_POSITIONS = new Set<string>(POSITIONS);
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Recommended minimums for a pack that intends to stand alone. */
export const NAME_BANK_MINIMUMS = {
  firstNames: 220, lastNames: 220, cities: 60, handles: 80,
  clubAffixes: 40, nationalities: 25,
} as const;

export function validatePack(pack: ContentPack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string, severity: 'error' | 'warning' = ERROR): void => {
    issues.push({ path, message, severity });
  };

  if (!pack || typeof pack !== 'object') {
    return [{ path: '', message: 'pack is not an object', severity: ERROR }];
  }
  const { manifest, data } = pack;
  if (!manifest) return [{ path: 'manifest', message: 'manifest is missing', severity: ERROR }];
  if (!data) return [{ path: 'data', message: 'data is missing', severity: ERROR }];

  // A pack that declares dependencies may legitimately point at ids defined in
  // one of them, and validatePack cannot see those. Such references drop to a
  // warning here and are re-checked for real by ContentRegistry.load, which
  // does know what else is loaded. A pack with no dependencies has no excuse.
  const refSeverity = (manifest.requires?.length ?? 0) > 0 ? WARNING : ERROR;
  const refNote = refSeverity === WARNING ? ' (may resolve in a required pack)' : '';

  /* ------------------------------------------------------------ manifest */
  const requiredManifestFields: readonly (keyof typeof manifest)[] = [
    'id', 'version', 'kind', 'name', 'description', 'provider', 'identityKind',
  ];
  for (const field of requiredManifestFields) {
    if (!manifest[field]) add(`manifest.${String(field)}`, `required field "${String(field)}" is missing`);
  }
  if (!Array.isArray(manifest.requires)) add('manifest.requires', 'requires must be an array');
  if (!Array.isArray(manifest.overrides)) add('manifest.overrides', 'overrides must be an array');
  if (!Array.isArray(manifest.regions)) add('manifest.regions', 'regions must be an array');
  if (!VALID_PACK_KINDS.has(manifest.kind)) add('manifest.kind', `unknown pack kind "${manifest.kind}"`);
  if (!IDENTITY_KINDS.includes(manifest.identityKind)) {
    add('manifest.identityKind', `unknown identity kind "${manifest.identityKind}"`);
  }
  if (manifest.schemaVersion > CONTENT_PACK_VERSION) {
    add('manifest.schemaVersion', `pack targets schema ${manifest.schemaVersion}, engine supports ${CONTENT_PACK_VERSION}`);
  } else if (manifest.schemaVersion < CONTENT_PACK_VERSION) {
    add('manifest.schemaVersion', `pack targets an older schema (${manifest.schemaVersion}); fields may be missing`, WARNING);
  }
  if (!isFiniteNumber(manifest.createdAt)) add('manifest.createdAt', 'createdAt must be a finite number');

  // The legal gate. A licensed pack without complete rights metadata never loads.
  if (isLicensed(manifest.identityKind) || manifest.kind === 'LICENSED') {
    const rights = manifest.rights;
    if (!rights) {
      add('manifest.rights', 'licensed content must carry rights metadata');
    } else {
      if (!rights.licenseId) add('manifest.rights.licenseId', 'licenseId is required');
      if (!rights.provider) add('manifest.rights.provider', 'provider is required for takedown and attribution');
      if (!rights.status) add('manifest.rights.status', 'status is required');
      if (!Array.isArray(rights.regions)) add('manifest.rights.regions', 'regions must be an array (empty = worldwide)');
      if (!rights.grants) {
        add('manifest.rights.grants', 'grants are required: name, likeness, voice, logo, merchandising');
      } else {
        for (const grant of ['name', 'likeness', 'voice', 'logo', 'merchandising'] as const) {
          if (typeof rights.grants[grant] !== 'boolean') {
            add(`manifest.rights.grants.${grant}`, `grant "${grant}" must be an explicit boolean`);
          }
        }
      }
      if (rights.expiresAt !== undefined && !isFiniteNumber(rights.expiresAt)) {
        add('manifest.rights.expiresAt', 'expiresAt must be a finite epoch-ms number when present');
      }
    }
  } else if (manifest.rights) {
    add('manifest.rights', 'fictional content should not declare rights metadata', WARNING);
  }

  /* -------------------------------------------------------- duplicate ids */
  const seen = new Map<string, Set<string>>();
  const checkId = (kind: string, path: string, id: unknown): void => {
    if (typeof id !== 'string' || id.length === 0) {
      add(path, 'id is missing or not a string');
      return;
    }
    let set = seen.get(kind);
    if (!set) { set = new Set(); seen.set(kind, set); }
    if (set.has(id)) add(path, `duplicate ${kind} id "${id}"`);
    set.add(id);
  };

  /* ---------------------------------------------------------------- clubs */
  const clubIds = new Set<string>();
  for (const [i, club] of (data.clubs ?? []).entries()) {
    const p = `clubs[${i}]`;
    checkId('club', `${p}.id`, club.id);
    clubIds.add(club.id);
    for (const field of ['name', 'shortName', 'abbreviation', 'city', 'stadiumName', 'motto'] as const) {
      if (!club[field]) add(`${p}.${field}`, `required field "${field}" is missing`);
    }
    if (!VALID_PHILOSOPHIES.has(club.philosophy)) add(`${p}.philosophy`, `unknown philosophy "${club.philosophy}"`);
    if (!VALID_FAN_CULTURES.has(club.fanCulture)) add(`${p}.fanCulture`, `unknown fan culture "${club.fanCulture}"`);
    for (const [field, value] of [['reputation', club.reputation], ['strength', club.strength]] as const) {
      if (!isFiniteNumber(value) || value < 1 || value > 100) {
        add(`${p}.${field}`, `${field} must be between 1 and 100, got ${String(value)}`);
      }
    }
    if (!isFiniteNumber(club.budget) || club.budget < 0) add(`${p}.budget`, 'budget must be a non-negative number');
    if (!isFiniteNumber(club.stadiumCapacity) || club.stadiumCapacity < 100) {
      add(`${p}.stadiumCapacity`, 'stadiumCapacity must be at least 100');
    }
    if (!isFiniteNumber(club.founded) || club.founded < 1700 || club.founded > 2200) {
      add(`${p}.founded`, 'founded must be a plausible year');
    }
    const v = club.visual;
    if (!v) {
      add(`${p}.visual`, 'visual identity is missing');
    } else {
      for (const key of ['primary', 'secondary', 'accent'] as const) {
        if (!HEX.test(v[key] ?? '')) add(`${p}.visual.${key}`, `${key} must be a #rrggbb hex colour`);
      }
      if (!VALID_BADGE_SHAPES.has(v.badgeShape)) add(`${p}.visual.badgeShape`, `unknown badge shape "${v.badgeShape}"`);
      if (!VALID_BADGE_MOTIFS.has(v.badgeMotif)) add(`${p}.visual.badgeMotif`, `unknown badge motif "${v.badgeMotif}"`);
      if (!VALID_STYLES.has(v.style)) add(`${p}.visual.style`, `unknown style "${v.style}"`);
      if (!VALID_KIT_PATTERNS.has(v.kitPattern)) add(`${p}.visual.kitPattern`, `unknown kit pattern "${v.kitPattern}"`);
    }
    if (!club.aiProfileId) add(`${p}.aiProfileId`, 'aiProfileId is required so the AI knows how to play this club');
  }
  // Rival references are resolved after the full club set is known.
  for (const [i, club] of (data.clubs ?? []).entries()) {
    for (const rivalId of club.rivalOf ?? []) {
      if (!clubIds.has(rivalId)) {
        add(`clubs[${i}].rivalOf`, `dangling reference: rival club "${rivalId}" does not exist in this pack${refNote}`, refSeverity);
      }
      if (rivalId === club.id) add(`clubs[${i}].rivalOf`, 'a club cannot be its own rival');
    }
  }

  /* -------------------------------------------------------------- players */
  const creatorIds = new Set((data.creators ?? []).map((c) => c.id));
  for (const [i, player] of (data.players ?? []).entries()) {
    const p = `players[${i}]`;
    checkId('player', `${p}.id`, player.id);
    if (!player.firstName) add(`${p}.firstName`, 'firstName is required');
    if (!player.lastName) add(`${p}.lastName`, 'lastName is required');
    if (!player.nationality) add(`${p}.nationality`, 'nationality is required');
    if (!isFiniteNumber(player.age) || player.age < 15 || player.age > 45) {
      add(`${p}.age`, `age must be between 15 and 45, got ${String(player.age)}`);
    }
    if (!VALID_POSITIONS.has(player.position)) add(`${p}.position`, `unknown position "${player.position}"`);
    for (const secondary of player.secondaryPositions ?? []) {
      if (!VALID_POSITIONS.has(secondary)) add(`${p}.secondaryPositions`, `unknown position "${secondary}"`);
      if (secondary === player.position) add(`${p}.secondaryPositions`, 'secondary position duplicates the natural position', WARNING);
    }
    if (player.footedness && !['left', 'right', 'both'].includes(player.footedness)) {
      add(`${p}.footedness`, `unknown footedness "${player.footedness}"`);
    }
    if (player.height !== undefined && (!isFiniteNumber(player.height) || player.height < 150 || player.height > 215)) {
      add(`${p}.height`, 'height must be between 150 and 215 cm');
    }

    let attributesComplete = true;
    if (!player.attributes) {
      add(`${p}.attributes`, 'attributes are required');
      attributesComplete = false;
    } else {
      for (const key of ATTRIBUTE_KEYS) {
        const value = player.attributes[key];
        if (value === undefined) {
          add(`${p}.attributes.${key}`, `attribute "${key}" is missing`);
          attributesComplete = false;
        } else if (!isFiniteNumber(value) || value < 1 || value > 99) {
          add(`${p}.attributes.${key}`, `attribute "${key}" must be between 1 and 99, got ${String(value)}`);
          attributesComplete = false;
        }
      }
      for (const key of Object.keys(player.attributes)) {
        if (!(ATTRIBUTE_KEYS as readonly string[]).includes(key)) {
          add(`${p}.attributes.${key}`, `unknown attribute "${key}"`, WARNING);
        }
      }
    }
    if (player.mental) {
      for (const key of MENTAL_KEYS) {
        const value = player.mental[key];
        if (value === undefined) {
          add(`${p}.mental.${key}`, `mental attribute "${key}" is missing`, WARNING);
        } else if (!isFiniteNumber(value) || value < 1 || value > 99) {
          add(`${p}.mental.${key}`, `mental attribute "${key}" must be between 1 and 99, got ${String(value)}`);
        }
      }
    }
    if (!isFiniteNumber(player.potential) || player.potential < 1 || player.potential > 99) {
      add(`${p}.potential`, 'potential must be between 1 and 99');
    } else if (attributesComplete && VALID_POSITIONS.has(player.position)) {
      const overall = overallFor(player.attributes as unknown as Attributes, player.position as Position);
      if (player.potential < overall) {
        add(`${p}.potential`, `potential (${player.potential}) is below current overall (${overall})`);
      }
    }
    if (player.clubTemplateId && !clubIds.has(player.clubTemplateId)) {
      add(`${p}.clubTemplateId`, `dangling reference: club template "${player.clubTemplateId}" does not exist in this pack${refNote}`, refSeverity);
    }
    if (player.creatorTemplateId && !creatorIds.has(player.creatorTemplateId)) {
      add(`${p}.creatorTemplateId`, `dangling reference: creator template "${player.creatorTemplateId}" does not exist in this pack${refNote}`, refSeverity);
    }
  }

  /* ------------------------------------------------------------- creators */
  const playerIds = new Set((data.players ?? []).map((p) => p.id));
  for (const [i, creator] of (data.creators ?? []).entries()) {
    const p = `creators[${i}]`;
    checkId('creator', `${p}.id`, creator.id);
    if (!creator.handle) add(`${p}.handle`, 'handle is required');
    if (!creator.displayName) add(`${p}.displayName`, 'displayName is required');
    if (!creator.bio) add(`${p}.bio`, 'bio is required — a creator without a personality is a stat block');
    if (!(CREATOR_TIERS as readonly string[]).includes(creator.tier)) {
      add(`${p}.tier`, `unknown creator tier "${creator.tier}"`);
    } else if (isFiniteNumber(creator.followers)) {
      const [floor, ceiling] = TIER_REACH[creator.tier as (typeof CREATOR_TIERS)[number]];
      if (creator.followers < floor || creator.followers > ceiling) {
        add(`${p}.followers`, `followers ${creator.followers} sit outside the ${creator.tier} band [${floor}, ${ceiling}]`, WARNING);
      }
    }
    if (!isFiniteNumber(creator.followers) || creator.followers < 0) {
      add(`${p}.followers`, 'followers must be a non-negative number');
    }
    if (!Array.isArray(creator.roles) || creator.roles.length === 0) {
      add(`${p}.roles`, 'at least one role is required');
    } else {
      for (const role of creator.roles) {
        if (!(CREATOR_ROLES as readonly string[]).includes(role)) add(`${p}.roles`, `unknown role "${role}"`);
      }
    }
    if (!creator.style) {
      add(`${p}.style`, 'style is required');
    } else {
      if (!VALID_CREATOR_TONES.has(creator.style.tone)) add(`${p}.style.tone`, `unknown tone "${creator.style.tone}"`);
      for (const platform of creator.style.platforms ?? []) {
        if (!VALID_PLATFORMS.has(platform)) add(`${p}.style.platforms`, `unknown platform "${platform}"`);
      }
      if (!isFiniteNumber(creator.style.postingFrequency) || creator.style.postingFrequency < 0) {
        add(`${p}.style.postingFrequency`, 'postingFrequency must be a non-negative number');
      }
    }
    if (creator.attributes) {
      for (const key of CREATOR_ATTRIBUTE_KEYS) {
        const value = creator.attributes[key];
        if (value === undefined) {
          add(`${p}.attributes.${key}`, `creator attribute "${key}" is missing`);
        } else if (!isFiniteNumber(value) || value < 1 || value > 99) {
          add(`${p}.attributes.${key}`, `creator attribute "${key}" must be between 1 and 99, got ${String(value)}`);
        }
      }
    } else {
      add(`${p}.attributes`, 'attributes are required');
    }
    if (creator.clubTemplateId && !clubIds.has(creator.clubTemplateId)) {
      add(`${p}.clubTemplateId`, `dangling reference: club template "${creator.clubTemplateId}" does not exist in this pack${refNote}`, refSeverity);
    }
    if (creator.playerTemplateId && !playerIds.has(creator.playerTemplateId)) {
      add(`${p}.playerTemplateId`, `dangling reference: player template "${creator.playerTemplateId}" does not exist in this pack${refNote}`, refSeverity);
    }
  }

  /* ------------------------------------------------------------- managers */
  for (const [i, manager] of (data.managers ?? []).entries()) {
    const p = `managers[${i}]`;
    checkId('manager', `${p}.id`, manager.id);
    if (!manager.name) add(`${p}.name`, 'name is required');
    if (!manager.archetypeId) add(`${p}.archetypeId`, 'archetypeId is required');
    if (!manager.bio) add(`${p}.bio`, 'bio is required');
    if (typeof manager.selectable !== 'boolean') add(`${p}.selectable`, 'selectable must be a boolean');
    for (const [key, value] of Object.entries(manager.attributes ?? {})) {
      if (!isFiniteNumber(value) || value < 1 || value > 99) {
        add(`${p}.attributes.${key}`, `manager attribute "${key}" must be between 1 and 99`);
      }
    }
    if (manager.creatorTemplateId && !creatorIds.has(manager.creatorTemplateId)) {
      add(`${p}.creatorTemplateId`, `dangling reference: creator template "${manager.creatorTemplateId}" does not exist in this pack${refNote}`, refSeverity);
    }
  }

  /* ------------------------------------------------------------- sponsors */
  for (const [i, sponsor] of (data.sponsors ?? []).entries()) {
    const p = `sponsors[${i}]`;
    checkId('sponsor', `${p}.id`, sponsor.id);
    if (!sponsor.name) add(`${p}.name`, 'name is required');
    if (!sponsor.blurb) add(`${p}.blurb`, 'blurb is required');
    if (!isFiniteNumber(sponsor.tier) || sponsor.tier < 1 || sponsor.tier > 5) add(`${p}.tier`, 'tier must be between 1 and 5');
    if (!isFiniteNumber(sponsor.baseValue) || sponsor.baseValue <= 0) add(`${p}.baseValue`, 'baseValue must be positive');
    if (!Array.isArray(sponsor.slots) || sponsor.slots.length === 0) {
      add(`${p}.slots`, 'at least one slot is required');
    } else {
      for (const slot of sponsor.slots) {
        if (!VALID_SPONSOR_SLOTS.has(slot)) add(`${p}.slots`, `unknown sponsor slot "${slot}"`);
      }
    }
    if (!isFiniteNumber(sponsor.requiresReputation) || sponsor.requiresReputation < 0 || sponsor.requiresReputation > 100) {
      add(`${p}.requiresReputation`, 'requiresReputation must be between 0 and 100');
    }
    if (!HEX.test(sponsor.accent ?? '')) add(`${p}.accent`, 'accent must be a #rrggbb hex colour');
  }

  /* ----------------------------------------------------------- facilities */
  for (const [i, facility] of (data.facilities ?? []).entries()) {
    const p = `facilities[${i}]`;
    checkId('facility', `${p}.id`, facility.id);
    if (!facility.name) add(`${p}.name`, 'name is required');
    if (!VALID_FACILITY_CATEGORIES.has(facility.category)) add(`${p}.category`, `unknown category "${facility.category}"`);
    const max = facility.maxLevel;
    if (!isFiniteNumber(max) || max < 1) {
      add(`${p}.maxLevel`, 'maxLevel must be at least 1');
      continue;
    }
    if (facility.upgradeCosts.length !== max) {
      add(`${p}.upgradeCosts`, `expected ${max} entries (level n -> n+1), got ${facility.upgradeCosts.length}`);
    }
    if (facility.upgradeCycles.length !== max) {
      add(`${p}.upgradeCycles`, `expected ${max} entries, got ${facility.upgradeCycles.length}`);
    }
    if (facility.upkeepPerCycle.length !== max + 1) {
      add(`${p}.upkeepPerCycle`, `expected ${max + 1} entries (one per level 0..${max}), got ${facility.upkeepPerCycle.length}`);
    }
    if (facility.levelEffects.length !== max + 1) {
      add(`${p}.levelEffects`, `expected ${max + 1} entries (one per level 0..${max}), got ${facility.levelEffects.length}`);
    }
    for (const cost of facility.upgradeCosts) {
      if (!isFiniteNumber(cost) || cost < 0) add(`${p}.upgradeCosts`, 'costs must be non-negative finite numbers');
    }
    const effectKeys = Object.keys(facility.effects ?? {});
    if (effectKeys.length === 0) {
      add(`${p}.effects`, 'a facility with no machine-readable effects does nothing');
    }
    for (const key of effectKeys) {
      const values = facility.effects[key];
      if (!Array.isArray(values) || values.length !== max + 1) {
        add(`${p}.effects.${key}`, `expected ${max + 1} values (one per level 0..${max})`);
        continue;
      }
      for (const value of values) {
        if (!isFiniteNumber(value)) add(`${p}.effects.${key}`, 'effect values must be finite numbers');
      }
    }
  }

  /* ----------------------------------------------------------- objectives */
  for (const [i, objective] of (data.objectives ?? []).entries()) {
    const p = `objectives[${i}]`;
    checkId('objective', `${p}.id`, objective.id);
    if (!objective.title) add(`${p}.title`, 'title is required');
    if (!objective.description) add(`${p}.description`, 'description is required');
    if (!objective.kind) add(`${p}.kind`, 'kind is required');
    if (!VALID_OBJECTIVE_SOURCES.has(objective.source)) add(`${p}.source`, `unknown source "${objective.source}"`);
    if (!isFiniteNumber(objective.importance) || objective.importance < 1 || objective.importance > 5) {
      add(`${p}.importance`, 'importance must be between 1 and 5');
    }
    if (!isFiniteNumber(objective.weight) || objective.weight <= 0) add(`${p}.weight`, 'weight must be positive');
    const target = objective.target;
    if (typeof target === 'number') {
      if (!isFiniteNumber(target)) add(`${p}.target`, 'target must be finite');
    } else if (target && typeof target === 'object') {
      if (!isFiniteNumber(target.min) || !isFiniteNumber(target.max) || target.min > target.max) {
        add(`${p}.target`, 'ranged target must be { min, max } with min <= max');
      }
    } else {
      add(`${p}.target`, 'target is required');
    }
    if (objective.durationCycles !== null && (!isFiniteNumber(objective.durationCycles) || objective.durationCycles <= 0)) {
      add(`${p}.durationCycles`, 'durationCycles must be null or a positive number');
    }
    if (!Array.isArray(objective.rewards) || objective.rewards.length === 0) {
      add(`${p}.rewards`, 'an objective with no reward is not an objective');
    } else {
      for (const reward of objective.rewards) {
        if (!VALID_REWARD_KINDS.has(reward.kind)) add(`${p}.rewards`, `unknown reward kind "${reward.kind}"`);
        if (!isFiniteNumber(reward.amount) || reward.amount < 0) add(`${p}.rewards`, 'reward amount must be non-negative');
        if (!reward.label) add(`${p}.rewards`, 'reward label is required for the UI');
      }
    }
  }

  /* --------------------------------------------------------------- offers */
  for (const [i, offer] of (data.offers ?? []).entries()) {
    const p = `offers[${i}]`;
    checkId('offer', `${p}.sku`, offer.sku);
    if (!offer.name) add(`${p}.name`, 'name is required');
    if (!offer.description) add(`${p}.description`, 'description is required');
    if (!isFiniteNumber(offer.priceMinor) || offer.priceMinor < 0) add(`${p}.priceMinor`, 'priceMinor must be non-negative');
    if (!offer.currency || offer.currency.length !== 3) add(`${p}.currency`, 'currency must be a 3-letter code');
    if (!VALID_TREATMENTS.has(offer.treatment)) add(`${p}.treatment`, `unknown treatment "${offer.treatment}"`);
    if (!Array.isArray(offer.contents) || offer.contents.length === 0) add(`${p}.contents`, 'an offer must contain something');
    for (const item of offer.contents ?? []) {
      if (!VALID_REWARD_KINDS.has(item.kind)) add(`${p}.contents`, `unknown content kind "${item.kind}"`);
      if (!isFiniteNumber(item.amount) || item.amount <= 0) add(`${p}.contents`, 'content amount must be positive');
    }
    if (!isFiniteNumber(offer.discountPercent) || offer.discountPercent < 0 || offer.discountPercent > 90) {
      add(`${p}.discountPercent`, 'discountPercent must be between 0 and 90');
    }
    if (offer.rotationWeek !== undefined && (offer.rotationWeek < 1 || offer.rotationWeek > 4)) {
      add(`${p}.rotationWeek`, 'rotationWeek must be between 1 and 4');
    }
    if (!HEX.test(offer.accent ?? '')) add(`${p}.accent`, 'accent must be a #rrggbb hex colour');
  }

  /* ----------------------------------------------------------- commentary */
  for (const [i, line] of (data.commentary ?? []).entries()) {
    const p = `commentary[${i}]`;
    checkId('commentary', `${p}.id`, line.id);
    if (!line.text) add(`${p}.text`, 'text is required');
    if (!VALID_EVENT_TYPES.has(line.eventType)) add(`${p}.eventType`, `unknown match event type "${line.eventType}"`);
    if (!VALID_TONES.has(line.tone)) add(`${p}.tone`, `unknown tone "${line.tone}"`);
    if (!isFiniteNumber(line.weight) || line.weight <= 0) add(`${p}.weight`, 'weight must be positive');
  }

  /* ------------------------------------------------------ social + media */
  for (const [i, template] of (data.socialTemplates ?? []).entries()) {
    const p = `socialTemplates[${i}]`;
    checkId('social', `${p}.id`, template.id);
    if (!template.trigger) add(`${p}.trigger`, 'trigger is required — a post with no source event cannot exist');
    if (!template.text) add(`${p}.text`, 'text is required');
    if (!VALID_SOCIAL_AUTHORS.has(template.authorKind)) add(`${p}.authorKind`, `unknown author kind "${template.authorKind}"`);
    if (!isFiniteNumber(template.sentiment) || template.sentiment < -1 || template.sentiment > 1) {
      add(`${p}.sentiment`, 'sentiment must be between -1 and 1');
    }
    if (!isFiniteNumber(template.weight) || template.weight <= 0) add(`${p}.weight`, 'weight must be positive');
  }
  for (const [i, template] of (data.mediaTemplates ?? []).entries()) {
    const p = `mediaTemplates[${i}]`;
    checkId('media', `${p}.id`, template.id);
    if (!template.trigger) add(`${p}.trigger`, 'trigger is required');
    if (!template.headline) add(`${p}.headline`, 'headline is required');
    if (!template.body) add(`${p}.body`, 'body is required');
    if (!Array.isArray(template.outlets) || template.outlets.length === 0) {
      add(`${p}.outlets`, 'at least one outlet is required');
    }
    if (!isFiniteNumber(template.importance) || template.importance < 1 || template.importance > 5) {
      add(`${p}.importance`, 'importance must be between 1 and 5');
    }
    if (!isFiniteNumber(template.sentiment) || template.sentiment < -1 || template.sentiment > 1) {
      add(`${p}.sentiment`, 'sentiment must be between -1 and 1');
    }
    if (!isFiniteNumber(template.weight) || template.weight <= 0) add(`${p}.weight`, 'weight must be positive');
  }

  /* ------------------------------------------------------------ nameBank */
  const bank = data.nameBanks;
  if (bank) {
    if (bank.firstNames.length < NAME_BANK_MINIMUMS.firstNames) {
      add('nameBanks.firstNames', `only ${bank.firstNames.length} first names; generated players will repeat`, WARNING);
    }
    if (bank.lastNames.length < NAME_BANK_MINIMUMS.lastNames) {
      add('nameBanks.lastNames', `only ${bank.lastNames.length} surnames; generated players will repeat`, WARNING);
    }
    const nationalityCodes = new Set<string>();
    for (const nation of bank.nationalities) {
      if (!nation.code || !nation.name) add('nameBanks.nationalities', 'each nationality needs a code and a name');
      if (!isFiniteNumber(nation.weight) || nation.weight <= 0) {
        add('nameBanks.nationalities', `nationality "${nation.code}" needs a positive weight`);
      }
      if (nationalityCodes.has(nation.code)) add('nameBanks.nationalities', `duplicate nationality code "${nation.code}"`);
      nationalityCodes.add(nation.code);
    }
    // A player referencing a nationality the bank does not define renders as a blank flag.
    for (const [i, player] of (data.players ?? []).entries()) {
      if (player.nationality && nationalityCodes.size > 0 && !nationalityCodes.has(player.nationality)) {
        add(`players[${i}].nationality`, `dangling reference: nationality "${player.nationality}" is not in this pack's name bank`, WARNING);
      }
    }
  }

  /* -------------------------------------------------------- season config */
  const config = data.seasonConfig;
  if (config) {
    const positives: readonly [string, number][] = [
      ['clubCount', config.clubCount], ['rounds', config.rounds],
      ['matchMinutes', config.matchMinutes], ['halves', config.halves],
      ['squadSize', config.squadSize], ['playersOnPitch', config.playersOnPitch],
    ];
    for (const [field, value] of positives) {
      if (!isFiniteNumber(value) || value <= 0) add(`seasonConfig.${field}`, `${field} must be a positive number`);
    }
    if (config.clubCount % 2 !== 0) {
      add('seasonConfig.clubCount', 'an odd club count leaves a club idle every week', WARNING);
    }
    if (config.benchSize >= config.squadSize) {
      add('seasonConfig.benchSize', 'benchSize must be smaller than squadSize');
    }
    if (config.substitutions > config.benchSize) {
      add('seasonConfig.substitutions', 'more substitutions allowed than players on the bench');
    }
    if (config.playersOnPitch >= config.squadSize) {
      add('seasonConfig.playersOnPitch', 'squad is too small to field a team');
    }
    if (config.prizeMoney.length < config.clubCount) {
      add('seasonConfig.prizeMoney', `prize money listed for ${config.prizeMoney.length} of ${config.clubCount} places`, WARNING);
    }
    if (config.playoffSpots + config.relegationSpots > config.clubCount) {
      add('seasonConfig.playoffSpots', 'playoff and relegation places exceed the number of clubs');
    }
  }

  return issues;
}

/** Convenience for tests and tooling. */
export const errorsOnly = (issues: readonly ValidationIssue[]): ValidationIssue[] =>
  issues.filter((i) => i.severity === 'error');

/**
 * Every cross-entity reference a pack makes, so the registry can re-check the
 * ones `validatePack` had to let through as warnings because they might resolve
 * inside a dependency.
 */
export function collectReferences(pack: ContentPack): { path: string; kind: string; id: string }[] {
  const out: { path: string; kind: string; id: string }[] = [];
  const data = pack.data ?? {};
  for (const [i, club] of (data.clubs ?? []).entries()) {
    for (const rivalId of club.rivalOf ?? []) out.push({ path: `clubs[${i}].rivalOf`, kind: 'club', id: rivalId });
  }
  for (const [i, player] of (data.players ?? []).entries()) {
    if (player.clubTemplateId) out.push({ path: `players[${i}].clubTemplateId`, kind: 'club', id: player.clubTemplateId });
    if (player.creatorTemplateId) out.push({ path: `players[${i}].creatorTemplateId`, kind: 'creator', id: player.creatorTemplateId });
  }
  for (const [i, creator] of (data.creators ?? []).entries()) {
    if (creator.clubTemplateId) out.push({ path: `creators[${i}].clubTemplateId`, kind: 'club', id: creator.clubTemplateId });
    if (creator.playerTemplateId) out.push({ path: `creators[${i}].playerTemplateId`, kind: 'player', id: creator.playerTemplateId });
  }
  for (const [i, manager] of (data.managers ?? []).entries()) {
    if (manager.creatorTemplateId) out.push({ path: `managers[${i}].creatorTemplateId`, kind: 'creator', id: manager.creatorTemplateId });
  }
  return out;
}
