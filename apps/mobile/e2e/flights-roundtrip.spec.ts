import { expect, test } from '@playwright/test';
import { pickAirport, signIn } from './helpers';

// Expo Router keeps earlier stack screens mounted (hidden) under the current one, so assertions about the
// screen on top use .last().

const searchTlvCdg = async (page: import('@playwright/test').Page, roundTrip: boolean) => {
  await signIn(page);
  if (roundTrip) await page.getByRole('button', { name: 'Round trip' }).click();
  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'paris', 'Charles de Gaulle Airport, Paris, CDG');
};

test('round trip: choose an outbound, then a return flight, then continue to the provider', async ({ page }) => {
  await searchTlvCdg(page, true);
  await page.getByRole('button', { name: 'Search flights' }).click();

  await expect(page).toHaveURL(/\/flights\/results\?.*returnDate=/);
  await expect(page.getByText('Choose your outbound flight')).toBeVisible();
  await expect(page.getByText('round trip total').first()).toBeVisible();
  await page.getByRole('button', { name: /^El Al/ }).click();

  await expect(page).toHaveURL(/\/flights\/return\?.*token=rt-0/);
  await expect(page.getByText('Choose your return flight')).toBeVisible();
  await expect(page.getByRole('heading', { name: /CDG .* TLV/ })).toBeVisible();
  await page.getByRole('button', { name: /^El Al/ }).click();

  await expect(page).toHaveURL(/\/flights\/detail\?.*token=rt-0/);
  await expect(page.getByText('round trip total').last()).toBeVisible();
  await expect(page.getByText('CDG → TLV').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to provider' }).last()).toBeVisible();
});

test('round trip: a return date that is not after the departure is rejected', async ({ page }) => {
  await searchTlvCdg(page, true);
  await page.getByRole('textbox').nth(3).fill('2001-01-01');
  await expect(page.getByText('Choose a return date after the departure date.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search flights' })).toBeDisabled();
});

test('results can be sorted by price and filtered to direct flights', async ({ page }) => {
  await searchTlvCdg(page, false);
  await page.getByRole('button', { name: 'Search flights' }).click();
  await expect(page.getByText('Best flights')).toBeVisible();
  await expect(page.getByRole('button', { name: /\$\d/ })).toHaveCount(6);

  await page.getByRole('button', { name: 'Cheapest' }).click();
  await expect(page.getByRole('button', { name: /\$\d/ }).first()).toContainText('Turkish Airlines');
  await expect(page.getByText('Best flights')).toBeHidden();

  await page.getByRole('button', { name: 'Direct only' }).click();
  await expect(page.getByRole('button', { name: /\$\d/ })).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Aegean/ })).toBeHidden();
  await expect(page.getByRole('button', { name: /\$\d/ }).first()).toContainText('Wizz Air');
});

test('flexible dates: show a price per day, highlight the lowest, and search the chosen day', async ({ page }) => {
  await searchTlvCdg(page, false);
  await page.getByRole('button', { name: 'Search flights' }).click();
  await page.getByRole('button', { name: 'Flexible dates' }).click();

  await expect(page).toHaveURL(/\/flights\/calendar\?/);
  await expect(page.getByText('One-way prices per day. Tap a day to search it.')).toBeVisible();
  const days = page.getByRole('button', { name: /^\d{4}-\d{2}-\d{2}, \$/ });
  await expect(days).toHaveCount(31);
  await expect(page.getByRole('button', { name: /, Lowest$/ })).toHaveCount(1);

  const lowest = page.getByRole('button', { name: /, Lowest$/ });
  const label = (await lowest.getAttribute('aria-label'))!;
  const picked = label.slice(0, 10);
  await lowest.click();
  await expect(page).toHaveURL(new RegExp(`/flights/results\\?.*date=${picked}`));
  await expect(page.getByText('Best flights').last()).toBeVisible();
});
