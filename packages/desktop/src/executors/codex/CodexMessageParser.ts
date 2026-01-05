/**
 * CodexMessageParser - Parse Codex JSON-RPC notifications into normalized entries
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedEntry,
  ActionType,
} from '../types';

interface CodexEventParams {
  conversation_id?: string;
  message?: CodexMessage;
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  result?: unknown;
  is_error?: boolean;
  reasoning?: string;
  [key: string]: unknown;
}

interface CodexMessage {
  role?: string;
  content?: string | CodexContentItem[];
}

interface CodexContentItem {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Parses Codex event notifications into normalized entries for UI display
 */
export class CodexMessageParser {
  private assistantDeltaByPanel = new Map<string, { id: string; text: string }>();
  private reasoningDeltaByPanel = new Map<string, { id: string; text: string }>();
  private assistantDeltaByItem = new Map<string, { id: string; text: string }>();
  private reasoningDeltaByItem = new Map<string, { id: string; text: string }>();

  /**
   * Parse a Codex app-server v2 JSON-RPC notification (preferred).
   */
  parseV2Notification(method: string, params: unknown, panelId?: string): NormalizedEntry | null {
    const timestamp = new Date().toISOString();

    switch (method) {
      case 'thread/started':
        return {
          id: uuidv4(),
          timestamp,
          entryType: 'system_message',
          content: 'Thread started',
          metadata: params as Record<string, unknown>,
        };

      case 'turn/started':
        return {
          id: uuidv4(),
          timestamp,
          entryType: 'system_message',
          content: 'Turn started',
          metadata: params as Record<string, unknown>,
        };

      case 'turn/completed':
        return {
          id: uuidv4(),
          timestamp,
          entryType: 'system_message',
          content: 'Turn completed',
          metadata: params as Record<string, unknown>,
        };

      case 'turn/plan/updated':
        return this.parseTurnPlanUpdated(params, timestamp);

      case 'item/agentMessage/delta':
        return this.parseV2AgentMessageDelta(params, timestamp, panelId);

      case 'item/reasoning/textDelta':
      case 'item/reasoning/summaryTextDelta':
        return this.parseV2ReasoningDelta(params, timestamp);

      case 'item/started':
        return this.parseV2ItemStarted(params, timestamp);

      case 'item/completed':
        return this.parseV2ItemCompleted(params, timestamp);

      // We intentionally do not surface output deltas in the timeline (audit focuses on commands/actions).
      case 'item/commandExecution/outputDelta':
      case 'item/fileChange/outputDelta':
      case 'item/mcpToolCall/progress':
      case 'turn/diff/updated':
      case 'thread/tokenUsage/updated':
      case 'thread/compacted':
        return null;

      case 'error':
        return this.parseV2Error(params, timestamp);

      default:
        return null;
    }
  }

  /**
   * Parse a Codex notification into a normalized entry
   */
  parseNotification(eventType: string, params: unknown, panelId?: string): NormalizedEntry | null {
    const timestamp = new Date().toISOString();
    const p = params as CodexEventParams;

    switch (eventType) {
      case 'session_configured':
        return this.parseSessionConfigured(p, timestamp);

      case 'user_message':
        return this.parseUserMessage(p, timestamp);

      // New Codex protocol uses `agent_message` / `agent_message_delta`
      case 'agent_message':
      case 'assistant_message':
        return this.parseAssistantMessage(p, timestamp);

      case 'agent_message_delta':
        return this.parseAssistantDelta(p, timestamp, panelId);

      case 'agent_reasoning':
      case 'reasoning':
        return this.parseReasoning(p, timestamp);

      case 'agent_reasoning_delta':
        return this.parseReasoningDelta(p, timestamp, panelId);

      // Command execution lifecycle
      case 'exec_command_begin':
        return this.parseExecCommandBegin(p, timestamp);
      case 'exec_command_end':
        return this.parseExecCommandEnd(p, timestamp);

      // Patch apply lifecycle
      case 'patch_apply_begin':
        return this.parsePatchApplyBegin(p, timestamp);
      case 'patch_apply_end':
        return this.parsePatchApplyEnd(p, timestamp);

      // Back-compat / legacy tool-style events
      case 'tool_use':
      case 'apply_patch':
        return this.parseToolUse(eventType, p, timestamp);

      case 'exec_command_output_delta':
        // stdout/stderr stream; timeline is command/audit focused (not raw output)
        return null;

      case 'tool_result':
      case 'background_event':
        return this.parseToolResult(eventType, p, timestamp);

      case 'task_complete':
        return this.parseTaskComplete(p, timestamp);

      case 'turn_aborted':
        return this.parseTurnAborted(p, timestamp);

      case 'error':
        return this.parseError(p, timestamp);

      default:
        // Log unknown events for debugging
        return {
          id: uuidv4(),
          timestamp,
          entryType: 'system_message',
          content: `Event: ${eventType}`,
          metadata: p as Record<string, unknown>,
        };
    }
  }

  private parseSessionConfigured(params: CodexEventParams, timestamp: string): NormalizedEntry {
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'system_message',
      content: 'Session configured',
      metadata: {
        ...params as unknown as Record<string, unknown>,
      },
    };
  }

  private parseUserMessage(params: CodexEventParams, timestamp: string): NormalizedEntry {
    const content = this.extractContent(params.message);

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'user_message',
      content,
    };
  }

  private parseAssistantMessage(params: CodexEventParams, timestamp: string): NormalizedEntry {
    const content = this.extractContent(params.message) || params.content || '';

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'assistant_message',
      content,
      metadata: {
        ...(params as unknown as Record<string, unknown>),
      },
    };
  }

  private parseAssistantDelta(params: CodexEventParams, timestamp: string, panelId?: string): NormalizedEntry | null {
    const delta = typeof (params as { delta?: unknown }).delta === 'string' ? (params as { delta: string }).delta : '';
    if (!delta) return null;

    const key = panelId || 'unknown';
    const current = this.assistantDeltaByPanel.get(key) || { id: uuidv4(), text: '' };
    current.text += delta;
    this.assistantDeltaByPanel.set(key, current);

    return {
      id: current.id,
      timestamp,
      entryType: 'assistant_message',
      content: current.text,
      metadata: {
        streaming: true,
        ...(params as unknown as Record<string, unknown>),
      },
    };
  }

  private parseReasoning(params: CodexEventParams, timestamp: string): NormalizedEntry {
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'thinking',
      content: params.reasoning || params.content || '',
    };
  }

  private parseReasoningDelta(params: CodexEventParams, timestamp: string, panelId?: string): NormalizedEntry | null {
    const delta = typeof (params as { delta?: unknown }).delta === 'string' ? (params as { delta: string }).delta : '';
    if (!delta) return null;

    const key = panelId || 'unknown';
    const current = this.reasoningDeltaByPanel.get(key) || { id: uuidv4(), text: '' };
    current.text += delta;
    this.reasoningDeltaByPanel.set(key, current);

    return {
      id: current.id,
      timestamp,
      entryType: 'thinking',
      content: current.text,
      metadata: {
        streaming: true,
        ...(params as unknown as Record<string, unknown>),
      },
    };
  }

  private parseV2AgentMessageDelta(params: unknown, timestamp: string, panelId?: string): NormalizedEntry | null {
    const p = params as { itemId?: unknown; delta?: unknown; item_id?: unknown };
    const itemId = typeof p.itemId === 'string'
      ? p.itemId
      : typeof p.item_id === 'string'
        ? p.item_id
        : '';
    const delta = typeof p.delta === 'string' ? p.delta : '';
    if (!itemId || !delta) return null;

    const current = this.assistantDeltaByItem.get(itemId) || { id: itemId, text: '' };
    current.text += delta;
    this.assistantDeltaByItem.set(itemId, current);

    return {
      id: current.id,
      timestamp,
      entryType: 'assistant_message',
      content: current.text,
      metadata: {
        streaming: true,
        panelId,
        ...(params as Record<string, unknown>),
      },
    };
  }

  private parseV2ReasoningDelta(params: unknown, timestamp: string): NormalizedEntry | null {
    const p = params as { itemId?: unknown; delta?: unknown; item_id?: unknown };
    const itemId = typeof p.itemId === 'string'
      ? p.itemId
      : typeof p.item_id === 'string'
        ? p.item_id
        : '';
    const delta = typeof p.delta === 'string' ? p.delta : '';
    if (!itemId || !delta) return null;

    const current = this.reasoningDeltaByItem.get(itemId) || { id: itemId, text: '' };
    current.text += delta;
    this.reasoningDeltaByItem.set(itemId, current);

    return {
      id: current.id,
      timestamp,
      entryType: 'thinking',
      content: current.text,
      metadata: {
        streaming: true,
        ...(params as Record<string, unknown>),
      },
    };
  }

  private parseV2ItemStarted(params: unknown, timestamp: string): NormalizedEntry | null {
    const p = params as { item?: unknown };
    const item = (p && typeof p === 'object' && 'item' in p) ? (p as { item: unknown }).item : null;
    if (!item || typeof item !== 'object') return null;
    return this.parseV2ThreadItem(item as Record<string, unknown>, timestamp, 'started');
  }

  private parseV2ItemCompleted(params: unknown, timestamp: string): NormalizedEntry | null {
    const p = params as { item?: unknown };
    const item = (p && typeof p === 'object' && 'item' in p) ? (p as { item: unknown }).item : null;
    if (!item || typeof item !== 'object') return null;
    return this.parseV2ThreadItem(item as Record<string, unknown>, timestamp, 'completed');
  }

  private parseV2ThreadItem(
    item: Record<string, unknown>,
    timestamp: string,
    phase: 'started' | 'completed'
  ): NormalizedEntry | null {
    const type = typeof item.type === 'string' ? item.type : '';
    const id = typeof item.id === 'string' ? item.id : uuidv4();

    if (type === 'agentMessage') {
      if (phase === 'completed') {
        const streamed = this.assistantDeltaByItem.get(id);
        if (streamed) {
          this.assistantDeltaByItem.delete(id);
          return {
            id,
            timestamp,
            entryType: 'assistant_message',
            content: streamed.text,
            metadata: item,
          };
        }

        const text = typeof item.text === 'string' ? item.text : '';
        if (!text) return null;
        return {
          id,
          timestamp,
          entryType: 'assistant_message',
          content: text,
          metadata: item,
        };
      }
      return null;
    }

    if (type === 'reasoning') {
      if (phase === 'completed') {
        const streamed = this.reasoningDeltaByItem.get(id);
        if (streamed) {
          this.reasoningDeltaByItem.delete(id);
          return {
            id,
            timestamp,
            entryType: 'thinking',
            content: streamed.text,
            metadata: item,
          };
        }

        const summary = Array.isArray(item.summary) ? item.summary.map(String).join('\n') : '';
        const content = Array.isArray(item.content) ? item.content.map(String).join('\n') : '';
        const text = [summary, content].filter(Boolean).join('\n');
        if (!text) return null;
        return {
          id,
          timestamp,
          entryType: 'thinking',
          content: text,
          metadata: item,
        };
      }
      return null;
    }

    if (type === 'commandExecution') {
      const command = typeof item.command === 'string' ? item.command : '';
      if (!command) return null;

      if (phase === 'started') {
        return {
          id,
          timestamp,
          entryType: 'tool_use',
          content: command,
          toolName: 'commandExecution',
          toolStatus: 'pending',
          actionType: { type: 'command_run', command },
          metadata: item,
        };
      }

      const status = typeof item.status === 'string' ? item.status : '';
      const ok = status === 'completed';
      return {
        id,
        timestamp,
        entryType: 'tool_result',
        content: '',
        toolStatus: ok ? 'success' : 'failed',
        metadata: item,
      };
    }

    if (type === 'fileChange') {
      const changes = Array.isArray(item.changes) ? item.changes : [];
      const paths = changes
        .map((c) => (c && typeof c === 'object' && typeof (c as { path?: unknown }).path === 'string') ? String((c as { path: unknown }).path) : '')
        .filter(Boolean);
      const label = paths.length <= 3
        ? `Apply patch: ${paths.join(', ') || 'changes'}`
        : `Apply patch: ${paths.slice(0, 3).join(', ')} (+${paths.length - 3} more)`;

      if (phase === 'started') {
        return {
          id,
          timestamp,
          entryType: 'tool_use',
          content: label,
          toolName: 'fileChange',
          toolStatus: 'pending',
          actionType: { type: 'file_edit', path: paths[0] ? String(paths[0]) : '' },
          metadata: item,
        };
      }

      const status = typeof item.status === 'string' ? item.status : '';
      const ok = status === 'completed';
      return {
        id,
        timestamp,
        entryType: 'tool_result',
        content: '',
        toolStatus: ok ? 'success' : 'failed',
        metadata: item,
      };
    }

    if (type === 'mcpToolCall') {
      const server = typeof item.server === 'string' ? item.server : '';
      const tool = typeof item.tool === 'string' ? item.tool : '';
      const label = server && tool ? `MCP ${server}::${tool}` : 'MCP tool call';

      if (phase === 'started') {
        return {
          id,
          timestamp,
          entryType: 'tool_use',
          content: label,
          toolName: 'mcpToolCall',
          toolStatus: 'pending',
          actionType: { type: 'other', description: label },
          metadata: item,
        };
      }

      const status = typeof item.status === 'string' ? item.status : '';
      const ok = status === 'completed';
      return {
        id,
        timestamp,
        entryType: 'tool_result',
        content: '',
        toolStatus: ok ? 'success' : 'failed',
        metadata: item,
      };
    }

    if (type === 'webSearch') {
      const query = typeof item.query === 'string' ? item.query : '';
      if (!query) return null;
      if (phase === 'started') {
        return {
          id,
          timestamp,
          entryType: 'tool_use',
          content: `Web search: ${query}`,
          toolName: 'webSearch',
          toolStatus: 'pending',
          actionType: { type: 'web_fetch', url: query },
          metadata: item,
        };
      }
      return {
        id,
        timestamp,
        entryType: 'tool_result',
        content: '',
        toolStatus: 'success',
        metadata: item,
      };
    }

    return null;
  }

  private parseTurnPlanUpdated(params: unknown, timestamp: string): NormalizedEntry | null {
    const p = params as { explanation?: unknown; plan?: unknown };
    const explanation = typeof p.explanation === 'string' ? p.explanation : '';
    const plan = Array.isArray(p.plan) ? p.plan : [];
    const lines = plan
      .map((step) => {
        const s = step as { step?: unknown; status?: unknown };
        const label = typeof s.step === 'string' ? s.step : '';
        const status = typeof s.status === 'string' ? s.status : '';
        return label ? `${status || 'pending'}: ${label}` : '';
      })
      .filter(Boolean);

    const content = [explanation, ...lines].filter(Boolean).join('\n');
    if (!content) return null;
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'system_message',
      content,
      metadata: params as Record<string, unknown>,
    };
  }

  private parseV2Error(params: unknown, timestamp: string): NormalizedEntry {
    const p = params as { error?: unknown };
    const err = p && typeof p === 'object' && 'error' in p ? (p as { error: unknown }).error : null;
    const message = err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
      ? String((err as { message: unknown }).message)
      : 'Unknown error';
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'error_message',
      content: message,
      metadata: params as Record<string, unknown>,
    };
  }

  private parseExecCommandBegin(params: CodexEventParams, timestamp: string): NormalizedEntry | null {
    const callId = typeof (params as { call_id?: unknown }).call_id === 'string' ? (params as { call_id: string }).call_id : null;
    const cmdArr = Array.isArray((params as { command?: unknown }).command) ? (params as { command: unknown[] }).command : null;
    const command = cmdArr ? cmdArr.map(String).join(' ') : (typeof (params as { command?: unknown }).command === 'string' ? String((params as { command: unknown }).command) : '');
    if (!callId || !command) return null;

    return {
      id: callId,
      timestamp,
      entryType: 'tool_use',
      content: command,
      toolName: 'exec_command',
      toolStatus: 'pending',
      actionType: { type: 'command_run', command },
      metadata: { ...(params as unknown as Record<string, unknown>) },
    };
  }

  private parseExecCommandEnd(params: CodexEventParams, timestamp: string): NormalizedEntry | null {
    const callId = typeof (params as { call_id?: unknown }).call_id === 'string' ? (params as { call_id: string }).call_id : null;
    if (!callId) return null;
    const exitCode = typeof (params as { exit_code?: unknown }).exit_code === 'number' ? (params as { exit_code: number }).exit_code : undefined;
    const ok = typeof exitCode === 'number' ? exitCode === 0 : !(params as { is_error?: unknown }).is_error;

    return {
      id: callId,
      timestamp,
      entryType: 'tool_result',
      content: '',
      toolStatus: ok ? 'success' : 'failed',
      metadata: { ...(params as unknown as Record<string, unknown>) },
    };
  }

  private parsePatchApplyBegin(params: CodexEventParams, timestamp: string): NormalizedEntry | null {
    const callId = typeof (params as { call_id?: unknown }).call_id === 'string' ? (params as { call_id: string }).call_id : null;
    if (!callId) return null;
    const changes = (params as { changes?: unknown }).changes;
    const files = changes && typeof changes === 'object' ? Object.keys(changes as Record<string, unknown>) : [];
    const label = files.length <= 3
      ? `Apply patch: ${files.join(', ') || 'changes'}`
      : `Apply patch: ${files.slice(0, 3).join(', ')} (+${files.length - 3} more)`;

    return {
      id: callId,
      timestamp,
      entryType: 'tool_use',
      content: label,
      toolName: 'apply_patch',
      toolStatus: 'pending',
      actionType: { type: 'file_edit', path: files[0] ? String(files[0]) : '' },
      metadata: { ...(params as unknown as Record<string, unknown>) },
    };
  }

  private parsePatchApplyEnd(params: CodexEventParams, timestamp: string): NormalizedEntry | null {
    const callId = typeof (params as { call_id?: unknown }).call_id === 'string' ? (params as { call_id: string }).call_id : null;
    if (!callId) return null;
    const success = (params as { success?: unknown }).success;
    const ok = typeof success === 'boolean' ? success : !(params as { is_error?: unknown }).is_error;

    return {
      id: callId,
      timestamp,
      entryType: 'tool_result',
      content: '',
      toolStatus: ok ? 'success' : 'failed',
      metadata: { ...(params as unknown as Record<string, unknown>) },
    };
  }

  private parseToolUse(eventType: string, params: CodexEventParams, timestamp: string): NormalizedEntry {
    const toolName = params.tool_name || eventType;
    const input = params.tool_input || params as Record<string, unknown>;
    const actionType = this.inferActionType(toolName, input);

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'tool_use',
      content: this.formatToolInput(toolName, input),
      toolName,
      toolStatus: 'pending',
      actionType,
      metadata: {
        input,
      },
    };
  }

  private parseToolResult(eventType: string, params: CodexEventParams, timestamp: string): NormalizedEntry {
    const isError = params.is_error || false;
    const result = params.result || params.content || '';

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'tool_result',
      content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      toolStatus: isError ? 'failed' : 'success',
      metadata: {
        is_error: isError,
        event_type: eventType,
      },
    };
  }

  private parseTaskComplete(params: CodexEventParams, timestamp: string): NormalizedEntry {
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'system_message',
      content: 'Task completed',
      metadata: params as Record<string, unknown>,
    };
  }

  private parseTurnAborted(params: CodexEventParams, timestamp: string): NormalizedEntry {
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'system_message',
      content: 'Turn aborted',
      metadata: params as Record<string, unknown>,
    };
  }

  private parseError(params: CodexEventParams, timestamp: string): NormalizedEntry {
    return {
      id: uuidv4(),
      timestamp,
      entryType: 'error_message',
      content: params.content || 'Unknown error',
      metadata: params as Record<string, unknown>,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractContent(message?: CodexMessage): string {
    if (!message) return '';

    if (typeof message.content === 'string') {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .filter((item): item is { type: 'text'; text: string } =>
          item.type === 'text' && typeof item.text === 'string'
        )
        .map((item) => item.text)
        .join('\n');
    }

    return '';
  }

  private formatToolInput(toolName: string, input: Record<string, unknown>): string {
    const name = toolName.toLowerCase();

    if (name === 'exec_command' || name === 'shell') {
      return input.command as string || JSON.stringify(input);
    }

    if (name === 'apply_patch' || name === 'edit') {
      const path = input.path || input.file_path;
      return `Edit: ${path}`;
    }

    if (name === 'read_file') {
      return `Read: ${input.path || input.file_path}`;
    }

    if (name === 'write_file') {
      return `Write: ${input.path || input.file_path}`;
    }

    // Default
    const keys = Object.keys(input).slice(0, 3);
    const summary = keys.map((k) => `${k}=${String(input[k]).substring(0, 50)}`).join(', ');
    return `${toolName}: ${summary}`;
  }

  private inferActionType(toolName: string, input: Record<string, unknown>): ActionType {
    const name = toolName.toLowerCase();

    if (name === 'read_file' || name === 'list_files') {
      return {
        type: 'file_read',
        path: String(input.path || input.file_path || ''),
      };
    }

    if (name === 'apply_patch' || name === 'edit') {
      return {
        type: 'file_edit',
        path: String(input.path || input.file_path || ''),
      };
    }

    if (name === 'write_file') {
      return {
        type: 'file_write',
        path: String(input.path || input.file_path || ''),
      };
    }

    if (name === 'exec_command' || name === 'shell') {
      return {
        type: 'command_run',
        command: String(input.command || ''),
      };
    }

    return {
      type: 'other',
      description: toolName,
    };
  }
}

export default CodexMessageParser;
