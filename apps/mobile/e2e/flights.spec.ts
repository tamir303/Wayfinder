import { expect, test } from '@playwright/test';
import { pickAirport, signIn } from './helpers';

test('search TLV to CDG, open an offer, see the provider handoff and the no-payments note', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Search flights' })).toBeDisabled();

  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'paris', 'Charles de Gaulle Airport, Paris, CDG');
  await page.getByRole('button', { name: 'Business' }).click();
  await page.getByRole('button', { name: 'More passengers' }).click();
  await page.getByRole('button', { name: 'Search flights' }).click();

  await expect(page).toHaveURL(/\/flights\/results\?from=TLV&to=CDG.*adults=2.*cabin=business/);
  await expect(page.getByText('Best flights')).toBeVisible();
  await expect(page.getByLabel('Price insight')).toContainText('low');

  await page.getByRole('button', { name: /^El Al,.*\$\d/ }).click();
  await expect(page.getByText('El Al LY 325')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to provider' })).toBeVisible();
  await expect(page.getByText(/does not process payments/)).toBeVisible();
});

test('same origin and destination is rejected before searching', async ({ page }) => {
  await signIn(page);
  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await expect(page.getByText('Choose two different airports.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search flights' })).toBeDisabled();
});

test('airport suggest shows rate-limit and empty states from the mock', async ({ page }) => {
  await signIn(page);
  const from = page.getByRole('textbox', { name: 'City or airport' }).first();
  await from.fill('limit');
  await expect(page.getByText(/daily search limit/i)).toBeVisible();
  await from.fill('zzz');
  await expect(page.getByText('No airports found.')).toBeVisible();
});
