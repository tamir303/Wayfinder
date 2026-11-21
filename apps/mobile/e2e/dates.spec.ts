import { expect, test } from '@playwright/test';
import { openTab, signIn } from './helpers';

// A fixed clock makes "today" deterministic: today = 2027-01-15, so the default departure is 2027-02-14.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-15T10:00:00Z'));
});

test('flights: days before today are disabled', async ({ page }) => {
  await signIn(page);
  await page.getByTestId('flight-date').click();
  await expect(page.getByTestId('flight-date')).toHaveText('2027-02-14');
  await page.getByTestId('flight-date-prev').click(); // January
  await expect(page.getByTestId('flight-date-day-2027-01-14')).toBeDisabled();
  await expect(page.getByTestId('flight-date-day-2027-01-15')).toBeEnabled();
});

test('flights: a later departure pushes the return date out, and the return picker starts after the departure', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Round trip' }).click();
  await expect(page.getByTestId('flight-return')).toHaveText('2027-02-21');

  await page.getByTestId('flight-date').click();
  await page.getByTestId('flight-date-day-2027-02-25').click();
  await expect(page.getByTestId('flight-date')).toHaveText('2027-02-25');
  await expect(page.getByTestId('flight-return')).toHaveText('2027-03-04');

  await page.getByTestId('flight-return').click(); // opens on March, the month of the return date
  await page.getByTestId('flight-return-prev').click(); // back to February
  await expect(page.getByTestId('flight-return-day-2027-02-25')).toBeDisabled(); // not before or on the departure
  await expect(page.getByTestId('flight-return-day-2027-02-26')).toBeEnabled();
});

test('stays: a later check-in moves the check-out, and stays are limited to 30 nights', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Stays');
  await expect(page.getByTestId('stay-checkin')).toHaveText('2027-02-14');
  await expect(page.getByTestId('stay-checkout')).toHaveText('2027-02-18');

  await page.getByTestId('stay-checkout').click();
  await page.getByTestId('stay-checkout-next').click(); // March
  await expect(page.getByTestId('stay-checkout-day-2027-03-16')).toBeEnabled(); // 30 nights
  await expect(page.getByTestId('stay-checkout-day-2027-03-17')).toBeDisabled(); // 31 nights
  await page.getByTestId('stay-checkout-day-2027-03-16').click();
  await expect(page.getByTestId('stay-checkout')).toHaveText('2027-03-16');

  await page.getByTestId('stay-checkin').click();
  await page.getByTestId('stay-checkin-next').click(); // March
  await page.getByTestId('stay-checkin-day-2027-03-20').click(); // after the current check-out
  await expect(page.getByTestId('stay-checkin')).toHaveText('2027-03-20');
  await expect(page.getByTestId('stay-checkout')).toHaveText('2027-03-24'); // reset to a 4-night stay
});

test('a picked date drives the search', async ({ page }) => {
  await signIn(page);
  await page.getByTestId('flight-date').click();
  await page.getByTestId('flight-date-day-2027-02-20').click();
  await page.getByRole('textbox', { name: 'City or airport' }).first().fill('tel');
  await page.getByRole('button', { name: 'Ben Gurion Airport, Tel Aviv-Yafo, TLV' }).click();
  await page.getByRole('textbox', { name: 'City or airport' }).nth(1).fill('paris');
  await page.getByRole('button', { name: 'Charles de Gaulle Airport, Paris, CDG' }).click();
  await page.getByRole('button', { name: 'Search flights' }).click();
  await expect(page).toHaveURL(/date=2027-02-20/);
});
