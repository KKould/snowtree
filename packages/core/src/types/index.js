"use strict";
// Shared types between frontend and backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STRUCTURED_PROMPT_TEMPLATE = exports.DEFAULT_COMMIT_MODE_SETTINGS = void 0;
// Default commit mode settings
exports.DEFAULT_COMMIT_MODE_SETTINGS = {
    mode: 'checkpoint',
    checkpointPrefix: 'checkpoint: ',
};
// Default structured prompt template
exports.DEFAULT_STRUCTURED_PROMPT_TEMPLATE = `
After completing the requested changes, please create a git commit with an appropriate message. Follow these guidelines:
- Use Conventional Commits format (feat:, fix:, docs:, style:, refactor:, test:, chore:)
- Include a clear, concise description of the changes
- Only commit files that are directly related to this task
- If this project uses changesets and you've made a user-facing change, you may run 'pnpm changeset' if appropriate
`.trim();
//# sourceMappingURL=index.js.map