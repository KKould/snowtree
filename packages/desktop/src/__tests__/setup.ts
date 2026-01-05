import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock main index to prevent app initialization during tests
vi.mock('../index.ts', () => ({}));

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-app'),
    getName: vi.fn(() => 'snowtree-test'),
    setName: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
    commandLine: {
      appendSwitch: vi.fn(),
      hasSwitch: vi.fn(() => false),
    },
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
    },
    setTitle: vi.fn(),
  })),
  nativeImage: {
    createFromPath: vi.fn(),
  },
  shell: {},
}));

// Global cleanup
afterEach(() => {
  vi.clearAllMocks();
});
