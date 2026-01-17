/**
 * GeminiMessageParser - Parse Gemini CLI stream-json events into normalized entries
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedEntry,
  ActionType,
} from '../types';

type GeminiInitEvent = {
  type: 'init';
  timestamp: string;
  session_id: string;
  model: string;
};

type GeminiMessageEvent = {
  type: 'message';
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  delta?: boolean;
};

type GeminiToolUseEvent = {
  type: 'tool_use';
  timestamp: string;
  tool_name: string;
  tool_id: string;
  parameters: Record<string, unknown>;
};

type GeminiToolResultEvent = {
  type: 'tool_result';
  timestamp: string;
  tool_id: string;
  status: 'success' | 'error';
  output?: string;
  error?: {
    type: string;
    message: string;
  };
};

type GeminiErrorEvent = {
  type: 'error';
  timestamp: string;
  severity: 'warning' | 'error';
  message: string;
};

type GeminiResultEvent = {
  type: 'result';
  timestamp: string;
  status: 'success' | 'error';
  error?: {
    type: string;
    message: string;
  };
  stats?: Record<string, unknown>;
};

export type GeminiStreamEvent =
  | GeminiInitEvent
  | GeminiMessageEvent
  | GeminiToolUseEvent
  | GeminiToolResultEvent
  | GeminiErrorEvent
  | GeminiResultEvent;

type AssistantState = {
  id: string;
  text: string;
  isStreaming: boolean;
};

export class GeminiMessageParser {
  private assistantByPanel = new Map<string, AssistantState>();

  parseEvent(event: GeminiStreamEvent, panelId?: string): NormalizedEntry | null {
    const timestamp = event.timestamp || new Date().toISOString();

    switch (event.type) {
      case 'init':
        return {
          id: uuidv4(),
          timestamp,
          entryType: 'system_message',
          content: 'Session initialized',
          metadata: {
            session_id: event.session_id,
            model: event.model,
          },
        };

      case 'message':
        return this.parseMessage(event, timestamp, panelId);

      case 'tool_use':
        return this.parseToolUse(event, timestamp);

      case 'tool_result':
        return this.parseToolResult(event, timestamp);

      case 'error':
        return {
          id: uuidv4(),
          timestamp,
          entryType: 'error_message',
          content: event.message,
          metadata: {
            severity: event.severity,
          },
        };

      case 'result':
        if (event.status === 'error') {
          return {
            id: uuidv4(),
            timestamp,
            entryType: 'error_message',
            content: event.error?.message || 'Gemini error',
            metadata: {
              error_type: event.error?.type,
            },
          };
        }
        return {
          id: uuidv4(),
          timestamp,
          entryType: 'system_message',
          content: 'Task completed',
          metadata: {
            stats: event.stats,
          },
        };

      default:
        return null;
    }
  }

  flushAssistantMessage(panelId: string, timestamp?: string): NormalizedEntry | null {
    const state = this.assistantByPanel.get(panelId);
    if (!state || !state.isStreaming || !state.text.trim()) {
      return null;
    }

    state.isStreaming = false;
    this.assistantByPanel.set(panelId, state);

    return {
      id: state.id,
      timestamp: timestamp || new Date().toISOString(),
      entryType: 'assistant_message',
      content: state.text,
      metadata: {
        streaming: false,
      },
    };
  }

  clearPanel(panelId: string): void {
    this.assistantByPanel.delete(panelId);
  }

  private parseMessage(
    event: GeminiMessageEvent,
    timestamp: string,
    panelId?: string
  ): NormalizedEntry | null {
    if (event.role === 'user') {
      return {
        id: uuidv4(),
        timestamp,
        entryType: 'user_message',
        content: event.content,
      };
    }

    if (!panelId) {
      return {
        id: uuidv4(),
        timestamp,
        entryType: 'assistant_message',
        content: event.content,
        metadata: {
          streaming: Boolean(event.delta),
        },
      };
    }

    const current = this.assistantByPanel.get(panelId) || {
      id: uuidv4(),
      text: '',
      isStreaming: false,
    };

    if (event.delta) {
      current.text += event.content || '';
      current.isStreaming = true;
    } else {
      current.text = event.content || '';
      current.isStreaming = false;
    }

    this.assistantByPanel.set(panelId, current);

    if (event.delta && !current.text.trim()) {
      return null;
    }

    return {
      id: current.id,
      timestamp,
      entryType: 'assistant_message',
      content: current.text,
      metadata: {
        streaming: Boolean(event.delta),
      },
    };
  }

  private parseToolUse(event: GeminiToolUseEvent, timestamp: string): NormalizedEntry {
    const toolName = event.tool_name || 'unknown';
    const input = event.parameters || {};
    const actionType = this.inferActionType(toolName, input);

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'tool_use',
      content: this.formatToolInput(toolName, input),
      toolName,
      toolUseId: event.tool_id,
      toolStatus: 'pending',
      actionType,
      metadata: {
        input,
      },
    };
  }

  private parseToolResult(event: GeminiToolResultEvent, timestamp: string): NormalizedEntry {
    const output = typeof event.output === 'string'
      ? event.output
      : event.error?.message || '';

    return {
      id: uuidv4(),
      timestamp,
      entryType: 'tool_result',
      content: output,
      toolUseId: event.tool_id,
      toolStatus: event.status === 'error' ? 'failed' : 'success',
      metadata: {
        is_error: event.status === 'error',
        error_type: event.error?.type,
      },
    };
  }

  private formatToolInput(toolName: string, input: Record<string, unknown>): string {
    const name = toolName.toLowerCase();

    if (name.includes('shell') || name.includes('command')) {
      const command = typeof input.command === 'string'
        ? input.command
        : typeof input.cmd === 'string'
          ? input.cmd
          : '';
      return command || JSON.stringify(input);
    }

    if (name.includes('read') || name.includes('list') || name.includes('glob') || name.includes('grep')) {
      const path = input.file_path || input.path || input.pattern;
      return `${toolName}: ${path ?? ''}`.trim();
    }

    if (name.includes('write') || name.includes('edit') || name.includes('patch')) {
      const path = input.file_path || input.path || input.file;
      return `${toolName}: ${path ?? ''}`.trim();
    }

    if (name.includes('web') && typeof input.url === 'string') {
      return `Fetching: ${input.url}`;
    }

    if (name.includes('web') && typeof input.query === 'string') {
      return `Searching: ${input.query}`;
    }

    const keys = Object.keys(input).slice(0, 3);
    const summary = keys.map((key) => {
      const value = input[key];
      if (typeof value === 'object' && value !== null) {
        const jsonStr = JSON.stringify(value);
        return `${key}=${jsonStr.substring(0, 50)}${jsonStr.length > 50 ? '...' : ''}`;
      }
      return `${key}=${String(value).substring(0, 50)}`;
    }).join(', ');
    return `${toolName}: ${summary}`;
  }

  private inferActionType(toolName: string, input: Record<string, unknown>): ActionType {
    const name = toolName.toLowerCase();

    if (name.includes('read') || name.includes('list') || name.includes('glob') || name.includes('grep')) {
      return {
        type: 'file_read',
        path: String(input.file_path || input.path || input.pattern || ''),
      };
    }

    if (name.includes('write') || name.includes('edit') || name.includes('patch')) {
      return {
        type: 'file_edit',
        path: String(input.file_path || input.path || input.file || ''),
      };
    }

    if (name.includes('shell') || name.includes('command')) {
      return {
        type: 'command_run',
        command: String(input.command || input.cmd || ''),
      };
    }

    if (name.includes('web') && typeof input.url === 'string') {
      return {
        type: 'web_fetch',
        url: String(input.url || ''),
      };
    }

    if (name.includes('web') && typeof input.query === 'string') {
      return {
        type: 'search',
        query: String(input.query || ''),
      };
    }

    return {
      type: 'other',
      description: toolName,
    };
  }
}
