import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The submission rules that are checked by Apple rather than by us.
 *
 * Everything here fails at *upload* — after the build, after the signing,
 * after the metadata, at the last step before review — and every one of them is
 * invisible in a screenshot and in a diff. They are cheap to assert and
 * expensive to discover.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '..', '..', '..');
const ios = path.join(gameRoot, 'ios/App/App');
const xcassets = path.join(ios, 'Assets.xcassets');

/** PNG colour types that carry per-pixel alpha. */
const ALPHA_TYPES = new Set([4, 6]);

interface Png {
  readonly width: number;
  readonly height: number;
  readonly colourType: number;
  readonly hasAlpha: boolean;
}

/** Read a PNG's header and chunk list. No decoder needed for either question. */
function readPng(file: string): Png {
  const data = readFileSync(file);
  expect(data.subarray(0, 8).toString('hex'), `${file} is not a PNG`)
    .toBe('89504e470d0a1a0a');

  const colourType = data[25] ?? 0;
  // `tRNS` gives an indexed or truecolour image transparency without an alpha
  // channel, so the colour type alone does not answer the question.
  let offset = 8;
  let transparency = false;
  while (offset < data.length - 8) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'tRNS') transparency = true;
    if (type === 'IEND') break;
    offset += 12 + length;
  }

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colourType,
    hasAlpha: ALPHA_TYPES.has(colourType) || transparency,
  };
}

describe('the iOS app icon', () => {
  const file = path.join(xcassets, 'AppIcon.appiconset/AppIcon-512@2x.png');

  it('exists where the asset catalogue says it does', () => {
    const contents = JSON.parse(
      readFileSync(path.join(xcassets, 'AppIcon.appiconset/Contents.json'), 'utf8'),
    ) as { images: { filename?: string; size?: string }[] };

    for (const image of contents.images) {
      if (!image.filename) continue;
      expect(
        existsSync(path.join(xcassets, 'AppIcon.appiconset', image.filename)),
        `the catalogue lists ${image.filename}, which is not there`,
      ).toBe(true);
    }
  });

  it('carries no alpha channel, which is an automatic rejection', () => {
    // The trap: `canvas.toDataURL('image/png')` always emits RGBA, whether or
    // not anything in the image is transparent. Every icon this project has
    // ever generated in a browser would fail this, which is why the generator
    // writes this one file's bytes itself.
    expect(readPng(file).hasAlpha).toBe(false);
  });

  it('is a truecolour PNG at 1024 square', () => {
    const png = readPng(file);
    expect(png.width).toBe(1024);
    expect(png.height).toBe(1024);
    // Colour type 2: truecolour, no alpha. Indexed would also satisfy Apple,
    // but this is the format the documentation asks for and this is not the
    // file to be clever on.
    expect(png.colourType).toBe(2);
  });
});

describe('the iOS launch image', () => {
  const dir = path.join(xcassets, 'Splash.imageset');

  it('ships every file the imageset lists, at the size it claims', () => {
    const contents = JSON.parse(readFileSync(path.join(dir, 'Contents.json'), 'utf8')) as {
      images: { filename?: string; scale?: string }[];
    };
    expect(contents.images.length).toBeGreaterThan(0);
    for (const image of contents.images) {
      expect(image.filename, 'an imageset entry has no file').toBeDefined();
      const file = path.join(dir, image.filename ?? '');
      expect(existsSync(file), `the imageset lists ${image.filename}, which is not there`).toBe(true);
      const png = readPng(file);
      expect(png.width).toBe(2732);
      expect(png.height).toBe(2732);
    }
  });
});

describe('Info.plist', () => {
  const plist = readFileSync(path.join(ios, 'Info.plist'), 'utf8');

  it('answers the export-compliance question in advance', () => {
    // Without this key App Store Connect asks about encryption on every single
    // upload, and a build sits unprocessed until somebody answers it by hand.
    expect(plist).toContain('<key>ITSAppUsesNonExemptEncryption</key>');
  });

  it('declares the orientations the layouts were actually built for', () => {
    // Every screen is measured at phone widths in portrait. Offering landscape
    // on iPhone would letterbox all of them, and reviewers do rotate.
    const phone = /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist);
    expect(phone?.[1]).toContain('UIInterfaceOrientationPortrait');
    expect(phone?.[1]).not.toContain('LandscapeLeft');
  });

  it('gives the home screen a name that is the store name, shortened', () => {
    // These two are *supposed* to differ. The store name is written for search
    // and gets 30 characters; the home-screen name gets about a dozen before
    // iOS truncates it, so "Creator Football: Club Manager" would arrive on the
    // device as "Creator Foo…". What must not differ is the product: a display
    // name that is not the start of the listed name means one of the two was
    // edited and the other forgotten.
    const listed = readFileSync(
      path.join(gameRoot, 'fastlane/metadata/en-US/name.txt'), 'utf8',
    ).trim();
    const display = /<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/.exec(plist)?.[1]?.trim();

    expect(display, 'Info.plist has no CFBundleDisplayName').toBeTruthy();
    expect(
      listed.startsWith(display ?? ''),
      `the home screen says "${display}" and the store says "${listed}"`,
    ).toBe(true);
    expect(display?.length ?? 0).toBeLessThanOrEqual(listed.length);
  });
});
