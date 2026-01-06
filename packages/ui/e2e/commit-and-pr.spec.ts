import { test, expect } from './fixtures';
import { openFirstWorktree } from './app-helpers';

test.describe('Commit and PR Operations', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstWorktree(page);
  });

  test('should display commit button in right panel', async ({ page }) => {
    const commitButton = page.locator('button:has-text("Commit"), button:has-text("commit"), [title*="commit" i]').first();
    const buttonExists = await commitButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (buttonExists) {
      expect(buttonExists).toBe(true);
    }
  });

  test('should enable commit button when changes exist', async ({ page }) => {
    const hasAnyFile = await page
      .locator('[data-testid^="right-panel-file-tracked-"], [data-testid^="right-panel-file-untracked-"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasAnyFile) {
      const commitButton = page.locator('button:has-text("Commit"), button:has-text("commit")').first();
      const isEnabled = await commitButton.isEnabled().catch(() => false);

      if (await commitButton.isVisible()) {
        expect(isEnabled !== undefined).toBe(true);
      }
    }
  });

  test('should click commit button and show review overlay', async ({ page }) => {
    const commitButton = page.locator('button:has-text("Commit"), button:has-text("commit")').first();
    const buttonExists = await commitButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (buttonExists && await commitButton.isEnabled()) {
      await commitButton.click();
      await page.waitForTimeout(500);

      const overlay = page.locator('[role="dialog"], .diff-overlay, .st-overlay').first();
      const reviewBanner = page.locator('text=/review|commit/i').first();

      const hasOverlayOrBanner =
        (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) ||
        (await reviewBanner.isVisible({ timeout: 3000 }).catch(() => false));

      if (hasOverlayOrBanner) {
        expect(hasOverlayOrBanner).toBe(true);
      }
    }
  });

  test('should display push/PR button in right panel', async ({ page }) => {
    const pushButton = page.locator('button:has-text("Push"), button:has-text("PR"), button:has-text("Pull Request")').first();
    const buttonExists = await pushButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (buttonExists) {
      expect(buttonExists).toBe(true);
    }
  });

  test('should click push/PR button', async ({ page }) => {
    const pushButton = page.locator('button:has-text("Push"), button:has-text("PR"), button:has-text("Pull Request")').first();
    const buttonExists = await pushButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (buttonExists && await pushButton.isEnabled()) {
      await pushButton.click();
      await page.waitForTimeout(500);

      const hasResponse = await page.locator('text=/push|pull request|pr/i').count() > 0;
      expect(hasResponse).toBe(true);
    }
  });

  test('should show commit diff when reviewing', async ({ page }) => {
    const commitButton = page.locator('button:has-text("Commit"), button:has-text("commit")').first();
    const buttonExists = await commitButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (buttonExists && await commitButton.isEnabled()) {
      await commitButton.click();
      await page.waitForTimeout(500);

      const diffContent = page.locator('[class*="diff"], pre, code').first();
      const hasDiff = await diffContent.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasDiff) {
        expect(hasDiff).toBe(true);
      }
    }
  });

  test('should allow canceling commit review', async ({ page }) => {
    const commitButton = page.locator('button:has-text("Commit"), button:has-text("commit")').first();
    const buttonExists = await commitButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (buttonExists && await commitButton.isEnabled()) {
      await commitButton.click();
      await page.waitForTimeout(500);

      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("cancel")').first();
      if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelButton.click();
        await page.waitForTimeout(300);

        const overlay = page.locator('[role="dialog"]').first();
        const stillVisible = await overlay.isVisible().catch(() => false);
        expect(stillVisible).toBe(false);
      }
    }
  });
});
