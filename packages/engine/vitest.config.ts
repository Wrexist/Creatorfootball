import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],

    /**
     * The balance suites run hundreds of full match simulations in tight
     * synchronous loops. Under the default worker pool that blocks the event
     * loop long enough to starve Vitest's own reporter RPC, which surfaces as
     * an "unhandled error" and fails the run even though every assertion
     * passed. Forked processes give each suite its own event loop, so a long
     * CPU-bound block can no longer starve the reporter.
     */
    pool: 'forks',
    poolOptions: { forks: { isolate: true } },

    /**
     * Run suites one at a time. The match simulator's aggregate-realism suite
     * alone runs thousands of full simulations and takes about a minute of
     * solid CPU; running it alongside the other suites saturates every core,
     * starves the reporter channel, and fails the run on an infrastructure
     * timeout while every assertion passes. Sequential execution costs about
     * thirty seconds of wall clock and buys a suite that means what it says.
     */
    fileParallelism: false,

    // Aggregate realism checks legitimately take tens of seconds; a tight
    // default timeout would push us toward testing fewer matches, which is
    // exactly the wrong trade for a simulation whose realism is the product.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
  },
});
