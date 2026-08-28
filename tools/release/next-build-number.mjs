#!/usr/bin/env node
// tools/release/next-build-number.mjs
//
// Resolves the next iOS CFBundleVersion (build number) so every build is
// STRICTLY higher than anything already on App Store Connect — which prevents
// the "You've already submitted this build of the app" rejection at upload
// time. Ported 2026-08-28 from Wrexist/WorldQuest's scripts/next-build-number.mjs
// (itself ported from Wrexist/DeepLifeSimulator): the logic is generic — an
// App Store Connect JWT plus a build-number lookup — and only the app
// resolution changed to match this repo. WorldQuest reads its numeric ASC app
// id out of eas.json; Creator Football has no EAS at all (it is a Capacitor
// app archived with xcodebuild), so this script looks the app up by BUNDLE ID
// through the same API instead, which means nothing has to be committed or
// configured once the App Store Connect record exists.
//
// Why this exists at all: xcodebuild takes whatever CURRENT_PROJECT_VERSION
// it is given and nothing in the toolchain guarantees uniqueness across CI
// runs. The pbxproj pins `CURRENT_PROJECT_VERSION = 1`, so two archives from
// two runs would both be build 1 and Apple would reject the second. The
// workflow (.github/workflows/ios-testflight.yml) overrides it per-run with
// this script's output.
//
// Resolution order:
//   1. App Store Connect API (authoritative) — the highest build number Apple
//      already has on record for com.creatorfootball.app, + 1. Enabled when
//      APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID and
//      APP_STORE_CONNECT_API_KEY_BASE64 are set AND an app record already
//      exists in App Store Connect for the bundle ID (see docs/RELEASE_IOS.md
//      for creating it). ASC_APP_ID skips the bundle-ID lookup if set.
//   2. Epoch-seconds fallback — strictly monotonic and always higher than any
//      small historical build number. Used when ASC creds/app record are
//      absent or the lookup fails, so a build is never blocked on Apple
//      connectivity or on the app record not existing yet.
//
// Output contract: the chosen integer is printed to STDOUT and nothing else,
// so it is safe to capture with
// `BUILD_NUMBER=$(node tools/release/next-build-number.mjs)`.
// Every diagnostic goes to STDERR.
//
// Flags:
//   --ask       In a TTY, show the proposed number and let the user accept
//               (Enter), override (type a number), or abort ('n'). Ignored in
//               non-interactive CI (no TTY) so automated builds never hang.
//   --selftest  Build and print the App Store Connect JWT from the provided
//               creds WITHOUT calling Apple (to debug auth setup), then exit.

import crypto from 'node:crypto';
import https from 'node:https';
import fs from 'node:fs';
import readline from 'node:readline';
import { Buffer } from 'node:buffer';

const BUNDLE_ID = 'com.creatorfootball.app';

const ARGS = process.argv.slice(2);
const has = (flag) => ARGS.includes(flag);
const log = (...a) => console.error('[next-build-number]', ...a);

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Accepts the key either as raw PEM contents or as base64-encoded PEM — the
// same tolerant handling as the workflow's own key-install step, since both
// read the same APP_STORE_CONNECT_API_KEY_BASE64 secret and different OSes
// produce differently-shaped pastes.
function loadP8() {
  const inline = process.env.APP_STORE_CONNECT_API_KEY_BASE64;
  const file = process.env.APP_STORE_CONNECT_KEY_P8_PATH;
  let raw = null;
  if (inline && inline.trim()) raw = inline;
  else if (file && fs.existsSync(file)) raw = fs.readFileSync(file, 'utf8');
  if (!raw) return null;
  raw = raw.trim();
  if (!raw.includes('BEGIN')) {
    try {
      raw = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      /* fall through with the original */
    }
  }
  return raw;
}

function makeAscJwt({ keyId, issuerId, p8 }) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey({ key: p8, format: 'pem' });
  // ES256 (ECDSA P-256/SHA-256). JWT requires the raw r||s signature, so use
  // the IEEE-P1363 encoding rather than Node's default DER.
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(sig)}`;
}

function httpsGetJson(reqUrl, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(reqUrl);
    const req = https.request(
      {
        method: 'GET',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`ASC API HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('ASC API timeout')));
    req.end();
  });
}

// The numeric App Store Connect app id. ASC_APP_ID short-circuits (useful the
// day Apple's search index and a fresh app record disagree); otherwise the
// bundle ID is authoritative and nothing needs committing to the repo.
async function resolveAppId(token) {
  if (process.env.ASC_APP_ID) return process.env.ASC_APP_ID;
  const api =
    `https://api.appstoreconnect.apple.com/v1/apps` +
    `?filter%5BbundleId%5D=${encodeURIComponent(BUNDLE_ID)}&fields%5Bapps%5D=bundleId&limit=2`;
  const payload = await httpsGetJson(api, token);
  const apps = Array.isArray(payload?.data) ? payload.data : [];
  if (apps.length === 0) {
    log(
      `App Store Connect has no app record for ${BUNDLE_ID} yet — skipping the lookup. ` +
        'This is expected until the record is created; see docs/RELEASE_IOS.md.',
    );
    return null;
  }
  return apps[0].id;
}

function maxBuildFromAscPayload(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  let max = 0;
  for (const b of data) {
    // For a Build resource, attributes.version IS the CFBundleVersion.
    const n = parseInt(String(b?.attributes?.version), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function fromAppStoreConnect() {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const p8 = loadP8();

  if (!keyId || !issuerId || !p8) {
    log(
      'ASC creds not set (need APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, ' +
        'APP_STORE_CONNECT_API_KEY_BASE64) — skipping App Store Connect lookup.',
    );
    return null;
  }

  const token = makeAscJwt({ keyId, issuerId, p8 });

  if (has('--selftest')) {
    const [h, p, s] = token.split('.');
    log('JWT header :', Buffer.from(h, 'base64').toString());
    log('JWT payload:', Buffer.from(p, 'base64').toString());
    log('JWT signature bytes:', Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').length, '(ES256 expects 64)');
    process.exit(0);
  }

  const appId = await resolveAppId(token);
  if (!appId) return null;

  // Sort by most-recently-uploaded so the highest numbers are in the first page;
  // compute the max client-side regardless of sort. Sparse fieldset keeps it light.
  const api =
    `https://api.appstoreconnect.apple.com/v1/builds` +
    `?filter%5Bapp%5D=${encodeURIComponent(appId)}` +
    `&sort=-uploadedDate&limit=200&fields%5Bbuilds%5D=version`;
  const payload = await httpsGetJson(api, token);
  const max = maxBuildFromAscPayload(payload);
  log(`App Store Connect highest build for app ${appId}: ${max} (scanned ${payload?.data?.length ?? 0} builds).`);
  return max + 1;
}

function epochFallback() {
  const n = Math.floor(Date.now() / 1000);
  log(`Falling back to epoch seconds: ${n} (strictly monotonic, always higher than small historical numbers).`);
  return n;
}

async function maybeAsk(proposed, source) {
  if (!has('--ask') || !process.stdin.isTTY) return proposed; // CI: never block.
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((res) =>
    rl.question(
      `Next build number = ${proposed} (source: ${source}).\n` +
        `  • Enter to accept  • type a number to override  • 'n' to abort: `,
      res,
    ),
  );
  rl.close();
  const t = answer.trim();
  if (t === '') return proposed;
  if (/^n(o)?$/i.test(t)) {
    log('Aborted by user.');
    process.exit(1);
  }
  const override = parseInt(t, 10);
  if (Number.isFinite(override) && override > 0) return override;
  log(`Unrecognized input "${t}" — keeping ${proposed}.`);
  return proposed;
}

async function main() {
  let chosen = null;
  let source = null;

  try {
    const asc = await fromAppStoreConnect();
    if (asc != null) {
      chosen = asc;
      source = 'app-store-connect';
    }
  } catch (e) {
    log('App Store Connect lookup failed:', e.message);
  }

  if (chosen == null) {
    chosen = epochFallback();
    source = 'epoch';
  }

  chosen = await maybeAsk(chosen, source);

  chosen = parseInt(String(chosen), 10);
  if (!Number.isFinite(chosen) || chosen <= 0) chosen = Math.floor(Date.now() / 1000);

  log(`Resolved build number: ${chosen} (source: ${source}).`);
  process.stdout.write(`${chosen}\n`);
}

main().catch((e) => {
  // Never fail the build over resolution: emit a monotonic epoch and warn.
  log('Unexpected error, using epoch fallback:', e?.message || e);
  process.stdout.write(`${Math.floor(Date.now() / 1000)}\n`);
});
