import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('signed-out users are sent to sign-in, a wrong code is rejected, a right code signs in and out', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByRole('textbox', { name: 'you@example.com' }).fill('tester@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByRole('textbox').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That code is invalid or expired.')).toBeVisible();

  await signIn(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('the dev build says it uses mock data', async ({ page }) => {
  await signIn(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await expect(page.getByText('Environment: dev (mock data)')).toBeVisible();
});
