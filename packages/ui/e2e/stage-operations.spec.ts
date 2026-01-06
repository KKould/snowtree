import { test, expect } from './fixtures';
import { openFirstWorktree } from './app-helpers';

test.describe('Stage Operations (Diff Overlay)', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstWorktree(page);
  });

  test('stages a hunk via per-hunk controls (Zed-style)', async ({ page }) => {
    const file = page.getByTestId('right-panel-file-tracked-src/components/Example.tsx');
    await expect(file).toBeVisible({ timeout: 15000 });
    await file.click();

    await expect(page.getByTestId('diff-overlay')).toBeVisible();
    await expect(page.getByTestId('diff-viewer-zed')).toBeVisible();

    const firstEditHunk = page
      .locator(`[data-diff-file-path="src/components/Example.tsx"] .diff-hunk`)
      .filter({ has: page.locator('.diff-code-insert, .diff-code-delete') })
      .first();
    await firstEditHunk.hover();
    const stage = firstEditHunk.getByTestId('diff-hunk-stage');
    await expect(stage).toBeVisible();
    await stage.click();

    const lastCall = await page.evaluate(() => (window as any).__e2e_lastStageHunk);
    expect(lastCall?.options?.filePath).toBe('src/components/Example.tsx');

    await page.getByTestId('diff-overlay-back').click();
    await expect(page.getByTestId('diff-overlay')).toHaveCount(0);
  });

  test('restores a hunk via per-hunk controls (Zed-style)', async ({ page }) => {
    const file = page.getByTestId('right-panel-file-tracked-src/components/Example.tsx');
    await expect(file).toBeVisible({ timeout: 15000 });
    await file.click();

    await expect(page.getByTestId('diff-overlay')).toBeVisible();
    await expect(page.getByTestId('diff-viewer-zed')).toBeVisible();

    const firstEditHunk = page
      .locator(`[data-diff-file-path="src/components/Example.tsx"] .diff-hunk`)
      .filter({ has: page.locator('.diff-code-insert, .diff-code-delete') })
      .first();
    await firstEditHunk.hover();
    const restore = firstEditHunk.getByTestId('diff-hunk-restore');
    await expect(restore).toBeVisible();
    await restore.click();

    const lastCall = await page.evaluate(() => (window as any).__e2e_lastRestoreHunk);
    expect(lastCall?.options?.filePath).toBe('src/components/Example.tsx');

    await page.getByTestId('diff-overlay-back').click();
    await expect(page.getByTestId('diff-overlay')).toHaveCount(0);
  });
});
