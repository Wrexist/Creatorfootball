/* global URL, console */
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const app = fileURLToPath(new URL('../', import.meta.url));
const manifest = resolve(app, 'ios/App/CapApp-SPM/Package.swift');
let source = await readFile(manifest, 'utf8');
for (const [name, packageName] of Object.entries({
  CapacitorHaptics: '@capacitor/haptics', CapacitorSplashScreen: '@capacitor/splash-screen',
  CapacitorStatusBar: '@capacitor/status-bar', CapacitorApp: '@capacitor/app',
  CapacitorFilesystem: '@capacitor/filesystem', CapacitorShare: '@capacitor/share',
  RevenuecatPurchasesCapacitor: '@revenuecat/purchases-capacitor',
})) {
  const directory = resolve(app, `node_modules/${packageName}`);
  await access(resolve(directory, 'Package.swift'));
  const portable = relative(dirname(manifest), directory).replaceAll('\\', '/');
  const pattern = new RegExp(`\\.package\\(name: "${name}", path: "[^"]*"\\)`);
  if (!pattern.test(source)) throw new Error(`Missing iOS package ${name}`);
  source = source.replace(pattern, `.package(name: "${name}", path: "${portable}")`);
}
if (/path: "[^"\n]*\\/.test(source)) throw new Error('A Windows-only Swift path remains.');
await writeFile(manifest, source);
console.log('Validated portable iOS plugin paths.');
