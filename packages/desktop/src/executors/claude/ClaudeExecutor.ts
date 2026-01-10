/**
 * ClaudeExecutor - Claude Code CLI executor
 * Handles spawning and communicating with Claude Code CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

import { AbstractExecutor } from '../base/AbstractExecutor';
import type {
  ExecutorTool,
  ExecutorSpawnOptions,
  ExecutorAvailability,
  ExecutorOutputEvent,
  ClaudeMessage,
} from '../types';
import type { Logger } from '../../infrastructure/logging/logger';
import type { ConfigManager } from '../../infrastructure/config/configManager';
import type { SessionManager } from '../../features/session/SessionManager';
import { findExecutableInPath } from '../../infrastructure/command/shellPath';
import { ClaudeMessageParser } from './ClaudeMessageParser';
import { cliLogger } from '../../infrastructure/logging/cliLogger';

const execAsync = promisify(exec);

interface ClaudeSpawnOptions extends ExecutorSpawnOptions {
  systemPrompt?: string;
  permissionMode?: string;
}

/**
 * Claude Code CLI Executor
 */
export class ClaudeExecutor extends AbstractExecutor {
  private messageParser: ClaudeMessageParser;

  constructor(
    sessionManager: SessionManager,
    logger?: Logger,
    configManager?: ConfigManager
  ) {
    super(sessionManager, logger, configManager);
    this.messageParser = new ClaudeMessageParser();
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  getToolType(): ExecutorTool {
    return 'claude';
  }

  getToolName(): string {
    return 'Claude Code';
  }

  getCommandName(): string {
    return 'claude';
  }

  getCustomExecutablePath(): string | undefined {
    return this.configManager?.getConfig()?.claudeExecutablePath;
  }

  async testAvailability(customPath?: string): Promise<ExecutorAvailability> {
    try {
      const commandName = this.getCommandName();
      const resolved = customPath || (await findExecutableInPath(commandName)) || commandName;

      // Test with --version
      const command = resolved.includes(' ') ? `"${resolved}"` : resolved;
      const env = await this.getSystemEnvironment();
      const { stdout } = await execAsync(`${command} --version`, {
        timeout: 10000,
        env,
      });

      const version = stdout.trim();
      return {
        available: true,
        version,
        path: resolved,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        available: false,
        error: errorMessage,
      };
    }
  }

  buildCommandArgs(options: ExecutorSpawnOptions): string[] {
    const { prompt, isResume, agentSessionId } = options as ClaudeSpawnOptions;

    const args: string[] = [
      '--verbose',
      '--output-format', 'stream-json',
      '--include-partial-messages',
    ];

    const permissionMode = typeof options.permissionMode === 'string'
      ? options.permissionMode
      : 'bypassPermissions';
    args.push('--permission-mode', permissionMode);

    if (typeof options.model === 'string' && options.model.trim()) {
      args.push('--model', options.model.trim());
    }

    // Resume or new session
    if (isResume && agentSessionId) {
      args.push('--resume', agentSessionId);
    }

    // Add prompt
    if (prompt) {
      args.push('-p', prompt);
    }

    return args;
  }

  async initializeEnvironment(options: ExecutorSpawnOptions): Promise<Record<string, string>> {
    const { worktreePath, sessionId } = options;
    const claudeOptions = options as ClaudeSpawnOptions;
    const env: Record<string, string> = {};

    // Set working directory
    env.PWD = worktreePath;

    // Add system prompt if provided
    if (claudeOptions.systemPrompt) {
      env.CLAUDE_SYSTEM_PROMPT = claudeOptions.systemPrompt;
    }

    // Add API key from config if available
    const apiKey = this.configManager?.getAnthropicApiKey();
    if (apiKey) {
      env.ANTHROPIC_API_KEY = apiKey;
    }

    // Disable color output for cleaner parsing
    env.NO_COLOR = '1';
    env.FORCE_COLOR = '0';

    return env;
  }

  async cleanupResources(sessionId: string): Promise<void> {
    // Claude doesn't need specific cleanup
    this.logger?.verbose(`Cleaning up Claude resources for session ${sessionId}`);
  }

  parseOutput(data: string, panelId: string, sessionId: string): void {
    const trimmed = data.trim();
    if (!trimmed) return;

    try {
      // Try to parse as JSON
      const message = JSON.parse(trimmed) as ClaudeMessage;

      // Extract session ID if available - emit for panel manager to handle
      if ('session_id' in message && message.session_id) {
        this.emit('agentSessionId', {
          panelId,
          sessionId,
          agentSessionId: message.session_id,
        });
      }

      // Emit raw JSON output
      this.emit('output', {
        panelId,
        sessionId,
        type: 'json',
        data: message,
        timestamp: new Date(),
      } as ExecutorOutputEvent);

      // Parse and emit normalized entry
      const entry = this.messageParser.parseMessage(message);
      if (entry) {
        this.handleNormalizedEntry(panelId, sessionId, entry);
      }

      // Align session status semantics with Codex/Claude Code: per-turn completion
      // should transition the session out of "running" even if the process stays alive.
      if (message.type === 'result') {
        if (message.is_error) {
          this.sessionManager.updateSessionStatus(sessionId, 'error', message.error || 'Claude error');
        } else {
          this.sessionManager.updateSessionStatus(sessionId, 'waiting');
        }
      }
    } catch {
      // Not JSON, emit as stdout
      this.emit('output', {
        panelId,
        sessionId,
        type: 'stdout',
        data: trimmed,
        timestamp: new Date(),
      } as ExecutorOutputEvent);
    }
  }

  // ============================================================================
  // Claude-specific Methods
  // ============================================================================

  /**
   * Resume an existing Claude conversation
   */
  async resume(options: ExecutorSpawnOptions): Promise<void> {
    return this.spawn({
      ...options,
      isResume: true,
    });
  }

  /**
   * Send a follow-up message to an existing conversation
   */
  async sendFollowUp(panelId: string, message: string): Promise<void> {
    const process = this.processes.get(panelId);
    if (!process) {
      throw new Error(`No Claude process found for panel ${panelId}`);
    }

    // Send message via stdin
    process.pty.write(message + '\n');
  }

  /**
   * Interrupt current operation (Ctrl+C)
   */
  interrupt(panelId: string): void {
    const process = this.processes.get(panelId);
    if (!process) return;

    // Send Ctrl+C
    process.pty.write('\x03');
    cliLogger.info('Claude', panelId, 'Sent interrupt signal');
  }
}

export default ClaudeExecutor;
