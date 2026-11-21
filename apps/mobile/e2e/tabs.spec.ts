import { expect, test } from '@playwright/test';
import { openTab, signIn } from './helpers';

test('stays: selecting a map pin opens the stay panel with a deal button', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Stays');
  await page.getByRole('button', { name: /Map pin Harbour View Suites/ }).click();
  const panel = page.getByLabel('Selected stay Harbour View Suites');
  await expect(panel).toContainText('Wi-Fi · Pool · Gym · Breakfast');
  await expect(panel.getByRole('button', { name: 'View deal' })).toBeVisible();
});

test('explore: category chips filter the attractions', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Explore');
  await expect(page.getByLabel('Colosseum')).toBeVisible();
  await page.getByRole('button', { name: 'Museum' }).click();
  await expect(page.getByLabel('Vatican Museums')).toBeVisible();
  await expect(page.getByLabel('Colosseum')).toBeHidden();
});

test('trips: open the itinerary, switch days, see an empty day', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Trips');
  await page.getByRole('button', { name: 'Rome getaway, 12 Dec - 15 Dec' }).click();
  await expect(page).toHaveURL(/\/trip\/t1$/);
  await expect(page.getByText('Colosseum').first()).toBeVisible();
  await page.getByRole('button', { name: 'Day 2' }).click();
  await expect(page.getByText('Trastevere Food Tour').last()).toBeVisible();
  await page.getByRole('button', { name: 'Day 3' }).click();
  await expect(page.getByText('Nothing planned for this day yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to trips' }).click();
  await expect(page).toHaveURL(/\/trips$/);
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
