import { test, expect } from './fixtures';
import { openFirstWorktree } from './app-helpers';

test.describe('Diff Panel and Stage Operations', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstWorktree(page);
  });

  test('should open diff overlay when clicking file', async ({ page }) => {
    const file = page.getByTestId('right-panel-file-tracked-src/components/Example.tsx');
    await expect(file).toBeVisible({ timeout: 15000 });
    await file.click();

    await expect(page.getByTestId('diff-overlay')).toBeVisible();
    await expect(page.getByTestId('diff-viewer-zed')).toBeVisible();
  });

  test('should close diff overlay with Back button', async ({ page }) => {
    const file = page.getByTestId('right-panel-file-tracked-src/components/Example.tsx');
    await expect(file).toBeVisible({ timeout: 15000 });
    await file.click();

    await expect(page.getByTestId('diff-overlay')).toBeVisible();
    await page.getByTestId('diff-overlay-back').click();
    await expect(page.getByTestId('diff-overlay')).toHaveCount(0);
  });
});
