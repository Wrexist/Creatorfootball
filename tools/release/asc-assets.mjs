#!/usr/bin/env node
// tools/release/asc-assets.mjs
//
// Product-page media through the App Store Connect asset library API: iPhone
// Duo screenshots (display class IPHONE_DUO) and the iOS 27 product page
// header and search results creative assets. The older appScreenshotSets API
// has no Duo display type; the asset library places an uploaded image on a
// version localization with a placement type and a placement group.
//
//   node tools/release/asc-assets.mjs --version 1.0.16 --explore
//     Read-only: prints Apple's placement groups and image specs for the three
//     placement types, and what is already placed on each English localization.
//   node tools/release/asc-assets.mjs --version 1.0.16 --upload [--dry-run]
//     Uploads apps/game/fastlane/screenshots/en-US/iphone-duo-*/ (in file order) and
//     apps/game/fastlane/creative_assets/en-US/{header,search-results}.png,
//     and places them on every English localization of the version.
//
// Env: APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID,
//      APP_STORE_CONNECT_API_KEY_BASE64. Optional DUO_DIR overrides the
//      screenshot folder.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE_ID = 'com.creatorfootball.app';
const API = 'https://api.appstoreconnect.apple.com';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DUO_DIR = process.env.DUO_DIR ?? path.join(ROOT, 'apps/game/fastlane/screenshots/en-US');
const CREATIVE_DIR = path.join(ROOT, 'apps/game/fastlane/creative_assets/en-US');

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const VERSION = arg('version');
const EXPLORE = argv.includes('--explore');
const UPLOAD = argv.includes('--upload');
const DRY = argv.includes('--dry-run');
const log = (...m) => console.log('[asc-assets]', ...m);
const fail = (m) => { console.error(`::error::${m}`); process.exit(1); };
if (!/^\d+\.\d+\.\d+$/.test(VERSION ?? '')) fail('--version must be MAJOR.MINOR.PATCH');
if (!EXPLORE && !UPLOAD) fail('Pass --explore or --upload.');

/* --- auth + http (same scheme as asc-release.mjs) ---------------------- */

const b64url = (input) => Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
let pem = (process.env.APP_STORE_CONNECT_API_KEY_BASE64 ?? '').trim() || fail('APP_STORE_CONNECT_API_KEY_BASE64 is not set.');
if (!pem.includes('BEGIN')) pem = Buffer.from(pem.replace(/\s+/g, ''), 'base64').toString('utf8');
const KEY = crypto.createPrivateKey({ key: pem, format: 'pem' });
const KEY_ID = process.env.APP_STORE_CONNECT_KEY_ID ?? fail('APP_STORE_CONNECT_KEY_ID is not set.');
const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID ?? fail('APP_STORE_CONNECT_ISSUER_ID is not set.');
let token = null;
let tokenAt = 0;
function bearer() {
  const now = Math.floor(Date.now() / 1000);
  if (!token || now - tokenAt > 600) {
    const head = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
    const body = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
    token = `${head}.${body}.${b64url(crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: KEY, dsaEncoding: 'ieee-p1363' }))}`;
    tokenAt = now;
  }
  return token;
}
async function asc(method, route, body) {
  if (method !== 'GET' && DRY) { log(`DRY RUN — would ${method} ${route}`, body ? JSON.stringify(body).slice(0, 260) : ''); return null; }
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { Authorization: `Bearer ${bearer()}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (json?.errors ?? []).map((e) => `${e.code}: ${e.title} — ${e.detail ?? ''}`).join(' | ');
    throw new Error(`${method} ${route} → HTTP ${res.status} ${detail || text.slice(0, 400)}`);
  }
  return json;
}
const q = (params) => new URLSearchParams(params).toString();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/* --- image files ------------------------------------------------------ */

function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    if (marker === 0xc0 || marker === 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`Unreadable image ${file}`);
}
// Apple's IPHONE_DUO_PROFILE group takes both displays' sizes but at most 10
// images in total, so one set is placed: the unfolded inner display by
// default (DUO_SET=outer for the closed-phone set).
const DUO_SET = process.env.DUO_SET ?? 'inner';
function duoScreens() {
  if (!fs.existsSync(DUO_DIR)) return [];
  return fs.readdirSync(DUO_DIR).filter((d) => d.startsWith(`iphone-duo-${DUO_SET}`) && fs.statSync(path.join(DUO_DIR, d)).isDirectory()).sort()
    .flatMap((dir) => fs.readdirSync(path.join(DUO_DIR, dir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
      .map((f) => ({ file: path.join(DUO_DIR, dir, f), set: dir })));
}

/* --- run ---------------------------------------------------------------- */

const appId = (await asc('GET', `/v1/apps?${q({ 'filter[bundleId]': BUNDLE_ID, limit: '1' })}`)).data?.[0]?.id ?? fail('App not found.');
const version = (await asc('GET', `/v1/apps/${appId}/appStoreVersions?${q({ 'filter[platform]': 'IOS', 'filter[versionString]': VERSION, limit: '1' })}`)).data?.[0] ?? fail(`No version ${VERSION}.`);
const locales = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)).data.filter((l) => l.attributes.locale.startsWith('en'));
const library = (await asc('GET', `/v1/apps/${appId}/assetLibrary`)).data ?? fail('No asset library for this app.');
log(`app ${appId}, version ${VERSION} (${version.attributes.appStoreState}), asset library ${library.id}, locales ${locales.map((l) => l.attributes.locale).join(', ')}`);

const TYPES = ['APP_SCREENSHOT', 'PRODUCT_PAGE_HEADER_ASSET', 'APP_STORE_SEARCH_RESULTS_ASSET'];
const ref = (await asc('GET', `/v1/appAssetLibraryRefData?${q({ 'filter[placementTypes]': TYPES.join(','), 'filter[features]': 'APP_STORE_VERSIONS' })}`)).data;
const groups = ref.flatMap((r) => r.attributes.placementProfileGroups ?? []);
const specs = ref.flatMap((r) => r.attributes.imageSpecs ?? []);
const policies = ref.flatMap((r) => (r.attributes.features ?? []).flatMap((f) => (f.placementPolicies ?? []).map((p) => ({ feature: f.featureId, ...p }))));

if (EXPLORE) {
  log('placement profile groups:');
  for (const g of groups) log(`  ${g.placementProfileGroupId}  platform=${g.platform} display=${g.displayClassId}`);
  log('image specs:');
  for (const s of specs) {
    const d = s.dimensions ?? {};
    log(`  ${s.specId} "${s.shortName}" ${d.minWidth}-${d.maxWidth} x ${d.minHeight}-${d.maxHeight} ratio=${s.aspectRatio} alpha=${s.alphaAllowed} types=${(s.compatiblePlacementTypes ?? []).join('/')} ext=${(s.fileExtensions ?? []).join('/')}`);
  }
  log('placement policies:');
  for (const p of policies) log(`  ${p.feature} ${p.placementType}: ${(p.groupLimits ?? []).map((g) => `[${(g.groupIds ?? []).join(',')}] max ${g.maxCount}`).join('; ')}`);
  for (const loc of locales) {
    const placed = (await asc('GET', `/v1/appStoreVersionLocalizations/${loc.id}/placements?limit=200`)).data;
    log(`${loc.attributes.locale}: ${placed.length} placement(s) — ${[...new Set(placed.map((p) => `${p.attributes.placementType}/${p.attributes.placementGroup}`))].join(', ')}`);
  }
  log('local files:');
  for (const s of duoScreens()) log(`  ${s.set}/${path.basename(s.file)} ${imageSize(s.file).join('x')}`);
  for (const f of ['header.png', 'search-results.png']) log(`  creative ${f} ${imageSize(path.join(CREATIVE_DIR, f)).join('x')}`);
  process.exit(0);
}

/* --- upload ------------------------------------------------------------ */

const duoGroup = groups.find((g) => g.displayClassId === 'IPHONE_DUO')?.placementProfileGroupId
  ?? fail(`No IPHONE_DUO placement group in Apple's reference data: ${groups.map((g) => g.displayClassId).join(', ')}`);
// Header and search results are universal assets; use the group Apple lists
// for them (if any) rather than guessing.
const groupFor = (type) => {
  const limit = policies.find((p) => p.placementType === type && p.feature === 'APP_STORE_VERSIONS')?.groupLimits?.[0]?.groupIds?.[0];
  return limit ?? null;
};

async function uploadImage(file, category) {
  const [w, h] = imageSize(file);
  const bytes = fs.readFileSync(file);
  const created = await asc('POST', '/v1/appAssetLibraryImages', { data: { type: 'appAssetLibraryImages', attributes: { fileName: path.basename(file), fileSize: bytes.length, category }, relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: library.id } } } } });
  if (!created) return { id: `dry-${path.basename(file)}` };
  for (const op of created.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((hdr) => [hdr.name, hdr.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`Upload of ${path.basename(file)} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const md5 = crypto.createHash('md5').update(bytes).digest('hex');
  await asc('PATCH', `/v1/appAssetLibraryImages/${created.data.id}`, { data: { type: 'appAssetLibraryImages', id: created.data.id, attributes: { uploaded: true } } });
  for (let tries = 0; tries < 60; tries += 1) {
    const image = (await asc('GET', `/v1/appAssetLibraryImages/${created.data.id}`)).data;
    const state = image.attributes.state;
    if (state === 'FAILED') throw new Error(`${path.basename(file)} failed processing: ${JSON.stringify(image.attributes.stateDetails ?? [])}`);
    if (!['AWAITING_UPLOAD', 'UPLOAD_COMPLETE'].includes(state)) { log(`uploaded ${path.basename(file)} ${w}x${h} md5 ${md5.slice(0, 8)} → ${state}`); return image; }
    await sleep(5000);
  }
  throw new Error(`${path.basename(file)} did not finish processing.`);
}

async function place(image, type, group, loc) {
  const attributes = { placementType: type, ...(group ? { placementGroup: group } : {}) };
  const placed = await asc('POST', '/v1/appAssetLibraryPlacements', { data: { type: 'appAssetLibraryPlacements', attributes, relationships: { image: { data: { type: 'appAssetLibraryImages', id: image.id } }, appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } });
  return placed?.data;
}

const screens = duoScreens();
if (screens.length === 0) fail(`No Duo screenshots in ${DUO_DIR}.`);
const creative = [
  { file: path.join(CREATIVE_DIR, 'header.png'), type: 'PRODUCT_PAGE_HEADER_ASSET' },
  { file: path.join(CREATIVE_DIR, 'search-results.png'), type: 'APP_STORE_SEARCH_RESULTS_ASSET' },
];

for (const loc of locales) {
  const existing = (await asc('GET', `/v1/appStoreVersionLocalizations/${loc.id}/placements?limit=200`)).data;
  const has = (type, group) => existing.some((p) => p.attributes.placementType === type && (group === null || p.attributes.placementGroup === group));
  log(`${loc.attributes.locale}: ${existing.length} existing placement(s)`);

  // Duo screenshots, in file order (outer set first, then inner).
  if (has('APP_SCREENSHOT', duoGroup)) log(`${loc.attributes.locale}: Duo screenshots already placed — skipping`);
  else {
    const placedIds = [];
    for (const shot of screens) {
      const image = await uploadImage(shot.file, 'APP_SCREENSHOTS_AND_PREVIEWS');
      const placement = await place(image, 'APP_SCREENSHOT', duoGroup, loc);
      if (placement) placedIds.push(placement.id);
    }
    if (placedIds.length > 1) {
      await asc('POST', '/v1/appAssetLibraryPlacementOrderingRequests', { data: { type: 'appAssetLibraryPlacementOrderingRequests', attributes: { placementGroup: duoGroup }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } }, orderedPlacements: { data: placedIds.map((id) => ({ type: 'appAssetLibraryPlacements', id })) } } } });
    }
    log(`${loc.attributes.locale}: placed ${screens.length} Duo screenshots in group ${duoGroup}`);
  }

  for (const asset of creative) {
    const group = groupFor(asset.type);
    if (has(asset.type, null)) { log(`${loc.attributes.locale}: ${asset.type} already placed — skipping`); continue; }
    const image = await uploadImage(asset.file, 'CREATIVE_ASSETS');
    await place(image, asset.type, group, loc);
    log(`${loc.attributes.locale}: placed ${path.basename(asset.file)} as ${asset.type}${group ? ` (group ${group})` : ''}`);
  }
}
log(DRY ? 'DRY RUN complete — nothing uploaded.' : 'All media uploaded and placed.');
