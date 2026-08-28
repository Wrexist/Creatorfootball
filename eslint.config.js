import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * The architectural rules of this repo are enforced here, not merely documented.
 *
 * The single most important one: `packages/engine` is pure TypeScript. It may
 * not import React, touch the DOM, read a global clock, or call Math.random.
 * Every guarantee the product makes — deterministic replays, headless balance
 * audits, a future server that arbitrates matches, testability — rests on that
 * boundary holding. A rule that is only written in a README is a rule that has
 * already been broken.
 */

const ENGINE_FORBIDDEN_IMPORTS = [
  { name: 'react', message: 'The engine must not depend on React. Move this to apps/game.' },
  { name: 'react-dom', message: 'The engine must not depend on React DOM.' },
  { name: 'motion', message: 'Animation belongs in the app layer, not the engine.' },
  { name: 'zustand', message: 'State containers belong in the app layer, not the engine.' },
  { name: '@capacitor/core', message: 'Platform APIs must sit behind an adapter in apps/game.' },
  { name: 'fs', message: 'The engine must not touch the filesystem. Use a StorageAdapter.' },
  { name: 'node:fs', message: 'The engine must not touch the filesystem. Use a StorageAdapter.' },
  { name: 'path', message: 'The engine must not depend on Node built-ins.' },
  { name: 'node:path', message: 'The engine must not depend on Node built-ins.' },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/dist-*/**', '**/node_modules/**', '**/coverage/**',
      '**/ios/**', '**/android/**', 'eslint.config.js',
      // Throwaway audit probes; see .gitignore.
      'tools/sim/src/zz*.ts', 'tools/sim/src/__*.ts', 'tools/sim/src/_audit/**',
      'tmp/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // --- the engine purity boundary ---
  {
    files: ['packages/engine/src/**/*.ts'],
    languageOptions: {
      globals: {}, // no DOM, no Node — referencing window/document is an undefined global
    },
    rules: {
      'no-restricted-imports': ['error', { paths: ENGINE_FORBIDDEN_IMPORTS }],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'The engine has no DOM. Pass what you need in as a parameter.' },
        { name: 'document', message: 'The engine has no DOM.' },
        { name: 'localStorage', message: 'Use the injected StorageAdapter.' },
        { name: 'navigator', message: 'The engine must not read platform state.' },
        { name: 'fetch', message: 'The engine must not perform network I/O.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Math.random() breaks determinism. Take an Rng parameter and use rng.raw()/rng.int()/rng.chance().',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            'Date.now() breaks reproducibility. Timestamps must arrive as a parameter.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'new Date() breaks reproducibility. Timestamps must arrive as a parameter.',
        },
      ],
    },
  },

  // Tests and the shared test fixtures may seed from a literal clock.
  {
    files: ['packages/engine/**/*.test.ts', 'packages/engine/test/**/*.ts', 'packages/engine/src/**/testing.ts'],
    rules: { 'no-restricted-syntax': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  // --- app layer ---
  {
    files: ['apps/game/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Game rules live in the engine. A component that computes a simulation
      // outcome is a component we cannot test headlessly.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Randomness in the UI desynchronises from the simulation. Derive it from a seed in the engine.',
        },
      ],
    },
  },

  // --- end-to-end scripts drive a real browser from Node ---
  // (store-shots drives the same browser harness to render App Store
  // screenshot drafts, so its page.evaluate callbacks see the DOM too.)
  {
    files: ['apps/game/e2e/**/*.mjs', 'tools/release/store-shots.mjs', 'tools/release/marketing/render.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      sourceType: 'module',
    },
    rules: { 'no-restricted-syntax': 'off', '@typescript-eslint/no-unused-vars': 'off' },
  },

  // --- headless tools may use Node ---
  {
    files: ['tools/**/*.ts', 'tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off' },
  },
);
