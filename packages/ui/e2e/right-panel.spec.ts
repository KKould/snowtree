import { test, expect } from './fixtures';
import { openFirstWorktree } from './app-helpers';

test.describe('Complete App - Sidebar + RightPanel', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstWorktree(page);
  });

  test('should load complete app with Sidebar and RightPanel', async ({ page }) => {
    await expect(page.locator('text=Workspaces')).toBeVisible();
    await expect(page.locator('[data-testid="main-layout"]')).toBeVisible();
  });

  test('should render without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      e.includes('Cannot read properties of undefined') ||
      e.includes('TypeError') ||
      e.includes('ReferenceError')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should display Changes panel', async ({ page }) => {
    const changesText = page.locator('text=/Tracked|Untracked|Changes/i').first();
    await expect(changesText).toBeVisible({ timeout: 5000 });
  });
});
