import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* One retry locally to soak up Firefox-on-Playwright click hangs late in
     the suite (the browser process grows unstable after ~20 tests; opening
     a fresh context on retry clears it). CI keeps a higher cap. */
  retries: process.env.CI ? 2 : 1,
  /* Run tests one at a time. Concurrent Firefox/WebKit tabs against this app
     intermittently hang at `locator.click()` (the stability check passes but
     the click never lands) — observed on Firefox 150 with Playwright 1.60.
     We've tried capping workers at 2 and switching to the preview server;
     neither eliminates the hang. Serializing is the only reliable fix.
     Override at the CLI (`--workers N`) when you accept the flake risk. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Only on CI systems run the tests headless */
    headless: !!process.env.CI,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    /* Firefox disabled — Playwright's Firefox build is too unstable against
       this app right now (intermittent hangs at locator.click() late in the
       suite, even with workers: 1 and the preview server). Re-enable when the
       upstream stability issue is resolved. */
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //   },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: {
    //     channel: 'msedge',
    //   },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: {
    //     channel: 'chrome',
    //   },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  // outputDir: 'test-results/',

  /* Run a production-built preview server for tests. The Vite dev server's HMR
     channel races concurrent Firefox tabs and intermittently hangs
     `locator.click()` at the stability check; serving the built bundle avoids
     that class of flakiness entirely. For a faster local loop, run
     `npm run build && npm run preview` in a separate terminal — Playwright
     will reuse the existing server. */
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
})
