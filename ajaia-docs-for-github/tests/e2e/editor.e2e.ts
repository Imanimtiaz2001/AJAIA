/**
 * Browser end-to-end test of the main user journey against the real built UI.
 * Run with `npm run test:e2e` (needs a Chromium: `npx playwright install chromium`,
 * or set CHROME_PATH to an installed Chrome).
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { loadConfig } from '../../server/config';
import { openDatabase, type Database } from '../../server/db';

let server: Server;
let db: Database;
let browser: Browser;
let baseUrl: string;

beforeAll(async () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  db = await openDatabase(config);
  const app = createApp({ config, db, clientDir: 'dist/client', loginAttemptLimit: 1000 });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
});

afterAll(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
  await db?.close();
});

async function signIn(name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL(`${baseUrl}/`);
  return page;
}

describe('main user journey', () => {
  it('create → format → autosave → reload → share → collaborator sees and edits', async () => {
    const alice = await signIn('Alice Khan');

    await alice.getByRole('button', { name: 'New document' }).click();
    await alice.waitForSelector('.prose');
    await alice.keyboard.type('E2E plan'); // title is pre-selected on new documents
    await alice.locator('.prose').click();
    await alice.keyboard.press('Control+b');
    await alice.keyboard.type('Important');
    await alice.keyboard.press('Control+b');
    await alice.keyboard.type(' details');
    await expect.poll(() => alice.getByTestId('save-state').textContent()).toContain('All changes saved');

    // Reopen: title and bold formatting persisted.
    await alice.reload();
    await alice.waitForSelector('.prose strong');
    expect(await alice.getByLabel('Document title').inputValue()).toBe('E2E plan');
    expect(await alice.locator('.prose strong').textContent()).toBe('Important');

    // Share with Bob as an editor.
    await alice.getByRole('button', { name: 'Share' }).click();
    await alice.getByLabel('Email address').fill('bob@ajaia.test');
    await alice.locator('.share-form button[type="submit"]').click();
    await expect.poll(() => alice.locator('.person').count()).toBe(2);
    await alice.keyboard.press('Escape');

    // Bob finds it under "Shared with me" and edits it.
    const bob = await signIn('Bob Mirza');
    await bob.getByRole('button', { name: 'Shared with me' }).click();
    await bob.locator('.doc-row__main', { hasText: 'E2E plan' }).click();
    await bob.waitForSelector('.prose strong');
    await bob.locator('.prose').click();
    await bob.keyboard.press('Control+End');
    await bob.keyboard.type(' from Bob');
    await expect.poll(() => bob.getByTestId('save-state').textContent()).toContain('All changes saved');

    // Alice's open editor picks up Bob's change without a reload.
    await expect.poll(() => alice.locator('.prose').textContent(), { timeout: 15_000 }).toContain('from Bob');
  });

  it('opens a shared view-only document as read-only', async () => {
    const alice = await signIn('Alice Khan');
    await alice.locator('.doc-row__main', { hasText: 'Team Onboarding Checklist' }).click();
    await alice.waitForSelector('.prose');
    expect(await alice.locator('.prose').getAttribute('contenteditable')).toBe('false');
    expect(await alice.locator('.toolbar').count()).toBe(0);
    expect(await alice.getByText('You have view-only access').count()).toBe(1);
  });
});
