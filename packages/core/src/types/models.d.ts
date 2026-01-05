/**
 * Centralized model configurations for OpenAI Codex
 * These models became available after GPT-5's release on August 7, 2025
 */
export type OpenAICodexModel = 'auto' | 'gpt-5' | 'gpt-5-codex';
export interface CodexModelConfig {
    id: OpenAICodexModel;
    label: string;
    description: string;
}
export declare const CODEX_MODELS: Record<OpenAICodexModel, CodexModelConfig>;
export declare function getCodexModelConfig(model: string): CodexModelConfig | undefined;
export declare function getCodexModelList(): CodexModelConfig[];
export declare const DEFAULT_CODEX_MODEL: OpenAICodexModel;
export interface CodexInputOptions {
    model: OpenAICodexModel;
    modelProvider: 'openai';
    sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access';
    webSearch: boolean;
    attachedImages?: Array<{
        id: string;
        name: string;
        dataUrl: string;
        size: number;
        type: string;
    }>;
    attachedTexts?: Array<{
        id: string;
        name: string;
        content: string;
        size: number;
    }>;
    [key: string]: unknown;
}
//# sourceMappingURL=models.d.ts.map