import { expect, test } from '@playwright/test';

// Runs only in the he-IL project (see playwright.config.ts).
test('Hebrew locale: RTL document, translated UI and a mirrored route arrow', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');

  await page.getByRole('textbox', { name: 'you@example.com' }).fill('tester@example.com');
  await page.getByRole('button', { name: 'שלחו לי קוד באימייל' }).click();
  await expect(page.getByText('הזינו את הקוד בן 6 הספרות שנשלח אל tester@example.com.')).toBeVisible();
  await page.getByRole('textbox').fill('000000');
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByText('הקוד שגוי או שפג תוקפו.')).toBeVisible();
  await page.getByRole('textbox').fill('123456');
  await page.getByRole('button', { name: 'התחברות' }).click();

  await expect(page.getByRole('heading', { name: 'טיסות' })).toBeVisible();
  for (const tab of ['טיסות', 'לינה', 'גלו', 'טיולים', 'פרופיל']) {
    await expect(page.getByRole('tab', { name: new RegExp(tab) })).toBeVisible();
  }

  await page.getByRole('textbox', { name: 'עיר או שדה תעופה' }).first().fill('tel');
  await page.getByRole('button', { name: 'Ben Gurion Airport, Tel Aviv-Yafo, TLV' }).click();
  await page.getByRole('textbox', { name: 'עיר או שדה תעופה' }).nth(1).fill('paris');
  await page.getByRole('button', { name: 'Charles de Gaulle Airport, Paris, CDG' }).click();
  await page.getByRole('button', { name: 'חיפוש טיסות' }).click();

  await expect(page.getByRole('heading', { name: 'TLV ← CDG' })).toBeVisible();
  await expect(page.getByText('הטיסות הטובות ביותר')).toBeVisible();
  await expect(page.getByLabel('תובנת מחיר')).toContainText('נמוכים');
  await page.screenshot({ path: testInfo.outputPath('results-he.png') });
});

test('Hebrew locale: plural forms and the API error message are translated', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'you@example.com' }).fill('tester@example.com');
  await page.getByRole('button', { name: 'שלחו לי קוד באימייל' }).click();
  await page.getByRole('textbox').fill('123456');
  await page.getByRole('button', { name: 'התחברות' }).click();
  await page.getByRole('textbox', { name: 'עיר או שדה תעופה' }).first().fill('limit');
  await expect(page.getByText('הגעתם למגבלת החיפושים היומית. נסו שוב מחר.')).toBeVisible();
  await expect(page.getByLabel('נוסע 1')).toBeVisible();
  await page.getByRole('button', { name: 'עוד נוסעים' }).click();
  await expect(page.getByLabel('2 נוסעים')).toBeVisible();
});
