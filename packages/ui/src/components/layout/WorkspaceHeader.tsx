import React, { useState, useEffect } from 'react';
import { GitBranch, ExternalLink, Download } from 'lucide-react';
import type { WorkspaceHeaderProps } from './types';

const StatusDot: React.FC<{ status: string }> = React.memo(({ status }) => {
  const getConfig = (s: string) => {
    switch (s) {
      case 'running':
      case 'initializing':
        return { color: 'var(--st-success)', pulse: true };
      case 'waiting':
        return { color: 'var(--st-warning)', pulse: true };
      case 'error':
        return { color: 'var(--st-danger)', pulse: false };
      default:
        return { color: 'var(--st-text-faint)', pulse: false };
    }
  };

  const config = getConfig(status);

  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${config.pulse ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: config.color }}
      title={status}
    />
  );
});

StatusDot.displayName = 'StatusDot';

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = React.memo(({
  session,
  branchName
}) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.events) return;

    const unsubscribes = [
      window.electronAPI.events.onUpdateAvailable((version) => {
        setUpdateAvailable(true);
        setUpdateVersion(version);
      }),

      window.electronAPI.events.onUpdateDownloaded(() => {
        setDownloading(false);
        const shouldRestart = confirm(
          `Update ${updateVersion} downloaded. Restart now to complete installation?`
        );
        if (shouldRestart) {
          window.electronAPI.updater.install();
        }
      }),
    ];

    return () => unsubscribes.forEach(u => u());
  }, [updateVersion]);

  const handleDownload = async () => {
    setDownloading(true);
    await window.electronAPI.updater.download();
  };

  const handleOpenInFinder = async () => {
    if (session.worktreePath) {
      await window.electronAPI?.invoke('shell:openPath', session.worktreePath);
    }
  };

  return (
    <div
      className="flex items-center justify-between px-3 py-2 st-surface border-b st-hairline"
      style={{
        ['WebkitAppRegion' as never]: 'drag',
        userSelect: 'none',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Session name - primary */}
        <h1 className="text-[13px] font-medium truncate" style={{ color: 'var(--st-text)' }}>
          {session.name}
        </h1>

        {/* Status dot */}
        <StatusDot status={session.status} />

        {/* Branch */}
        <div
          className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded"
          style={{
            color: 'var(--st-text-faint)',
            backgroundColor: 'var(--st-hover)',
          }}
        >
          <GitBranch className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{branchName || 'main'}</span>
        </div>
      </div>

      <div className="flex items-center gap-1" style={{ ['WebkitAppRegion' as never]: 'no-drag' }}>
        {updateAvailable && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 rounded st-hoverable st-focus-ring"
            title={`Update to ${updateVersion}`}
          >
            <Download
              className="w-3.5 h-3.5"
              style={{ color: downloading ? 'var(--st-text-faint)' : 'var(--st-primary)' }}
            />
          </button>
        )}
        <button
          type="button"
          onClick={handleOpenInFinder}
          className="p-1.5 rounded st-hoverable st-focus-ring"
          title="Open in Finder"
        >
          <ExternalLink className="w-3.5 h-3.5" style={{ color: 'var(--st-text-muted)' }} />
        </button>
      </div>
    </div>
  );
});

WorkspaceHeader.displayName = 'WorkspaceHeader';

export default WorkspaceHeader;
