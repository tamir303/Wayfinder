import { expect, test } from '@playwright/test';
import { pickAirport, signIn } from './helpers';

const openResults = async (page: import('@playwright/test').Page) => {
  await signIn(page);
  await pickAirport(page, 0, 'tel', 'Ben Gurion Airport, Tel Aviv-Yafo, TLV');
  await pickAirport(page, 1, 'paris', 'Charles de Gaulle Airport, Paris, CDG');
  await page.getByRole('button', { name: 'Search flights' }).click();
  await expect(page.getByText('Best flights')).toBeVisible();
};

test('the insights panel shows the level, typical range, a price history chart and when prices were fetched', async ({ page }) => {
  await openResults(page);
  const panel = page.getByLabel('Price insight');
  await expect(panel).toContainText('low');
  await expect(panel).toContainText('Typical price $180 to $260');
  await expect(panel.getByLabel(/^Price history, last 30 days: from \$\d+ to \$\d+$/)).toBeVisible();
  await expect(panel.getByText(/^Prices as of /)).toBeVisible();
});

test('filter by airline, combine with direct only, and clear it again', async ({ page }) => {
  await openResults(page);
  const cards = page.getByRole('button', { name: /\$\d/ });
  await expect(cards).toHaveCount(6);

  await page.getByRole('button', { name: 'Aegean', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Aegean');

  await page.getByRole('button', { name: 'Direct only' }).click(); // Aegean's flight has a stop
  await expect(cards).toHaveCount(0);
  await expect(page.getByText('No flights match these filters.')).toBeVisible();

  await page.getByRole('button', { name: 'Direct only' }).click();
  await page.getByRole('button', { name: 'Aegean', exact: true }).click();
  await expect(cards).toHaveCount(6);
});
