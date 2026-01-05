"use strict";
/**
 * Centralized model configurations for OpenAI Codex
 * These models became available after GPT-5's release on August 7, 2025
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CODEX_MODEL = exports.CODEX_MODELS = void 0;
exports.getCodexModelConfig = getCodexModelConfig;
exports.getCodexModelList = getCodexModelList;
exports.CODEX_MODELS = {
    'auto': {
        id: 'auto',
        label: 'Auto',
        description: 'Let Codex choose the best model automatically'
    },
    'gpt-5': {
        id: 'gpt-5',
        label: 'GPT-5',
        description: 'Standard GPT-5 model for general use'
    },
    'gpt-5-codex': {
        id: 'gpt-5-codex',
        label: 'GPT-5 Codex',
        description: 'GPT-5 optimized for coding tasks'
    }
};
// Helper function to get model configuration
function getCodexModelConfig(model) {
    return exports.CODEX_MODELS[model];
}
// Helper to get the model list as an array
function getCodexModelList() {
    return Object.values(exports.CODEX_MODELS);
}
// Default model if none specified
exports.DEFAULT_CODEX_MODEL = 'gpt-5-codex';
//# sourceMappingURL=models.js.map