import { expect, type Page } from '@playwright/test';

export const signIn = async (page: Page, email = 'tester@example.com') => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole('textbox', { name: 'you@example.com' }).fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByRole('textbox').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Flights' })).toBeVisible();
};

export const pickAirport = async (page: Page, field: 0 | 1, text: string, label: string) => {
  await page.getByRole('textbox', { name: 'City or airport' }).nth(field).fill(text);
  await page.getByRole('button', { name: label }).click();
};

export const openTab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(name) }).click();
