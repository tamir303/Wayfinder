import { expect, test } from '@playwright/test';
import { pickAirport, signIn } from './helpers';

test('save a one-way search from the results, reuse it from the form, and delete it', async ({ page }) => {
  await signIn(page);
  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'paris', 'Charles de Gaulle Airport, Paris, CDG');
  await page.getByRole('button', { name: 'Search flights' }).click();

  await expect(page.getByRole('button', { name: 'Save this search' })).toBeVisible();
  await page.getByRole('button', { name: 'Save this search' }).click();
  await expect(page.getByRole('button', { name: 'Remove from saved searches' })).toBeVisible();

  await page.getByRole('button', { name: 'Change search' }).click();
  const saved = page.getByRole('button', { name: /^Saved searches: TLV CDG / }).last();
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(page.getByRole('textbox', { name: 'City or airport' }).first()).toHaveValue('TLV (TLV)');
  await expect(page.getByRole('button', { name: 'Search flights' })).toBeEnabled();

  await page.getByRole('button', { name: 'Delete saved search TLV CDG' }).last().click();
  await expect(page.getByRole('button', { name: /^Saved searches: TLV CDG / })).toHaveCount(0);
});

test('round trips cannot be saved', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Round trip' }).click();
  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'paris', 'Charles de Gaulle Airport, Paris, CDG');
  await page.getByRole('button', { name: 'Search flights' }).click();
  await expect(page.getByText('Choose your outbound flight')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save this search' })).toHaveCount(0);
});
