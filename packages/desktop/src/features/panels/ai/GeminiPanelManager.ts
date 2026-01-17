import { AbstractAIPanelManager, PanelMapping } from '../base/AbstractAIPanelManager';
import { GeminiExecutor } from '../../../executors/gemini';
import type { ExecutorSpawnOptions } from '../../../executors/types';
import type { Logger } from '../../../infrastructure/logging/logger';
import type { ConfigManager } from '../../../infrastructure/config/configManager';
import type { ConversationMessage } from '../../../infrastructure/database/models';
import { AIPanelConfig, StartPanelConfig, ContinuePanelConfig } from '@snowtree/core/types/aiPanelConfig';
import type { BaseAIPanelState } from '@snowtree/core/types/panels';

/**
 * Manager for Gemini CLI panels
 */
export class GeminiPanelManager extends AbstractAIPanelManager {
  constructor(
    executor: GeminiExecutor,
    sessionManager: import('../../session').SessionManager,
    logger?: Logger,
    configManager?: ConfigManager
  ) {
    super(executor, sessionManager, logger, configManager);
  }

  protected getAgentName(): string {
    return 'Gemini';
  }

  protected extractSpawnOptions(config: AIPanelConfig, _mapping: PanelMapping): Partial<ExecutorSpawnOptions> {
    return {
      model: config.model,
      planMode: config.planMode,
      approvalMode: config.approvalMode,
    };
  }

  async startPanel(
    panelId: string,
    worktreePath: string,
    prompt: string,
    model?: string,
    approvalMode?: 'default' | 'auto_edit' | 'yolo' | 'plan'
  ): Promise<void>;
  async startPanel(config: StartPanelConfig): Promise<void>;
  async startPanel(
    panelIdOrConfig: string | StartPanelConfig,
    worktreePath?: string,
    prompt?: string,
    model?: string,
    approvalMode?: 'default' | 'auto_edit' | 'yolo' | 'plan'
  ): Promise<void> {
    if (typeof panelIdOrConfig === 'string') {
      const config: StartPanelConfig = {
        panelId: panelIdOrConfig,
        worktreePath: worktreePath!,
        prompt: prompt!,
        model,
        approvalMode,
      };
      return super.startPanel(config);
    }
    return super.startPanel(panelIdOrConfig);
  }

  async continuePanel(panelId: string, worktreePath: string, prompt: string, conversationHistory: ConversationMessage[], model?: string): Promise<void>;
  async continuePanel(config: ContinuePanelConfig): Promise<void>;
  async continuePanel(
    panelIdOrConfig: string | ContinuePanelConfig,
    worktreePath?: string,
    prompt?: string,
    conversationHistory?: ConversationMessage[],
    model?: string
  ): Promise<void> {
    if (typeof panelIdOrConfig === 'string') {
      const config: ContinuePanelConfig = {
        panelId: panelIdOrConfig,
        worktreePath: worktreePath!,
        prompt: prompt!,
        conversationHistory: conversationHistory!,
        model,
      };
      return super.continuePanel(config);
    }
    return super.continuePanel(panelIdOrConfig);
  }

  getPanelState(panelId: string): BaseAIPanelState | undefined {
    return super.getPanelState(panelId);
  }
}
