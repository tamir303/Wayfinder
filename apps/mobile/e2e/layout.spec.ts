import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('wide web layout', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('tabs become a left sidebar and the content stays readable', async ({ page }) => {
    await signIn(page);
    const tabs = await page.getByRole('tablist').boundingBox();
    expect(tabs).not.toBeNull();
    expect(tabs!.height).toBeGreaterThan(tabs!.width); // vertical sidebar
    const heading = await page.getByRole('heading', { name: 'Flights' }).boundingBox();
    expect(heading!.x).toBeGreaterThan(tabs!.x + tabs!.width - 1); // content sits beside it, not under it
    const field = await page.getByRole('textbox', { name: 'City or airport' }).first().boundingBox();
    expect(field!.width).toBeLessThanOrEqual(720); // content column is capped
  });
});

test.describe('phone web layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tabs stay at the bottom', async ({ page }) => {
    await signIn(page);
    const tabs = await page.getByRole('tablist').boundingBox();
    expect(tabs!.y).toBeGreaterThan(700);
    expect(tabs!.width).toBeGreaterThan(tabs!.height);
  });
});
