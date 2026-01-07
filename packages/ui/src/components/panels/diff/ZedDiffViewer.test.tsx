import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ZedDiffViewer } from './ZedDiffViewer';
import { API } from '../../../utils/api';

vi.mock('../../../utils/api', () => ({
  API: {
    sessions: {
      stageHunk: vi.fn(),
      changeFileStage: vi.fn(),
      restoreHunk: vi.fn(),
    },
  },
}));

const SAMPLE_DIFF_TWO_HUNKS = `diff --git a/test.txt b/test.txt
index 1234567..abcdefg 100644
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 context
-old
+new
 end
@@ -10,2 +11,3 @@
 a
+b
 c`;

const SAMPLE_DIFF_TWO_FILES = `diff --git a/b.txt b/b.txt
index 1234567..abcdefg 100644
--- a/b.txt
+++ b/b.txt
@@ -1,1 +1,1 @@
-x
+y
diff --git a/a.txt b/a.txt
index 1234567..abcdefg 100644
--- a/a.txt
+++ b/a.txt
@@ -1,1 +1,1 @@
-x
+y`;

describe('ZedDiffViewer', () => {
  it('renders viewer', () => {
    render(<ZedDiffViewer diff={SAMPLE_DIFF_TWO_HUNKS} />);
    expect(screen.getByTestId('diff-viewer-zed')).toBeInTheDocument();
  });

  it('expands modified files to full file when fileSources is provided', () => {
    const diff = `diff --git a/a.txt b/a.txt
index 1234567..abcdefg 100644
--- a/a.txt
+++ b/a.txt
@@ -2,1 +2,1 @@
-old
+new`;

    const { container } = render(<ZedDiffViewer diff={diff} fileSources={{ 'a.txt': 'one\nold\nthree' }} />);
    // one (context) + old (delete) + new (insert) + three (context)
    expect(container.querySelectorAll('tr.diff-line')).toHaveLength(4);
  });

  it('does not duplicate content when expanding a new file diff', () => {
    const diff = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..abcdefg
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+first
+second`;

    const { container } = render(<ZedDiffViewer diff={diff} fileSources={{ 'new.txt': 'first\nsecond' }} />);
    expect(container.querySelectorAll('tr.diff-line')).toHaveLength(2);
  });

  it('stages a hunk when scope is unstaged', async () => {
    (API.sessions.stageHunk as any).mockResolvedValue({ success: true, data: { success: true } });
    render(
      <ZedDiffViewer
        diff={SAMPLE_DIFF_TWO_HUNKS}
        sessionId="s1"
        currentScope="unstaged"
        unstagedDiff={SAMPLE_DIFF_TWO_HUNKS}
      />
    );

    const stage = screen.getAllByTestId('diff-hunk-stage')[0] as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(stage);
    });

    await waitFor(() => {
      expect(API.sessions.stageHunk).toHaveBeenCalledWith('s1', expect.objectContaining({ isStaging: true }));
    });
  });

  it('unstages a hunk when scope is staged', async () => {
    (API.sessions.stageHunk as any).mockResolvedValue({ success: true, data: { success: true } });
    render(
      <ZedDiffViewer
        diff={SAMPLE_DIFF_TWO_HUNKS}
        sessionId="s1"
        currentScope="staged"
        stagedDiff={SAMPLE_DIFF_TWO_HUNKS}
      />
    );

    const stage = screen.getAllByTestId('diff-hunk-stage')[0] as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(stage);
    });

    await waitFor(() => {
      expect(API.sessions.stageHunk).toHaveBeenCalledWith('s1', expect.objectContaining({ isStaging: false }));
    });
  });

  it('restores a hunk using the current scope', async () => {
    (API.sessions.restoreHunk as any).mockResolvedValue({ success: true, data: { success: true } });
    render(
      <ZedDiffViewer
        diff={SAMPLE_DIFF_TWO_HUNKS}
        sessionId="s1"
        currentScope="unstaged"
        unstagedDiff={SAMPLE_DIFF_TWO_HUNKS}
      />
    );

    const restore = screen.getAllByTestId('diff-hunk-restore')[0] as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(restore);
    });

    await waitFor(() => {
      expect(API.sessions.restoreHunk).toHaveBeenCalledWith('s1', expect.objectContaining({ scope: 'unstaged' }));
    });
  });

  it('stages an untracked file (file-level stage)', async () => {
    (API.sessions.changeFileStage as any).mockResolvedValue({ success: true });
    const diff = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..abcdefg
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,1 @@
+hello`;

    render(<ZedDiffViewer diff={diff} sessionId="s1" currentScope="untracked" />);

    const stage = screen.getAllByTestId('diff-hunk-stage')[0] as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(stage);
    });
    await waitFor(() => {
      expect(API.sessions.changeFileStage).toHaveBeenCalledWith('s1', { filePath: 'new.txt', stage: true });
    });
  });

  it('scrolls to a file header when scrollToFilePath changes', () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const { rerender } = render(<ZedDiffViewer diff={SAMPLE_DIFF_TWO_HUNKS} />);

    rerender(<ZedDiffViewer diff={SAMPLE_DIFF_TWO_HUNKS} scrollToFilePath="test.txt" />);
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it('renders per-line widget anchors for hunk controls', () => {
    const { container } = render(
      <ZedDiffViewer
        diff={SAMPLE_DIFF_TWO_HUNKS}
        sessionId="s1"
        currentScope="unstaged"
        unstagedDiff={SAMPLE_DIFF_TWO_HUNKS}
      />
    );
    const widgets = container.querySelectorAll('tr.diff-widget');
    expect(widgets.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('diff-hunk-controls').length).toBeGreaterThan(0);
  });

  it('renders one control group per hunk', () => {
    render(
      <ZedDiffViewer
        diff={SAMPLE_DIFF_TWO_HUNKS}
        sessionId="s1"
        currentScope="unstaged"
        unstagedDiff={SAMPLE_DIFF_TWO_HUNKS}
      />
    );
    expect(screen.getAllByTestId('diff-hunk-controls')).toHaveLength(2);
  });

  it('orders files based on fileOrder when provided', () => {
    render(<ZedDiffViewer diff={SAMPLE_DIFF_TWO_FILES} fileOrder={['a.txt', 'b.txt']} />);
    const headers = screen.getAllByTestId('diff-file-header').map((el) => el.textContent);
    expect(headers[0]).toBe('a.txt');
    expect(headers[1]).toBe('b.txt');
  });

  it('renders a persistent frame style for staged hunks', () => {
    const { container } = render(
      <ZedDiffViewer
        diff={SAMPLE_DIFF_TWO_HUNKS}
        sessionId="s1"
        currentScope="staged"
        stagedDiff={SAMPLE_DIFF_TWO_HUNKS}
      />
    );
    const css = container.querySelector('style')?.textContent || '';
    expect(css).toContain('st-hunk-status--staged');
    expect(css).toContain('Zed-like: staged_hollow -> staged has border');
  });
});
