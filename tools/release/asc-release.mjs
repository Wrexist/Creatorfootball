#!/usr/bin/env node
// tools/release/asc-release.mjs
//
// Prepares an App Store version for review through the App Store Connect API,
// and optionally submits it — the same API key the TestFlight workflow uses,
// so nobody has to sign in to the website for the parts the API covers:
//
//   1. waits until the uploaded build has finished processing (VALID),
//   2. attaches that build to the App Store version,
//   3. writes description and promotional text (and What's New when the
//      version is an update) to every English localization, from
//      apps/game/fastlane/metadata/en-US/,
//   4. writes the review notes from docs/APP_STORE.md §6,
//   5. with --submit, adds the version to the open review submission (the
//      existing draft keeps its other items) and submits it.
//
// Not covered, because the public API (spec 4.5.1) has no endpoints for them:
// iPhone Duo screenshot sets and the iOS 27 header / search-results creative
// assets. Upload those in App Store Connect BEFORE running with --submit:
// metadata is locked while a version waits for review.
//
// Usage (CI: .github/workflows/ios-app-store.yml):
//   node tools/release/asc-release.mjs --version 1.0.16 --build 15 [--replace] [--submit] [--dry-run]
//   --replace  if the version is already waiting for review, remove it from
//              review and rebuild a draft with the same items, so a newer
//              build can be attached. Costs the place in the review queue.
// Env: APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID,
//      APP_STORE_CONNECT_API_KEY_BASE64 (base64 or raw .p8). ASC_APP_ID optional.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE_ID = 'com.creatorfootball.app';
const API = 'https://api.appstoreconnect.apple.com';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const METADATA = path.join(ROOT, 'apps/game/fastlane/metadata/en-US');

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const VERSION = arg('version');
const BUILD = arg('build');
const SUBMIT = argv.includes('--submit');
const DRY = argv.includes('--dry-run');
const WAIT_MINUTES = Number(arg('wait-minutes') ?? '60');

const log = (...m) => console.log('[asc-release]', ...m);
const fail = (m) => { console.error(`::error::${m}`); process.exit(1); };

if (!/^\d+\.\d+\.\d+$/.test(VERSION ?? '')) fail('--version must be MAJOR.MINOR.PATCH, e.g. 1.0.16');
if (!/^\d+$/.test(BUILD ?? '')) fail('--build must be the CFBundleVersion number, e.g. 15');

/* --- auth ------------------------------------------------------------- */

const b64url = (input) => Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function loadP8() {
  let raw = (process.env.APP_STORE_CONNECT_API_KEY_BASE64 ?? '').trim();
  if (!raw) fail('APP_STORE_CONNECT_API_KEY_BASE64 is not set.');
  if (!raw.includes('BEGIN')) raw = Buffer.from(raw.replace(/\s+/g, ''), 'base64').toString('utf8');
  return raw;
}
const KEY_ID = process.env.APP_STORE_CONNECT_KEY_ID ?? fail('APP_STORE_CONNECT_KEY_ID is not set.');
const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID ?? fail('APP_STORE_CONNECT_ISSUER_ID is not set.');
const KEY = crypto.createPrivateKey({ key: loadP8(), format: 'pem' });
let token = null;
let tokenAt = 0;
function bearer() {
  const now = Math.floor(Date.now() / 1000);
  // Tokens live 20 minutes; the build wait can outlast one.
  if (!token || now - tokenAt > 600) {
    const head = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
    const body = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
    const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: KEY, dsaEncoding: 'ieee-p1363' });
    token = `${head}.${body}.${b64url(sig)}`;
    tokenAt = now;
  }
  return token;
}

/* --- http ------------------------------------------------------------- */

async function asc(method, route, body) {
  const write = method !== 'GET';
  if (write && DRY) { log(`DRY RUN — would ${method} ${route}`, body ? JSON.stringify(body).slice(0, 300) : ''); return null; }
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { Authorization: `Bearer ${bearer()}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (json?.errors ?? []).map((e) => `${e.code}: ${e.title} — ${e.detail ?? ''}`).join(' | ');
    const error = new Error(`${method} ${route} → HTTP ${res.status} ${detail || text.slice(0, 400)}`);
    error.status = res.status;
    error.errors = json?.errors ?? [];
    throw error;
  }
  return json;
}
const q = (params) => new URLSearchParams(params).toString();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/* --- inputs ------------------------------------------------------------- */

const readMeta = (file) => fs.readFileSync(path.join(METADATA, file), 'utf8').replace(/\r\n/g, '\n').trim();
const description = readMeta('description.txt');
const promotionalText = readMeta('promotional_text.txt');
const whatsNew = readMeta('release_notes.txt');
const reviewNotes = (() => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/APP_STORE.md'), 'utf8').replace(/\r\n/g, '\n');
  const section = doc.slice(doc.indexOf('## 6. Review notes'));
  const match = section.match(/```\n([\s\S]*?)\n```/);
  if (!match) fail('Could not find the review notes block in docs/APP_STORE.md §6.');
  return match[1].trim();
})();
if (description.length > 4000) fail(`description.txt is ${description.length} characters (limit 4000).`);
if (promotionalText.length > 170) fail(`promotional_text.txt is ${promotionalText.length} characters (limit 170).`);
if (reviewNotes.length > 4000) fail(`Review notes are ${reviewNotes.length} characters (limit 4000).`);

/* --- run ---------------------------------------------------------------- */

log(`${DRY ? 'DRY RUN: ' : ''}version ${VERSION} build ${BUILD}${SUBMIT ? ', submit for review' : ''}`);

const appId = process.env.ASC_APP_ID
  || (await asc('GET', `/v1/apps?${q({ 'filter[bundleId]': BUNDLE_ID, limit: '1' })}`)).data?.[0]?.id
  || fail(`No App Store Connect app for ${BUNDLE_ID}.`);
log(`app ${appId}`);

const versions = (await asc('GET', `/v1/apps/${appId}/appStoreVersions?${q({ 'filter[platform]': 'IOS', limit: '20' })}`)).data;
const version = versions.find((v) => v.attributes.versionString === VERSION)
  ?? fail(`No iOS App Store version ${VERSION}. Existing: ${versions.map((v) => `${v.attributes.versionString} (${v.attributes.appStoreState})`).join(', ')}`);
const isUpdate = versions.some((v) => ['READY_FOR_SALE', 'REPLACED_WITH_NEW_VERSION', 'REMOVED_FROM_SALE', 'DEVELOPER_REMOVED_FROM_SALE'].includes(v.attributes.appStoreState));
log(`version ${version.id} state ${version.attributes.appStoreState}${isUpdate ? ' (update)' : ' (first release)'}`);

// 1. the build, once Apple has finished processing it
const deadline = Date.now() + WAIT_MINUTES * 60_000;
let build;
for (;;) {
  build = (await asc('GET', `/v1/builds?${q({ 'filter[app]': appId, 'filter[version]': BUILD, 'filter[preReleaseVersion.version]': VERSION, limit: '1' })}`)).data?.[0];
  const state = build?.attributes?.processingState ?? 'NOT_FOUND';
  log(`build ${BUILD}: ${state}`);
  if (state === 'VALID') break;
  if (state === 'INVALID' || state === 'FAILED') fail(`Build ${BUILD} processing ${state}.`);
  if (Date.now() > deadline) fail(`Build ${BUILD} was not VALID within ${WAIT_MINUTES} minutes.`);
  await sleep(60_000);
}
if (build.attributes.usesNonExemptEncryption === null || build.attributes.usesNonExemptEncryption === undefined) {
  log('build has no export-compliance answer; Info.plist declares ITSAppUsesNonExemptEncryption=false, so setting it.');
  await asc('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
}

// Subscriptions are reviewed with the binary but are not review-submission
// items: they are sent with POST /v1/subscriptionSubmissions. Report them so a
// submission never silently goes out without Creator Club.
async function subscriptions() {
  const groups = await asc('GET', `/v1/apps/${appId}/subscriptionGroups?${q({ include: 'subscriptions', limit: '10' })}`);
  const groupOf = new Map((groups.data ?? []).flatMap((g) => (g.relationships?.subscriptions?.data ?? []).map((s) => [s.id, g.id])));
  return (groups.included ?? []).filter((r) => r.type === 'subscriptions')
    .map((s) => ({ id: s.id, productId: s.attributes.productId, state: s.attributes.state, groupId: groupOf.get(s.id) }));
}
// Subscriptions and their group are reviewed as versions, added to the review
// submission like any other item. Reuse a version that is still editable;
// create one only when none exists yet.
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW', 'DEVELOPER_REJECTED', 'REJECTED'];
async function pendingVersion(listRoute, type, rel, relType, parentId) {
  const versions = (await asc('GET', listRoute)).data ?? [];
  const editable = versions.find((v) => EDITABLE.includes(v.attributes.state));
  if (editable) return editable;
  return (await asc('POST', `/v1/${type}`, { data: { type, relationships: { [rel]: { data: { type: relType, id: parentId } } } } }))?.data ?? null;
}
for (const s of await subscriptions()) log(`subscription ${s.productId}: ${s.state}`);

// 1b. --replace: pull a version that is already waiting for review back out,
// keeping every other item (subscription group, plans, one-time purchases)
// in a fresh draft so nothing has to be re-added by hand.
const OPEN_STATES = 'READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES,CANCELING';
const ITEM_RELATIONSHIPS = ['appStoreVersion', 'appCustomProductPageVersion', 'appStoreVersionExperimentV2', 'appEvent', 'inAppPurchaseVersion', 'subscriptionVersion', 'subscriptionGroupVersion', 'backgroundAssetVersion'];
async function submissionItems(id) {
  const items = (await asc('GET', `/v1/reviewSubmissions/${id}/items?${q({ include: ITEM_RELATIONSHIPS.join(','), limit: '50' })}`)).data;
  return items.map((item) => {
    const rel = ITEM_RELATIONSHIPS.find((name) => item.relationships?.[name]?.data?.id);
    return rel ? { rel, type: item.relationships[rel].data.type, id: item.relationships[rel].data.id, state: item.attributes?.state } : null;
  }).filter(Boolean);
}
async function addItem(submissionId, item) {
  await asc('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } }, [item.rel]: { data: { type: item.type, id: item.id } } } } });
}
const REPLACE = argv.includes('--replace');
const pending = (await asc('GET', `/v1/apps/${appId}/reviewSubmissions?${q({ 'filter[platform]': 'IOS', 'filter[state]': OPEN_STATES, limit: '10' })}`)).data
  .filter((s) => s.attributes.state !== 'READY_FOR_REVIEW');
for (const submission of pending) {
  const items = await submissionItems(submission.id);
  log(`submission ${submission.id} is ${submission.attributes.state} with ${items.length} item(s): ${items.map((i) => i.rel).join(', ')}`);
  if (!items.some((i) => i.rel === 'appStoreVersion' && i.id === version.id)) continue;
  if (!REPLACE) fail(`Version ${VERSION} is already ${submission.attributes.state} (${submission.id}). Run with --replace to pull it out of review and swap in build ${BUILD}.`);
  if (submission.attributes.state !== 'CANCELING') {
    await asc('PATCH', `/v1/reviewSubmissions/${submission.id}`, { data: { type: 'reviewSubmissions', id: submission.id, attributes: { canceled: true } } });
    log(`requested removal from review for ${submission.id}`);
  }
  if (DRY) { log(`DRY RUN — would wait for cancellation, then re-create a draft with: ${items.map((i) => `${i.rel}:${i.id}`).join(', ')}`); continue; }
  for (let tries = 0; ; tries += 1) {
    const state = (await asc('GET', `/v1/reviewSubmissions/${submission.id}`)).data.attributes.state;
    const versionState = (await asc('GET', `/v1/appStoreVersions/${version.id}`)).data.attributes.appStoreState;
    log(`cancellation: submission ${state}, version ${versionState}`);
    if (!['WAITING_FOR_REVIEW', 'IN_REVIEW', 'CANCELING'].includes(state) && !['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(versionState)) break;
    if (tries > 30) fail('Apple did not finish removing the submission from review within 30 minutes.');
    await sleep(60_000);
  }
  // A new draft holding exactly what was in review before.
  let draft = (await asc('GET', `/v1/apps/${appId}/reviewSubmissions?${q({ 'filter[platform]': 'IOS', 'filter[state]': 'READY_FOR_REVIEW', limit: '1' })}`)).data[0];
  if (!draft) draft = (await asc('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: appId } } } } })).data;
  const already = await submissionItems(draft.id);
  for (const item of items) {
    if (already.some((a) => a.rel === item.rel && a.id === item.id)) continue;
    try { await addItem(draft.id, item); log(`re-added ${item.rel} ${item.id} to draft ${draft.id}`); }
    catch (error) { console.error(`::warning::Could not re-add ${item.rel} ${item.id}: ${error.message}`); }
  }
  log(`draft ${draft.id} ready with ${(await submissionItems(draft.id)).length} item(s)`);
}

// 2. attach it
const current = await asc('GET', `/v1/appStoreVersions/${version.id}/relationships/build`);
if (current?.data?.id === build.id) log('build already attached');
else {
  await asc('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
  log(`attached build ${BUILD} (was ${current?.data?.id ?? 'none'})`);
}

// 3. English listing text
const localizations = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)).data;
const english = localizations.filter((l) => l.attributes.locale.startsWith('en'));
if (english.length === 0) fail(`No English localization on ${VERSION}: ${localizations.map((l) => l.attributes.locale).join(', ')}`);
for (const loc of english) {
  const attributes = { description, promotionalText, ...(isUpdate ? { whatsNew } : {}) };
  await asc('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes } });
  log(`updated ${loc.attributes.locale}: description ${description.length} chars, promo ${promotionalText.length}${isUpdate ? `, what's new ${whatsNew.length}` : ''}`);
}

// 4. review notes (contact details are left exactly as the owner entered them)
const detail = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch((e) => { if (e.status === 404) return null; throw e; }))?.data;
if (detail) {
  await asc('PATCH', `/v1/appStoreReviewDetails/${detail.id}`, { data: { type: 'appStoreReviewDetails', id: detail.id, attributes: { notes: reviewNotes } } });
  const a = detail.attributes;
  log(`review notes updated (${reviewNotes.length} chars); contact on file: ${a.contactFirstName && a.contactEmail && a.contactPhone ? 'yes' : 'INCOMPLETE — add first name, email and phone in App Store Connect'}`);
} else {
  log('no review detail exists yet; creating one with the notes.');
  await asc('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: { notes: reviewNotes, demoAccountRequired: false }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
}

// 5. submit
if (!SUBMIT) { log('Prepared. Re-run with --submit to send it for review.'); process.exit(0); }
const open = (await asc('GET', `/v1/apps/${appId}/reviewSubmissions?${q({ 'filter[platform]': 'IOS', 'filter[state]': 'READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES', limit: '10' })}`)).data;
const busy = open.find((s) => s.attributes.state !== 'READY_FOR_REVIEW');
if (busy) fail(`A review submission is already ${busy.attributes.state} (${busy.id}); not submitting another.`);
let submission = open[0];
if (!submission) {
  submission = (await asc('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: appId } } } } }))?.data;
  log(`created review submission ${submission?.id ?? '(dry run)'}`);
}
if (submission) {
  const items = (await asc('GET', `/v1/reviewSubmissions/${submission.id}/items?${q({ include: 'appStoreVersion', limit: '50' })}`)).data;
  log(`submission ${submission.id} has ${items.length} item(s)`);
  const hasVersion = items.some((item) => item.relationships?.appStoreVersion?.data?.id === version.id);
  if (!hasVersion) {
    await asc('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
    log(`added version ${VERSION} to submission`);
  }
  // First-time (READY_TO_SUBMIT) subscriptions go in with the version, with
  // their group.
  const present = await submissionItems(submission.id);
  const inDraft = (rel, id) => present.some((i) => i.rel === rel && i.id === id);
  const ready = (await subscriptions()).filter((sub) => sub.state === 'READY_TO_SUBMIT');
  for (const groupId of [...new Set(ready.map((sub) => sub.groupId).filter(Boolean))]) {
    const gv = await pendingVersion(`/v1/subscriptionGroups/${groupId}/versions`, 'subscriptionGroupVersions', 'subscriptionGroup', 'subscriptionGroups', groupId);
    if (gv && !inDraft('subscriptionGroupVersion', gv.id)) { await addItem(submission.id, { rel: 'subscriptionGroupVersion', type: 'subscriptionGroupVersions', id: gv.id }); log(`added subscription group ${groupId} (version ${gv.id})`); }
  }
  for (const sub of ready) {
    const sv = await pendingVersion(`/v1/subscriptions/${sub.id}/versions`, 'subscriptionVersions', 'subscription', 'subscriptions', sub.id);
    if (sv && !inDraft('subscriptionVersion', sv.id)) { await addItem(submission.id, { rel: 'subscriptionVersion', type: 'subscriptionVersions', id: sv.id }); log(`added subscription ${sub.productId} (version ${sv.id})`); }
  }
  log(`submission ${submission.id} now has ${(await submissionItems(submission.id)).length} item(s)`);
  await asc('PATCH', `/v1/reviewSubmissions/${submission.id}`, { data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } } });
  log(DRY ? 'DRY RUN — would submit.' : `SUBMITTED for review: submission ${submission.id}`);
}
