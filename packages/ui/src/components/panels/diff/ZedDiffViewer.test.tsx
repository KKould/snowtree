import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ZedDiffViewer } from './ZedDiffViewer';
import { API } from '../../../utils/api';

vi.mock('../../../utils/api', () => ({
  API: {
    sessions: {
      stageHunk: vi.fn(),
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

describe('ZedDiffViewer', () => {
  it('renders viewer', () => {
    render(<ZedDiffViewer diff={SAMPLE_DIFF_TWO_HUNKS} />);
    expect(screen.getByTestId('diff-viewer-zed')).toBeInTheDocument();
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
    fireEvent.click(stage);

    expect(API.sessions.stageHunk).toHaveBeenCalledWith('s1', expect.objectContaining({ isStaging: true }));
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
    fireEvent.click(stage);

    expect(API.sessions.stageHunk).toHaveBeenCalledWith('s1', expect.objectContaining({ isStaging: false }));
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
    fireEvent.click(restore);

    expect(API.sessions.restoreHunk).toHaveBeenCalledWith('s1', expect.objectContaining({ scope: 'unstaged' }));
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
});
