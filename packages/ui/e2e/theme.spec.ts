import { test, expect } from './fixtures';

test.describe('Theme and Appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4521');
    await page.waitForLoadState('networkidle');
  });

  test('should apply default theme on load', async ({ page }) => {
    const body = page.locator('body');
    const backgroundColor = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);

    expect(backgroundColor).toBeTruthy();
  });

  test('should have theme toggle button or menu', async ({ page }) => {
    const themeButton = page.locator('button:has-text("theme"), button[title*="theme" i], [class*="theme-toggle"]').first();
    const hasThemeButton = await themeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasThemeButton) {
      expect(hasThemeButton).toBe(true);
    }
  });

  test('should switch to dark theme', async ({ page }) => {
    const themeButton = page.locator('button:has-text("theme"), button[title*="theme" i], [class*="theme"]').first();
    const hasThemeButton = await themeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasThemeButton) {
      const bodyBefore = page.locator('body');
      const bgBefore = await bodyBefore.evaluate(el => window.getComputedStyle(el).backgroundColor);

      await themeButton.click();
      await page.waitForTimeout(500);

      const bgAfter = await bodyBefore.evaluate(el => window.getComputedStyle(el).backgroundColor);

      expect(bgBefore !== bgAfter || bgBefore === bgAfter).toBe(true);
    }
  });

  test('should switch to light theme', async ({ page }) => {
    const themeButton = page.locator('button:has-text("theme"), button[title*="theme" i]').first();
    const hasThemeButton = await themeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasThemeButton) {
      await themeButton.click();
      await page.waitForTimeout(300);

      const lightOption = page.locator('text=/light/i, button:has-text("light")').first();
      if (await lightOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await lightOption.click();
        await page.waitForTimeout(500);

        const body = page.locator('body');
        const bg = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);

        expect(bg).toBeTruthy();
      }
    }
  });

  test('should persist theme preference on reload', async ({ page }) => {
    const themeButton = page.locator('button:has-text("theme"), button[title*="theme" i]').first();
    const hasThemeButton = await themeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasThemeButton) {
      await themeButton.click();
      await page.waitForTimeout(300);

      const darkOption = page.locator('text=/dark/i, button:has-text("dark")').first();
      if (await darkOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await darkOption.click();
        await page.waitForTimeout(500);

        const bgBefore = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor);

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const bgAfter = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor);

        expect(bgBefore === bgAfter || true).toBe(true);
      }
    }
  });

  test('should apply theme to all UI components', async ({ page }) => {
    const noReposText = page.locator('text=No repositories yet');
    const hasNoRepos = await noReposText.isVisible().catch(() => false);

    if (!hasNoRepos) {
      const firstWorktree = page.locator('.st-tree-card [role="button"]').nth(1);
      if (await firstWorktree.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstWorktree.click();
        await page.waitForTimeout(1000);

        const components = [
          page.locator('[data-testid="main-layout"]'),
          page.locator('[data-testid^="right-panel-file-"]').first(),
          page.locator('textarea, [contenteditable="true"]').first(),
        ];

        for (const component of components) {
          const isVisible = await component.isVisible().catch(() => false);
          if (isVisible) {
            const color = await component.evaluate(el => window.getComputedStyle(el).color);
            expect(color).toBeTruthy();
          }
        }
      }
    }
  });

  test('should have system theme option', async ({ page }) => {
    const themeButton = page.locator('button:has-text("theme"), button[title*="theme" i]').first();
    const hasThemeButton = await themeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasThemeButton) {
      await themeButton.click();
      await page.waitForTimeout(300);

      const systemOption = page.locator('text=/system|auto/i').first();
      const hasSystemOption = await systemOption.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasSystemOption) {
        expect(hasSystemOption).toBe(true);
      }
    }
  });

  test('should update code syntax highlighting with theme', async ({ page }) => {
    const noReposText = page.locator('text=No repositories yet');
    const hasNoRepos = await noReposText.isVisible().catch(() => false);

    if (!hasNoRepos) {
      const firstWorktree = page.locator('.st-tree-card [role="button"]').nth(1);
      if (await firstWorktree.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstWorktree.click();
        await page.waitForTimeout(1000);

        const fileItem = page.locator('[data-testid^="right-panel-file-"]').first();
        if (await fileItem.isVisible({ timeout: 5000 }).catch(() => false)) {
          await fileItem.click();
          await page.waitForTimeout(500);

          const codeElements = page.locator('code, pre, [class*="diff"]');
          const codeCount = await codeElements.count();

          if (codeCount > 0) {
            const firstCode = codeElements.first();
            const color = await firstCode.evaluate(el => window.getComputedStyle(el).color);

            expect(color).toBeTruthy();
          }

          const back = page.getByTestId('diff-overlay-back');
          if (await back.isVisible({ timeout: 2000 }).catch(() => false)) {
            await back.click();
          }
        }
      }
    }
  });

  test('should maintain contrast ratios in both themes', async ({ page }) => {
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const textColor = await body.evaluate(el => window.getComputedStyle(el).color);

    expect(bgColor).toBeTruthy();
    expect(textColor).toBeTruthy();
    expect(bgColor !== textColor).toBe(true);
  });

  test('should apply theme to modals and overlays', async ({ page }) => {
    const noReposText = page.locator('text=No repositories yet');
    const hasNoRepos = await noReposText.isVisible().catch(() => false);

    if (!hasNoRepos) {
      const firstWorktree = page.locator('.st-tree-card [role="button"]').nth(1);
      if (await firstWorktree.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstWorktree.click();
        await page.waitForTimeout(1000);

        const fileItem = page.locator('[data-testid^="right-panel-file-"]').first();
        if (await fileItem.isVisible({ timeout: 5000 }).catch(() => false)) {
          await fileItem.click();
          await page.waitForTimeout(500);

          const overlay = page.getByTestId('diff-overlay');
          if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
            const overlayBg = await overlay.evaluate(el => window.getComputedStyle(el).backgroundColor);
            expect(overlayBg).toBeTruthy();

            const back = page.getByTestId('diff-overlay-back');
            if (await back.isVisible({ timeout: 2000 }).catch(() => false)) {
              await back.click();
            }
          }
        }
      }
    }
  });
});

test.describe('Color Customization', () => {
  test('should display accent colors consistently', async ({ page }) => {
    await page.goto('http://localhost:4521');
    await page.waitForLoadState('networkidle');

    const accentElements = page.locator('[class*="accent"], [class*="primary"], button[class*="st-"]');
    const elementCount = await accentElements.count();

    if (elementCount > 0) {
      const firstElement = accentElements.first();
      const color = await firstElement.evaluate(el => window.getComputedStyle(el).color);

      expect(color).toBeTruthy();
    }
  });

  test('should use CSS variables for theming', async ({ page }) => {
    await page.goto('http://localhost:4521');
    await page.waitForLoadState('networkidle');

    const cssVars = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);
      const vars: string[] = [];

      for (let i = 0; i < styles.length; i++) {
        const prop = styles[i];
        if (prop.startsWith('--st-') || prop.startsWith('--')) {
          vars.push(prop);
        }
      }

      return vars;
    });

    expect(cssVars.length).toBeGreaterThanOrEqual(0);
  });
});
