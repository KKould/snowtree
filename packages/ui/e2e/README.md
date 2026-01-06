# E2E Test Suite

Total: **116 tests** across **13 test files**

## Test Architecture

Snowtree uses a **hybrid testing strategy**:

1. **Browser E2E Tests** (main suite) - Fast feedback for UI components
2. **Electron Smoke Tests** (verification) - Validate Electron API integration

## Running Tests

### Browser Mode (Default - Recommended for Development)

```bash
pnpm test:e2e
```

**Status**: ~35 passing, ~80 skipping
- Fast execution (~25s)
- Tests UI components without Electron dependency
- Tests skip gracefully when repository not configured
- Ideal for CI/CD and rapid development feedback

**Why tests skip**: Browser tests cannot access Electron APIs (`electronAPI`). This is expected and by design.

### Electron Mode (Integration Verification)

```bash
pnpm test:e2e:electron
```

**Status**: 2-3 passing smoke tests
- Runs in headless mode (no visible windows)
- Verifies Electron API (`electronAPI`) is accessible
- Validates database integration
- Confirms full Electron app launches correctly

**Purpose**: Smoke testing to ensure Electron-specific features work, not comprehensive E2E coverage.

### Legacy: Full Test Run (Browser Mode with Manual Setup)

The E2E tests automatically create a test git repository at `.e2e-test-repo` and add it to the database. However, since tests run in browser mode (not Electron), they cannot access the Electron API to load repositories from the database.

**To run all 116 tests**:

1. Ensure the Electron app is running with the test repository loaded:
   ```bash
   # From project root
   pnpm dev
   ```

2. Manually add the E2E test repository through the UI:
   - Click "Add Repository" in the Workspaces panel
   - Select `/Users/bohu/github/datafuselabs/snowtree/packages/ui/.e2e-test-repo`
   - Or the test repo will be auto-created and added to DB when running tests

3. With the app running and repository loaded, run tests:
   ```bash
   cd packages/ui
   pnpm test:e2e
   ```

**Expected result**: All 116 tests should run (not skip)

## Architecture Limitation

Snowtree is an Electron application that relies on `electronAPI` (Electron IPC) to communicate between the main process (Node.js with database access) and renderer process (UI).

Playwright browser tests run in a standard Chromium browser without Electron APIs, so they cannot:
- Load projects from the database
- Create sessions
- Access file system through Electron APIs
- Perform git operations through the backend

This is why 84 tests skip - they require a session/worktree which can only be created through Electron APIs.

## Test Coverage

### 1. Core Application Flow (conversation.spec.ts - 9 tests)
- Conversation panel display
- Input field functionality
- Send button and Enter key
- Tool selector
- Session header and branch display

### 2. Right Panel (right-panel.spec.ts - 3 tests)
- App loading with Sidebar and RightPanel
- Console error detection
- Changes panel visibility

### 3. Diff Panel Operations (diff-panel.spec.ts - 4 tests)
- File click to open diff
- Back button to close diff
- Staged/Unstaged group display
- Group expand/collapse

### 4. Selection and Staging (stage-operations.spec.ts - 3 tests)
- Gutter click selects a line
- +/- stages a line
- +/- on hunk header stages a block

### 5. Commit and PR Operations (commit-and-pr.spec.ts - 8 tests)
- Commit button display and enable state
- Commit review overlay
- Push/PR button functionality
- Diff display in review
- Cancel commit review
- Commit and PR workflows

### 6. Timeline and Events (timeline.spec.ts - 8 tests)
- Timeline area display
- Event rendering
- Scrolling
- Timestamps
- Event types (user/assistant/system)
- Code blocks
- Copy functionality
- Auto-scroll to latest

### 7. Panel Resize (panel-resize.spec.ts - 7 tests)
- Resize handle display
- Cursor change on hover
- Drag to resize
- Min/max width constraints
- Persist width on reload
- Visual feedback during resize

### 8. Stage Operations (stage-operations.spec.ts - 10 tests)
- Unstaged/Staged file display
- File status icons
- Add/remove line counts
- Stage/unstage in visual mode
- Color coding for add/delete lines
- Line highlighting
- Untracked files section
- Group expand/collapse

### 9. Messaging (messaging.spec.ts - 11 tests)
- Input field presence
- Typing functionality
- Send button
- Enter key to send
- Shift+Enter for new line
- Cancel button during processing
- Clear input after send
- Focus with keyboard shortcut (i)
- Tool selector dropdown
- Switch between tools

### 10. Loading and Errors (loading-and-errors.spec.ts - 12 tests)
- Initial page load indicator
- Workspace header after load
- Loading when switching worktrees
- Processing indicator during send
- Console error detection
- Missing repository handling
- Error message display
- Dismiss error messages
- Retry option on failure
- Network error handling
- Rapid interaction stability

### 11. Session Lifecycle (session-lifecycle.spec.ts - 12 tests)
- Sessions list in sidebar
- Create session on worktree click
- Session name in header
- Switch between sessions
- Active session indicator
- Session metadata display
- Session status
- Persist session on reload
- Repository path display
- Delete option for sessions
- Confirm before delete

### 13. Theme and Appearance (theme.spec.ts - 12 tests)
- Default theme on load
- Theme toggle button
- Switch to dark theme
- Switch to light theme
- Persist theme on reload
- Apply theme to all components
- System theme option
- Code syntax highlighting with theme
- Contrast ratios in both themes
- Theme on modals and overlays
- Accent colors consistency
- CSS variables for theming

## Test Structure

All tests follow these patterns:

1. **Graceful degradation**: Tests skip when prerequisites not met (no repos, no files, etc.)
2. **No Chinese text**: All test names and logs in English only
3. **Minimal comments**: Self-documenting test names
4. **Robust selectors**: Use multiple selector strategies (text, class, role, data-testid)
5. **Proper waits**: Use waitForTimeout and expect with timeout
6. **Error handling**: Catch and handle failures gracefully

## Prerequisites

Tests require at least one repository/worktree configured in the app.

If tests skip with "No repositories found":
1. Start the app: `pnpm dev` (from project root)
2. Add a git repository through the UI
3. Run tests again

## CI Integration

Tests are integrated in `.github/workflows/ui-tests.yml` and run automatically on:
- Push to main/dev branches
- Pull requests to main/dev
- Changes to packages/ui/**

## Notes

- Tests run in browser mode (not Electron) in CI
- Some tests may skip in CI due to missing Electron APIs
- Local development with Electron app provides full test coverage
