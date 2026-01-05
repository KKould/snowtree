"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIPanelConfigFactory = void 0;
/**
 * Factory for creating default configurations
 */
class AIPanelConfigFactory {
    static createClaudeConfig(worktreePath, prompt, model, permissionMode) {
        return {
            worktreePath,
            prompt,
            model,
            permissionMode
        };
    }
    static createCodexConfig(worktreePath, prompt, options) {
        return {
            worktreePath,
            prompt,
            ...options
        };
    }
}
exports.AIPanelConfigFactory = AIPanelConfigFactory;
//# sourceMappingURL=aiPanelConfig.js.map