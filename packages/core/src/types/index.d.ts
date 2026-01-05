export type CommitMode = 'structured' | 'checkpoint' | 'disabled';
export interface CommitModeSettings {
    mode: CommitMode;
    structuredPromptTemplate?: string;
    checkpointPrefix?: string;
    allowClaudeTools?: boolean;
}
export interface ProjectCharacteristics {
    hasHusky: boolean;
    hasChangeset: boolean;
    hasConventionalCommits: boolean;
    suggestedMode: CommitMode;
}
export interface CommitResult {
    success: boolean;
    commitHash?: string;
    error?: string;
}
export interface FinalizeSessionOptions {
    squashCommits?: boolean;
    commitMessage?: string;
    runPostProcessing?: boolean;
    postProcessingCommands?: string[];
}
export declare const DEFAULT_COMMIT_MODE_SETTINGS: CommitModeSettings;
export declare const DEFAULT_STRUCTURED_PROMPT_TEMPLATE: string;
//# sourceMappingURL=index.d.ts.map