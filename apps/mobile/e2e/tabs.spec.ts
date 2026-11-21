import { expect, test } from '@playwright/test';
import { openTab, signIn } from './helpers';

test('explore: category chips filter the attractions', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Explore');
  await expect(page.getByLabel('Colosseum')).toBeVisible();
  await page.getByRole('button', { name: 'Museum' }).click();
  await expect(page.getByLabel('Vatican Museums')).toBeVisible();
  await expect(page.getByLabel('Colosseum')).toBeHidden();
});

test('profile shows the account and the daily search meter', async ({ page }) => {
  await signIn(page, 'someone@example.com');
  await openTab(page, 'Profile');
  await expect(page.getByLabel('Account email')).toHaveText('someone@example.com');
  await expect(page.getByText('12 of 200 used today')).toBeVisible();
});

test('unknown routes show the not-found page', async ({ page }) => {
  await signIn(page);
  await page.goto('/definitely-not-a-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
