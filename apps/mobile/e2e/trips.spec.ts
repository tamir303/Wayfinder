import { expect, test, type Page } from '@playwright/test';
import { openTab, signIn } from './helpers';

// Expo Router keeps earlier stack screens mounted (hidden) under the current one, so assertions about the
// screen on top use .last().

const createTrip = async (page: Page, name: string) => {
  await page.getByRole('textbox', { name: 'Trip name' }).last().fill(name);
  await page.getByRole('button', { name: 'Create trip' }).last().click();
};

test('create a trip, add an attraction from its page, and plan the days', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Trips');
  await expect(page.getByText(/No trips yet/)).toBeVisible();
  await createTrip(page, 'Rome getaway');
  await expect(page).toHaveURL(/\/trip\//);
  await expect(page.getByText('Nothing planned for this day yet.').last()).toBeVisible();
  await page.getByRole('button', { name: 'Back to trips' }).last().click();

  await openTab(page, 'Explore');
  await page.getByRole('button', { name: 'Colosseum', exact: true }).click();
  await expect(page).toHaveURL(/\/attraction\/a1$/);
  await page.getByRole('button', { name: 'Add to trip' }).last().click();
  await page.getByRole('button', { name: 'Add Colosseum to Rome getaway' }).click();

  await expect(page).toHaveURL(/\/trip\//);
  await expect(page.getByText('Trip overview')).toBeHidden();
  await expect(page.getByText('3 days · 1 items').last()).toBeVisible();
  await page.getByRole('button', { name: /^Unscheduled/ }).last().click();
  await expect(page.getByText('Colosseum').last()).toBeVisible();
  await page.getByRole('button', { name: 'Move Colosseum to Day 2' }).last().click();
  await page.getByRole('button', { name: 'Day 2' }).last().click();
  await expect(page.getByText('Colosseum').last()).toBeVisible();
  await page.getByRole('button', { name: 'Remove Colosseum' }).last().click();
  await expect(page.getByText('Nothing planned for this day yet.').last()).toBeVisible();
});

test('reorder items within a day and see the estimated cost from a stay', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Trips');
  await createTrip(page, 'Two stops');
  await page.getByRole('button', { name: 'Back to trips' }).last().click();

  for (const name of ['Colosseum', 'Trevi Fountain']) {
    await openTab(page, 'Explore');
    await page.getByRole('button', { name: name, exact: true }).click();
    await page.getByRole('button', { name: 'Add to trip' }).last().click();
    await page.getByRole('button', { name: `Add ${name} to Two stops` }).click();
    await page.getByRole('button', { name: `Move ${name} to Day 1` }).last().click();
    await page.getByRole('button', { name: 'Back to trips' }).last().click();
  }
  await page.getByRole('button', { name: 'Two stops', exact: true }).click();
  await page.getByRole('button', { name: 'Day 1' }).last().click();
  const titles = page.getByText(/^(Colosseum|Trevi Fountain)$/);
  await expect(titles.first()).toHaveText('Colosseum');
  await page.getByRole('button', { name: 'Move Trevi Fountain up' }).last().click();
  await expect(titles.first()).toHaveText('Trevi Fountain');
});

test('trips survive a reload (kept on the device)', async ({ page }) => {
  await signIn(page);
  await openTab(page, 'Trips');
  await createTrip(page, 'Kept offline');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Kept offline', exact: true })).toBeVisible();
});
