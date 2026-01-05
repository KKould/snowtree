/**
 * UpdateManager - Handles application auto-update with electron-updater
 *
 * Features:
 * - Checks for updates on startup (after 10 second delay)
 * - Checks for updates every hour
 * - Checks for updates when window gains focus (throttled)
 * - Downloads updates on user request
 * - Installs updates on app restart
 */

import { autoUpdater } from 'electron-updater';
import { EventEmitter } from 'events';

export class UpdateManager extends EventEmitter {
  private updateAvailable = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckTime = 0;
  private readonly CHECK_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes throttle
  private readonly PERIODIC_CHECK_MS = 60 * 60 * 1000; // Check every hour

  /**
   * Initialize the update manager
   * Sets up event listeners and schedules update checks
   */
  async initialize(): Promise<void> {
    // Configure auto-updater behavior
    autoUpdater.autoDownload = false; // Don't auto-download, wait for user action
    autoUpdater.autoInstallOnAppQuit = true; // Install automatically on next quit

    // Listen for update availability
    autoUpdater.on('update-available', (info) => {
      this.updateAvailable = true;
      this.emit('update-available', info.version);
    });

    // Listen for download completion
    autoUpdater.on('update-downloaded', () => {
      this.emit('update-downloaded');
    });

    // Listen for errors (silent failure)
    autoUpdater.on('error', () => {
      // Silently ignore errors - don't bother users with update check failures
    });

    // Initial check after 10 seconds to avoid blocking startup
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000);

    // Periodic check every hour
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.PERIODIC_CHECK_MS);
  }

  /**
   * Check for updates (throttled to avoid excessive requests)
   * Can be called manually, e.g., when window gains focus
   */
  checkForUpdates(): void {
    const now = Date.now();

    // Throttle: Don't check if we checked recently
    if (now - this.lastCheckTime < this.CHECK_THROTTLE_MS) {
      return;
    }

    this.lastCheckTime = now;

    autoUpdater.checkForUpdates().catch(() => {
      // Silently ignore check failures
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Download the available update
   * Only downloads if an update is actually available
   */
  async downloadUpdate(): Promise<void> {
    if (!this.updateAvailable) {
      return;
    }
    await autoUpdater.downloadUpdate();
  }

  /**
   * Quit the application and install the downloaded update
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }
}
