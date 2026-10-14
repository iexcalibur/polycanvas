import { test } from '@polycanvas-test/kit/electron';
import { importImage } from '@polycanvas-test/kit/utils/image';
import { pasteByKeyboard } from '@polycanvas-test/kit/utils/keyboard';
import {
  clickNewPageButton,
  getBlockSuiteEditorTitle,
} from '@polycanvas-test/kit/utils/page-logic';
import { expect } from '@playwright/test';

test('should be able to insert SVG images', async ({ page }) => {
  await page.waitForTimeout(500);
  await clickNewPageButton(page);
  const title = getBlockSuiteEditorTitle(page);
  await title.focus();
  await page.keyboard.press('Enter');

  await importImage(page, 'polymind.svg');

  const svg = page.locator('polymind-image').first();
  await expect(svg).toBeVisible();
});

test('should paste it as PNG after copying SVG', async ({ page }) => {
  await page.waitForTimeout(500);
  await clickNewPageButton(page);
  const title = getBlockSuiteEditorTitle(page);
  await title.focus();
  await page.keyboard.press('Enter');

  await importImage(page, 'polymind.svg');

  const svg = page.locator('polymind-image').first();
  await expect(svg).toBeVisible();

  await svg.hover();

  await page.waitForTimeout(500);
  const toolbar = page.locator('polymind-toolbar-widget editor-toolbar');
  await expect(toolbar).toBeVisible();

  const moreMenu = toolbar.getByLabel('More menu');
  await moreMenu.click();

  await moreMenu.getByRole('button', { name: /^Copy$/ }).click();

  await svg.click();

  await page.keyboard.press('Enter');
  await pasteByKeyboard(page);

  const png = page.locator('polymind-image').nth(1);
  await expect(png).toBeVisible();
});
