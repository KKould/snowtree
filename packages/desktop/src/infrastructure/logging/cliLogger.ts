/**
 * Professional logging utility for CLI tool communication (Claude Code, Codex, etc.)
 * Provides structured request/response logging for easy debugging
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type CliTool = 'Claude' | 'Codex' | 'CLI';

interface CliRequest {
  tool: CliTool;
  panelId: string;
  sessionId: string;
  agentSessionId?: string;
  worktreePath: string;
  prompt: string;
  model?: string;
  isResume: boolean;
  command: string;
  args: string[];
}

interface CliResponse {
  tool: CliTool;
  panelId: string;
  type: string;
  data?: unknown;
}

interface CliEvent {
  tool: CliTool;
  panelId: string;
  event: string;
  details?: Record<string, unknown>;
}

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

const TOOL_COLORS: Record<CliTool, string> = {
  Claude: COLORS.blue,
  Codex: COLORS.magenta,
  CLI: COLORS.cyan,
};

function ts(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function short(id: string | undefined): string {
  if (!id) return '-';
  return id.substring(0, 8);
}

function truncate(str: string, max: number = 100): string {
  if (!str) return '';
  const clean = str.replace(/\n/g, '\\n');
  return clean.length <= max ? clean : clean.substring(0, max) + '...';
}

export class CliLogger {
  private static instance: CliLogger;
  private requestTimes: Map<string, number> = new Map();
  private enabled: boolean = true;

  static getInstance(): CliLogger {
    if (!CliLogger.instance) {
      CliLogger.instance = new CliLogger();
    }
    return CliLogger.instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private prefix(level: LogLevel, tool: CliTool): string {
    const levelColors: Record<LogLevel, string> = {
      DEBUG: COLORS.dim,
      INFO: COLORS.green,
      WARN: COLORS.yellow,
      ERROR: COLORS.red,
    };
    const toolColor = TOOL_COLORS[tool];
    return `${COLORS.dim}[${ts()}]${COLORS.reset} ${levelColors[level]}${level.padEnd(5)}${COLORS.reset} ${toolColor}[${tool}]${COLORS.reset}`;
  }

  /**
   * Log request to CLI tool
   */
  request(req: CliRequest): void {
    if (!this.enabled) return;
    this.requestTimes.set(req.panelId, Date.now());

    const toolColor = TOOL_COLORS[req.tool];
    console.log(`
${toolColor}┌─────────────────────────────────────────────────────────────────┐
│ ${req.tool.toUpperCase()} REQUEST
├─────────────────────────────────────────────────────────────────┤${COLORS.reset}
${this.prefix('INFO', req.tool)} REQ panel=${short(req.panelId)} session=${short(req.sessionId)}
${COLORS.dim}  ├─ worktree: ${req.worktreePath}
  ├─ model: ${req.model || 'default'}
  ├─ resume: ${req.isResume} (agentSession: ${short(req.agentSessionId)})
  ├─ prompt: "${truncate(req.prompt, 80)}"
  └─ cmd: ${truncate(req.command + ' ' + req.args.join(' '), 100)}${COLORS.reset}`);
  }

  /**
   * Log response from CLI tool
   */
  response(res: CliResponse): void {
    if (!this.enabled) return;

    const elapsed = this.requestTimes.has(res.panelId)
      ? `+${Date.now() - this.requestTimes.get(res.panelId)!}ms`
      : '';

    const typeColors: Record<string, string> = {
      user: COLORS.green,
      assistant: COLORS.blue,
      result: COLORS.magenta,
      system: COLORS.cyan,
      error: COLORS.red,
    };
    const typeColor = typeColors[res.type] || COLORS.white;

    console.log(`${this.prefix('INFO', res.tool)} RES panel=${short(res.panelId)} type=${typeColor}${res.type}${COLORS.reset} ${COLORS.dim}${elapsed}${COLORS.reset}`);

    if (res.data) {
      const dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      console.log(`${COLORS.dim}  └─ ${truncate(dataStr, 150)}${COLORS.reset}`);
    }
  }

  /**
   * Log CLI tool process completion
   */
  complete(tool: CliTool, panelId: string, exitCode: number, agentSessionId?: string): void {
    if (!this.enabled) return;

    const startTime = this.requestTimes.get(panelId);
    const duration = startTime ? Date.now() - startTime : 0;
    this.requestTimes.delete(panelId);

    const status = exitCode === 0
      ? `${COLORS.green}OK${COLORS.reset}`
      : `${COLORS.red}FAIL(${exitCode})${COLORS.reset}`;

    const toolColor = TOOL_COLORS[tool];
    console.log(`${toolColor}├─────────────────────────────────────────────────────────────────┤
│ ${tool.toUpperCase()} COMPLETE
└─────────────────────────────────────────────────────────────────┘${COLORS.reset}
${this.prefix('INFO', tool)} END panel=${short(panelId)} status=${status} duration=${(duration/1000).toFixed(2)}s agentSession=${short(agentSessionId)}`);
  }

  /**
   * Log state change
   */
  state(tool: CliTool, panelId: string, from: string, to: string): void {
    if (!this.enabled) return;
    console.log(`${this.prefix('DEBUG', tool)} STATE panel=${short(panelId)} ${from} → ${to}`);
  }

  /**
   * Log event
   */
  event(evt: CliEvent): void {
    if (!this.enabled) return;
    const details = evt.details ? ` ${JSON.stringify(evt.details)}` : '';
    console.log(`${this.prefix('DEBUG', evt.tool)} EVENT panel=${short(evt.panelId)} ${evt.event}${COLORS.dim}${details}${COLORS.reset}`);
  }

  /**
   * Log error
   */
  error(tool: CliTool, panelId: string, message: string, err?: Error): void {
    if (!this.enabled) return;
    console.log(`${this.prefix('ERROR', tool)} panel=${short(panelId)} ${message}`);
    if (err) {
      console.log(`${COLORS.dim}  └─ ${err.message}${COLORS.reset}`);
    }
  }

  /**
   * Log info
   */
  info(tool: CliTool, panelId: string, message: string): void {
    if (!this.enabled) return;
    console.log(`${this.prefix('INFO', tool)} panel=${short(panelId)} ${message}`);
  }

  /**
   * Log debug
   */
  debug(tool: CliTool, panelId: string, message: string): void {
    if (!this.enabled) return;
    console.log(`${this.prefix('DEBUG', tool)} panel=${short(panelId)} ${message}`);
  }
}

export const cliLogger = CliLogger.getInstance();
