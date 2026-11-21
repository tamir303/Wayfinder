import { expect, test, type Page } from '@playwright/test';
import { openTab, signIn } from './helpers';

// Expo Router keeps earlier stack screens mounted (hidden) under the current one, so assertions about the
// screen on top use .last().

const searchRome = async (page: Page) => {
  await signIn(page);
  await openTab(page, 'Stays');
  await page.getByRole('textbox', { name: 'City, area or hotel' }).fill('rom');
  await page.getByRole('button', { name: 'Rome, Italy', exact: true }).click();
  await page.getByRole('button', { name: 'Search stays' }).click();
  await expect(page.getByRole('button', { name: /^Hotel Eden, / })).toBeVisible();
};

test('destination suggestions appear while typing and filling one enables the search', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Stays');
  await expect(page.getByRole('button', { name: 'Search stays' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'City, area or hotel' }).fill('rom');
  await expect(page.getByRole('button', { name: 'Rome, Italy', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roma Termini area, Rome, Italy' })).toBeVisible();
  await page.getByRole('button', { name: 'Rome, Italy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Search stays' })).toBeEnabled();
});

test('search, sort by price, and switch to the map to select a stay', async ({ page }) => {
  await searchRome(page);
  await expect(page.getByRole('button', { name: /per night$/ })).toHaveCount(5);

  await page.getByRole('button', { name: 'Cheapest' }).click();
  await expect(page.getByRole('button', { name: /per night$/ }).first()).toContainText('Urban Nest Hostel');

  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: /Map pin Harbour View Suites/ }).click();
  const panel = page.getByLabel('Selected stay Harbour View Suites');
  await expect(panel).toContainText('Wi-Fi · Pool · Gym · Breakfast');
  await expect(panel.getByRole('button', { name: 'View deal' })).toBeVisible();
});

test('save a stay, find it under Saved, and remove it', async ({ page }) => {
  await searchRome(page);
  await page.getByRole('button', { name: 'Save Hotel Eden' }).click();
  await expect(page.getByRole('button', { name: 'Remove Hotel Eden from saved' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hotel Eden', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Hotel Eden from saved' }).click();
  await expect(page.getByText('No saved stays yet.')).toBeVisible();
});

test('detail: providers cheapest first, reviews paged, price calendar changes the dates', async ({ page }) => {
  await searchRome(page);
  await page.getByRole('button', { name: /^Hotel Eden, / }).click();

  await expect(page).toHaveURL(/\/stays\/detail\?.*id=s1/);
  await expect(page.getByRole('heading', { name: 'Hotel Eden' }).last()).toBeVisible();
  await expect(page.getByText('Prices by provider').last()).toBeVisible();
  const deals = page.getByRole('button', { name: /^View deal · / });
  await expect(deals).toHaveCount(3);
  await expect(deals.first()).toHaveAccessibleName('View deal · Booking.com');

  await expect(page.getByText(/Dana · Google/)).toBeVisible();
  await expect(page.getByText(/Lior · Google/)).toBeHidden();
  await page.getByRole('button', { name: 'Show more reviews' }).click();
  await expect(page.getByText(/Lior · Google/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show more reviews' })).toBeHidden();

  await page.getByRole('button', { name: 'Price calendar' }).click();
  await expect(page).toHaveURL(/\/stays\/calendar\?/);
  const days = page.getByRole('button', { name: /^\d{4}-\d{2}-\d{2}, / });
  await expect(days).toHaveCount(31);
  // Ties for the lowest price are all highlighted, so take the first.
  const lowest = page.getByRole('button', { name: /, Lowest$/ }).first();
  await expect(lowest).toBeVisible();
  const picked = (await lowest.getAttribute('aria-label'))!.slice(0, 10);
  await lowest.click();
  await expect(page).toHaveURL(new RegExp(`/stays/detail\\?.*checkIn=${picked}`));
});
