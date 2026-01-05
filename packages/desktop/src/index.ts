// Load ReadableStream polyfill before any other imports
import './polyfills/readablestream';

// Fix GTK 2/3 and GTK 4 conflict on Linux (Electron 36 issue)
// This MUST be done before importing electron
import { app } from 'electron';
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('gtk-version', '3');
}
app.setName('snowtree');

// Now import the rest of electron
import { BrowserWindow, ipcMain, shell, nativeImage, Menu } from 'electron';
import * as path from 'path';
import { TaskQueue } from './features/queue';
import { SessionManager } from './features/session';
import { ConfigManager } from './infrastructure/config/configManager';
import { WorktreeManager, WorktreeNameGenerator } from './features/worktree';
import { GitDiffManager, GitStatusManager } from './features/git';
import { ExecutionTracker } from './features/queue';
import { Database as DatabaseService, initializeDatabaseService } from './infrastructure/database';
import { Logger } from './infrastructure/logging';
import { setSnowtreeDirectory } from './infrastructure/utils/snowtreeDirectory';
import { getCurrentWorktreeName } from './infrastructure/git/worktreeUtils';
import { registerIpcHandlers } from './infrastructure/ipc';
import { setupEventListeners } from './events';
import type { AppServices } from './infrastructure/ipc';
import { ClaudeExecutor } from './executors/claude';
import { CodexExecutor } from './executors/codex';
import { GitExecutor } from './executors/git';
import { setupConsoleWrapper } from './infrastructure/logging/consoleWrapper';
import { panelManager } from './features/panels/PanelManager';
import { UpdateManager } from './features/updater/UpdateManager';
import * as fs from 'fs';

export let mainWindow: BrowserWindow | null = null;
let aboutWindow: BrowserWindow | null = null;

/**
 * Create and show the About window
 */
function createAboutWindow() {
  // Don't create duplicate windows
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 }
    } : {})
  });

  const aboutHtmlPath = path.join(__dirname, 'windows/about.html');
  aboutWindow.loadFile(aboutHtmlPath);

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

/**
 * Set the application title based on development mode and worktree
 */
function setAppTitle() {
  if (isDevelopment) {
    const worktreeName = getCurrentWorktreeName(process.cwd());
    if (worktreeName) {
      const title = `snowtree [${worktreeName}]`;
      if (mainWindow) {
        mainWindow.setTitle(title);
      }
      return title;
    }
  }
  
  // Default title
  const title = 'snowtree';
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
  return title;
}
let taskQueue: TaskQueue | null = null;

// Service instances
let configManager: ConfigManager;
let logger: Logger;
let sessionManager: SessionManager;
let worktreeManager: WorktreeManager;
let gitExecutor: GitExecutor;
let claudeExecutor: ClaudeExecutor;
let codexExecutor: CodexExecutor;
let gitDiffManager: GitDiffManager;
let gitStatusManager: GitStatusManager;
let executionTracker: ExecutionTracker;
let worktreeNameGenerator: WorktreeNameGenerator;
let databaseService: DatabaseService;
let updateManager: UpdateManager | null = null;

// Store app start time for session duration tracking
let appStartTime: number;

// Store original console methods before overriding
// These must be captured immediately when the module loads
const originalLog: typeof console.log = console.log;
const originalError: typeof console.error = console.error;
const originalWarn: typeof console.warn = console.warn;
const originalInfo: typeof console.info = console.info;

const isDevelopment = app.commandLine.hasSwitch('snowtree-dev');

// Reset debug log files at startup in development mode
if (isDevelopment) {
  const frontendLogPath = path.join(process.cwd(), 'snowtree-frontend-debug.log');
  const backendLogPath = path.join(process.cwd(), 'snowtree-backend-debug.log');

  try {
    fs.writeFileSync(frontendLogPath, '');
    fs.writeFileSync(backendLogPath, '');
  } catch (error) {
    // Don't crash if we can't reset the log files
    console.error('Failed to reset debug log files:', error);
  }
}

// Set up console wrapper to reduce logging in production
setupConsoleWrapper();

// Parse command-line arguments for custom Snowtree directory
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  // Support both --snowtree-dir=/path and --snowtree-dir /path formats
  if (arg.startsWith('--snowtree-dir=')) {
    const dir = arg.substring('--snowtree-dir='.length);
    setSnowtreeDirectory(dir);
    console.log(`[Main] Using custom Snowtree directory: ${dir}`);
  } else if (arg === '--snowtree-dir' && i + 1 < args.length) {
    const dir = args[i + 1];
    setSnowtreeDirectory(dir);
    console.log(`[Main] Using custom Snowtree directory: ${dir}`);
    i++; // Skip the next argument since we've consumed it
  }
}

// Install Devtron in development
if (isDevelopment) {
  // Devtron can be installed manually in DevTools console with: require('devtron').install()
}

async function createWindow() {
  const initialTitle = setAppTitle();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: initialTitle,
    // Note: macOS ignores BrowserWindow.icon for Dock; we set it via app.dock.setIcon below.
    icon: path.join(app.getAppPath(), 'main/assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 }
    } : {})
  });

  // Increase max listeners to prevent warning when many panels are active
  // Each panel can register multiple event listeners
  mainWindow.webContents.setMaxListeners(100);

  // Set main window reference for services that need to emit events

  if (isDevelopment) {
    console.log('[Main] Loading dev URL: http://localhost:4521');
    await mainWindow.loadURL('http://localhost:4521');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use app.getAppPath() to get the root directory
    // This works correctly whether the app is packaged in ASAR or not
    const indexPath = path.join(app.getAppPath(), 'frontend/dist/index.html');
    console.log('Loading index.html from:', indexPath);

    try {
      await mainWindow.loadFile(indexPath);
    } catch (error) {
      console.error('Failed to load index.html:', error);
      console.error('App path:', app.getAppPath());
      console.error('__dirname:', __dirname);
      
      // Fallback: try relative path (for edge cases)
      const fallbackPath = path.join(__dirname, '../../../../frontend/dist/index.html');
      console.error('Trying fallback path:', fallbackPath);
      try {
        await mainWindow.loadFile(fallbackPath);
      } catch (fallbackError) {
        console.error('Fallback path also failed:', fallbackError);
      }
    }
  }

  // Ensure the app title is applied after load (covers dev reloads)
  setAppTitle();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log any console messages from the renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Skip messages that are already prefixed to avoid circular logging
    if (message.includes('[Main Process]') || message.includes('[Renderer]')) {
      return;
    }
    // Also skip Electron security warnings and other system messages
    if (message.includes('Electron Security Warning') || sourceId.includes('electron/js2c')) {
      return;
    }
    
    // In development, log ALL console messages to help with debugging
    if (isDevelopment) {
      const levelNames = ['verbose', 'info', 'warning', 'error'];
      const levelName = levelNames[level] || 'unknown';
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [FRONTEND ${levelName.toUpperCase()}] ${message}`;
      
      // Always log to main console
      
      // Also write to debug log file for Claude Code to read
      const debugLogPath = path.join(process.cwd(), 'snowtree-frontend-debug.log');
      const logLine = `${logMessage} (${path.basename(sourceId)}:${line})\n`;
      
      try {
        fs.appendFileSync(debugLogPath, logLine);
      } catch (error) {
        // Don't crash if we can't write to the log file
        console.error('Failed to write to debug log:', error);
      }
    } else {
      // In production, only log errors and warnings from renderer
      if (level >= 2) { // 2 = warning, 3 = error
      }
    }
  });

  // Override console methods to forward to renderer and logger
  console.log = (...args: unknown[]) => {
    // Format the message
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    // Write to logger if available
    if (logger) {
      logger.info(message);
    } else {
      originalLog.apply(console, args);
    }

    // In development, also write to backend debug log file
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [BACKEND LOG] ${message}`;
      const debugLogPath = path.join(process.cwd(), 'snowtree-backend-debug.log');
      const logLine = `${logMessage}\n`;

      try {
        fs.appendFileSync(debugLogPath, logLine);
      } catch (error) {
        // Don't crash if we can't write to the log file
        originalLog('[Main] Failed to write to backend debug log:', error);
      }
    }

    // Forward to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('main-log', 'log', message);
      } catch (e) {
        // If sending to renderer fails, use original console to avoid recursion
        originalLog('[Main] Failed to send log to renderer:', e);
      }
    }
  };

  console.error = (...args: unknown[]) => {
    // Prevent infinite recursion by checking if we're already in an error handler
    if ((console.error as typeof console.error & { __isHandlingError?: boolean }).__isHandlingError) {
      return originalError.apply(console, args);
    }
    
    (console.error as typeof console.error & { __isHandlingError?: boolean }).__isHandlingError = true;
    
    try {
      // If logger is not initialized or we're in the logger itself, use original console
      if (!logger) {
        originalError.apply(console, args);
        return;
      }

      const message = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          if (arg instanceof Error) {
            return `Error: ${arg.message}\nStack: ${arg.stack}`;
          }
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            // Handle circular structure
            return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
          }
        }
        return String(arg);
      }).join(' ');

      // Extract Error object if present
      const errorObj = args.find(arg => arg instanceof Error) as Error | undefined;

      // Use logger but with recursion protection
      logger.error(message, errorObj);

      // In development, also write to backend debug log file
      if (isDevelopment) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [BACKEND ERROR] ${message}`;
        const debugLogPath = path.join(process.cwd(), 'snowtree-backend-debug.log');
        const logLine = `${logMessage}\n`;

        try {
          fs.appendFileSync(debugLogPath, logLine);
        } catch (error) {
          // Don't crash if we can't write to the log file
          originalError('[Main] Failed to write to backend debug log:', error);
        }
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('main-log', 'error', message);
        } catch (e) {
          // If sending to renderer fails, use original console to avoid recursion
          originalError('[Main] Failed to send error to renderer:', e);
        }
      }
    } catch (e) {
      // If anything fails in the error handler, fall back to original
      originalError.apply(console, args);
    } finally {
      (console.error as typeof console.error & { __isHandlingError?: boolean }).__isHandlingError = false;
    }
  };

  console.warn = (...args: unknown[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    // Extract Error object if present for warnings too
    const errorObj = args.find(arg => arg instanceof Error) as Error | undefined;

    if (logger) {
      logger.warn(message, errorObj);
    } else {
      originalWarn.apply(console, args);
    }

    // In development, also write to backend debug log file
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [BACKEND WARNING] ${message}`;
      const debugLogPath = path.join(process.cwd(), 'snowtree-backend-debug.log');
      const logLine = `${logMessage}\n`;

      try {
        fs.appendFileSync(debugLogPath, logLine);
      } catch (error) {
        // Don't crash if we can't write to the log file
        originalWarn('[Main] Failed to write to backend debug log:', error);
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('main-log', 'warn', message);
      } catch (e) {
        // If sending to renderer fails, use original console to avoid recursion
        originalWarn('[Main] Failed to send warning to renderer:', e);
      }
    }
  };

  console.info = (...args: unknown[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    if (logger) {
      logger.info(message);
    } else {
      originalInfo.apply(console, args);
    }

    // In development, also write to backend debug log file
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [BACKEND INFO] ${message}`;
      const debugLogPath = path.join(process.cwd(), 'snowtree-backend-debug.log');
      const logLine = `${logMessage}\n`;

      try {
        fs.appendFileSync(debugLogPath, logLine);
      } catch (error) {
        // Don't crash if we can't write to the log file
        originalInfo('[Main] Failed to write to backend debug log:', error);
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('main-log', 'info', message);
      } catch (e) {
        // If sending to renderer fails, use original console to avoid recursion
        originalInfo('[Main] Failed to send info to renderer:', e);
      }
    }
  };

  console.debug = (...args: unknown[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    // In development, also write to backend debug log file
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [BACKEND DEBUG] ${message}`;
      const debugLogPath = path.join(process.cwd(), 'snowtree-backend-debug.log');
      const logLine = `${logMessage}\n`;

      try {
        fs.appendFileSync(debugLogPath, logLine);
      } catch (error) {
        // Don't crash if we can't write to the log file
        console.error('[Main] Failed to write to backend debug log:', error);
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('main-log', 'debug', message);
      } catch (e) {
        // If sending to renderer fails, use original console to avoid recursion
        console.error('[Main] Failed to send debug to renderer:', e);
      }
    }
  };

  // Log any renderer errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
  });

  // Handle window focus/blur/minimize for smart git status polling and update checks
  mainWindow.on('focus', () => {
    if (gitStatusManager) {
      gitStatusManager.handleVisibilityChange(false); // false = visible/focused
    }
    // Check for updates when window gains focus (throttled in UpdateManager)
    if (updateManager) {
      updateManager.checkForUpdates();
    }
  });

  mainWindow.on('blur', () => {
    if (gitStatusManager) {
      gitStatusManager.handleVisibilityChange(true); // true = hidden/blurred
    }
  });

  mainWindow.on('minimize', () => {
    if (gitStatusManager) {
      gitStatusManager.handleVisibilityChange(true); // true = hidden/minimized
    }
  });

  mainWindow.on('restore', () => {
    if (gitStatusManager) {
      gitStatusManager.handleVisibilityChange(false); // false = visible/restored
    }
  });
}

async function initializeServices() {
  configManager = new ConfigManager();
  await configManager.initialize();

  // Initialize logger early so it can capture all logs
  logger = new Logger(configManager);
  console.log('[Main] Logger initialized');

  // Use the same database path as the original backend
  const dbPath = configManager.getDatabasePath();
  databaseService = initializeDatabaseService(dbPath);
  databaseService.initialize();

  // Initialize panel manager after database is ready
  panelManager.initialize();

  sessionManager = new SessionManager(databaseService);
  sessionManager.initializeFromDatabase();

  gitExecutor = new GitExecutor(sessionManager);
  worktreeManager = new WorktreeManager(gitExecutor);

  // Initialize the active project's worktree directory if one exists
  const activeProject = sessionManager.getActiveProject();
  if (activeProject) {
    await worktreeManager.initializeProject(activeProject.path);
  }

  // Initialize executors
  claudeExecutor = new ClaudeExecutor(sessionManager, logger, configManager);
  codexExecutor = new CodexExecutor(sessionManager, logger, configManager);

  gitDiffManager = new GitDiffManager(gitExecutor, logger);
  gitStatusManager = new GitStatusManager(sessionManager, worktreeManager, gitDiffManager, gitExecutor, logger);
  executionTracker = new ExecutionTracker(sessionManager, gitDiffManager);
  worktreeNameGenerator = new WorktreeNameGenerator(configManager);

  taskQueue = new TaskQueue({
    sessionManager,
    worktreeManager,
    claudeExecutor,
    gitDiffManager,
    executionTracker,
    worktreeNameGenerator,
    getMainWindow: () => mainWindow
  });

  const services: AppServices = {
    app,
    configManager,
    databaseService,
    sessionManager,
    worktreeManager,
    gitExecutor,
    claudeExecutor,
    codexExecutor,
    gitDiffManager,
    gitStatusManager,
    executionTracker,
    worktreeNameGenerator,
    taskQueue,
    getMainWindow: () => mainWindow,
    logger,
    updateManager,
  };

  // Initialize IPC handlers first so managers (like ClaudePanelManager) are ready
  registerIpcHandlers(services);
  // Then set up event listeners that may rely on initialized managers
  setupEventListeners(services, () => mainWindow);

  // Register shell:openExternal handler
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Failed to open external URL:', error);
      return { success: false, error: String(error) };
    }
  });

  // Register console logging IPC handler for development
  if (isDevelopment) {
    ipcMain.handle('console:log', (event, logData) => {
      const { level, args, timestamp, source } = logData;
      const message = args.join(' ');
      const logLine = `[${timestamp}] [${source.toUpperCase()} ${level.toUpperCase()}] ${message}\n`;
      
      // Write to debug log file
      const debugLogPath = path.join(process.cwd(), 'snowtree-frontend-debug.log');
      try {
        fs.appendFileSync(debugLogPath, logLine);
      } catch (error) {
        console.error('Failed to write console log to debug file:', error);
      }
      
      // Also log to main console with prefix
      console.log(`[Frontend ${level}] ${message}`);
    });
  }
  
  // Start git status polling
  gitStatusManager.startPolling();
}

app.whenReady().then(async () => {
  // Record app start time
  appStartTime = Date.now();

  // Ensure a consistent app name in dev (otherwise macOS may show "Electron")
  app.setName('snowtree');
  process.title = 'snowtree';
  try {
    (app as unknown as { name: string }).name = 'snowtree';
  } catch {
    // ignore
  }

  // Set Dock icon on macOS (dev + runtime). Packaged apps also have icons via electron-builder,
  // but this ensures the correct icon while running via `electron .`.
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(app.getAppPath(), 'main/assets/icon.png');
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) app.dock.setIcon(img);
    } catch {
      // ignore
    }
  }

  // Setup application menu
  if (process.platform === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          {
            label: 'About snowtree',
            click: () => createAboutWindow()
          },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'quit' }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  console.log('[Main] App is ready, initializing services...');
  await initializeServices();
  console.log('[Main] Services initialized, creating window...');
  await createWindow();
  console.log('[Main] Window created successfully');

  // Initialize auto-updater in production only
  if (!isDevelopment) {
    updateManager = new UpdateManager();
    await updateManager.initialize();
    console.log('[Main] UpdateManager initialized');

    // Forward update events to renderer
    updateManager.on('update-available', (version: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:available', version);
        console.log(`[Main] Update available: ${version}`);
      }
    });

    updateManager.on('update-downloaded', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:downloaded');
        console.log('[Main] Update downloaded');
      }
    });
  }

  // Refresh git status for all sessions after window is ready
  // This ensures the sidebar shows up-to-date git status for all workspaces
  setTimeout(() => {
    console.log('[Main] Refreshing git status for all sessions...');
    gitStatusManager.refreshAllSessions().catch((error) => {
      console.error('[Main] Failed to refresh git status on startup:', error);
    });
  }, 500); // Small delay to ensure renderer is ready to receive events

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Main] Activating app, creating new window...');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  // Cleanup all sessions and terminate child processes
  if (sessionManager) {
    console.log('[Main] Cleaning up sessions and terminating child processes...');
    await sessionManager.cleanup();
    console.log('[Main] Session cleanup complete');
  }

  // Stop git status polling
  if (gitStatusManager) {
    console.log('[Main] Stopping git status polling...');
    gitStatusManager.stopPolling();
    console.log('[Main] Git status polling stopped');
  }

  // Cleanup update manager
  if (updateManager) {
    console.log('[Main] Cleaning up update manager...');
    updateManager.cleanup();
    console.log('[Main] Update manager cleanup complete');
  }

  // Shutdown executors and all CLI processes
  if (claudeExecutor) {
    console.log('[Main] Shutting down Claude executor...');
    await claudeExecutor.cleanup();
    console.log('[Main] Claude executor shutdown complete');
  }
  if (codexExecutor) {
    console.log('[Main] Shutting down Codex executor...');
    await codexExecutor.cleanup();
    console.log('[Main] Codex executor shutdown complete');
  }

  // Close task queue
  if (taskQueue) {
    await taskQueue.close();
  }

  // Close logger to ensure all logs are flushed
  if (logger) {
    logger.close();
  }
});

// Export getter function for mainWindow
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
