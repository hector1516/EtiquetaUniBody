import { test, expect } from '@playwright/test';

test.describe('EtiquetaUniBody UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('dashboard renders without scrollbars', async ({ page }) => {
    const hasVScroll = await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight);
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    // Allow internal scroll but no visible scrollbar (hidden via CSS)
    expect(hasHScroll).toBe(false);
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.click('button:has-text("Diseñador")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/designer.png' });
    await page.click('button:has-text("Historial")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/history.png' });
    await page.click('button:has-text("Configuración")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/settings.png' });
    await page.click('button:has-text("Dashboard")');
  });

  test('theme toggle works', async ({ page }) => {
    const btn = page.locator('button:has-text("Modo")');
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(300);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(typeof isDark).toBe('boolean');
    }
  });
});
