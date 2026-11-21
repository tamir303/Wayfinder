import { expect, test } from '@playwright/test';
import { pickAirport, signIn } from './helpers';

test('swap exchanges the two airports', async ({ page }) => {
  await signIn(page);
  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'paris', 'Charles de Gaulle Airport, Paris, CDG');
  await page.getByRole('button', { name: 'Swap airports' }).click();
  await expect(page.getByRole('textbox', { name: 'City or airport' }).first()).toHaveValue('Paris (CDG)');
  await expect(page.getByRole('textbox', { name: 'City or airport' }).nth(1)).toHaveValue('Tel Aviv-Yafo (TLV)');
});

test('a search is remembered: recent airports and a recent search that refills the form', async ({ page }) => {
  await signIn(page);
  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'paris', 'Charles de Gaulle Airport, Paris, CDG');
  await page.getByRole('button', { name: 'More passengers' }).click();
  await page.getByRole('button', { name: 'Business' }).click();
  await page.getByRole('button', { name: 'Search flights' }).click();
  await expect(page).toHaveURL(/\/flights\/results/);

  await page.getByRole('button', { name: 'Change search' }).click();
  await expect(page.getByRole('heading', { name: 'Flights' }).last()).toBeVisible();
  // Fresh fields offer the airports used before.
  await expect(page.getByRole('button', { name: /^TLV CDG \d{4}-\d{2}-\d{2}$/ }).last()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent searches' }).last()).toBeVisible();

  // Reload the page: it survives (stored on the device), but the mock session does not, so sign in again.
  await page.reload();
  await signIn(page);
  await expect(page.getByRole('button', { name: /^TLV CDG \d{4}-\d{2}-\d{2}$/ })).toBeVisible();
  await page.getByRole('button', { name: /^TLV CDG \d{4}-\d{2}-\d{2}$/ }).click();
  await expect(page.getByRole('textbox', { name: 'City or airport' }).first()).toHaveValue('Tel Aviv-Yafo (TLV)');
  await expect(page.getByRole('textbox', { name: 'City or airport' }).nth(1)).toHaveValue('Paris (CDG)');
  await expect(page.getByLabel('2 passengers')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Business' })).toHaveClass(/bg-brand/); // the selected chip
  await expect(page.getByRole('button', { name: 'Search flights' })).toBeEnabled();
});
