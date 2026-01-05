import React, { useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DiffLine {
  type: 'added' | 'deleted' | 'modified' | 'context' | 'hunk';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffStats {
  additions: number;
  deletions: number;
  fileType: 'added' | 'deleted' | 'modified' | 'renamed';
}

interface FileMeta {
  path: string;
  additions: number;
  deletions: number;
  type: 'added' | 'deleted' | 'modified' | 'renamed';
}

interface ZedDiffViewerProps {
  diff: string;
  filePath?: string;
  filesMeta?: FileMeta[];
  className?: string;
}

// CSS variable references
const css = {
  bg: 'var(--st-diff-bg)',
  headerBg: 'var(--st-diff-header-bg)',
  headerHover: 'var(--st-diff-header-hover)',
  border: 'var(--st-diff-border)',
  borderFaint: 'var(--st-diff-border-faint)',
  text: 'var(--st-diff-text)',
  textStrong: 'var(--st-diff-text-strong)',
  textMuted: 'var(--st-diff-text-muted)',
  gutterFg: 'var(--st-diff-gutter-fg)',
  gutterHoverFg: 'var(--st-diff-gutter-hover-fg)',
  addedMarker: 'var(--st-diff-added-marker)',
  deletedMarker: 'var(--st-diff-deleted-marker)',
  modifiedMarker: 'var(--st-diff-modified-marker)',
  renamedMarker: 'var(--st-diff-renamed-marker)',
  addedBg: 'var(--st-diff-added-bg)',
  deletedBg: 'var(--st-diff-deleted-bg)',
  modifiedBg: 'var(--st-diff-modified-bg)',
  addedBgHover: 'var(--st-diff-added-bg-hover)',
  deletedBgHover: 'var(--st-diff-deleted-bg-hover)',
  modifiedBgHover: 'var(--st-diff-modified-bg-hover)',
  hunkBg: 'var(--st-diff-hunk-bg)',
  hunkText: 'var(--st-diff-hunk-text)',
  fontMono: 'var(--st-font-mono)',
};

// Status icon component (Zed style)
const StatusIcon: React.FC<{ type: DiffStats['fileType']; size?: number }> = ({ type, size = 14 }) => {
  const config: Record<string, { icon: string; color: string }> = {
    added: { icon: '+', color: css.addedMarker },
    modified: { icon: '●', color: css.modifiedMarker },
    deleted: { icon: '−', color: css.deletedMarker },
    renamed: { icon: '→', color: css.renamedMarker },
  };
  const { icon, color } = config[type] || config.modified;

  return (
    <span
      style={{
        color,
        fontSize: size,
        fontWeight: 600,
        width: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
  );
};

// Extract filename and directory from path
const splitPath = (path: string): { name: string; dir: string } => {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return { name: path, dir: '' };
  return {
    name: parts[parts.length - 1],
    dir: parts.slice(0, -1).join('/') + '/',
  };
};

const calculateDiffStats = (diff: string): DiffStats => {
  let additions = 0;
  let deletions = 0;
  let fileType: DiffStats['fileType'] = 'modified';

  if (diff.includes('new file mode')) fileType = 'added';
  else if (diff.includes('deleted file mode')) fileType = 'deleted';
  else if (diff.includes('rename from')) fileType = 'renamed';

  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }

  return { additions, deletions, fileType };
};

const splitDiffIntoFiles = (fullDiff: string): Array<{ path: string; diff: string }> => {
  const chunks = fullDiff.match(/diff --git[\s\S]*?(?=diff --git|$)/g);
  if (!chunks || chunks.length === 0) return [{ path: '', diff: fullDiff }];

  return chunks.map((chunk) => {
    const fileNameMatch = chunk.match(/diff --git a\/(.*?) b\/(.*?)(?:\n|$)/);
    const path = (fileNameMatch?.[2] || fileNameMatch?.[1] || '').trim();
    return { path, diff: chunk };
  });
};

const parseDiffToLines = (diff: string): DiffLine[] => {
  const lines: DiffLine[] = [];
  const diffLines = diff.split('\n');

  let oldLineNum = 0;
  let newLineNum = 0;
  let inHunk = false;

  for (const line of diffLines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hunkMatch) {
      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[3], 10);
      inHunk = true;
      lines.push({ type: 'hunk', content: hunkMatch[5] || '' });
      continue;
    }

    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('new file mode') ||
      line.startsWith('deleted file mode') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode') ||
      line.startsWith('similarity index') ||
      line.startsWith('rename from') ||
      line.startsWith('rename to') ||
      line.startsWith('Binary files')
    ) {
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+')) {
      lines.push({ type: 'added', content: line.substring(1), newLineNumber: newLineNum++ });
    } else if (line.startsWith('-')) {
      lines.push({ type: 'deleted', content: line.substring(1), oldLineNumber: oldLineNum++ });
    } else if (line.startsWith(' ') || line === '') {
      lines.push({
        type: 'context',
        content: line.startsWith(' ') ? line.substring(1) : line,
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
    } else if (line.startsWith('\\')) {
      continue;
    }
  }

  // Heuristic: consecutive delete+add = modified
  const out: DiffLine[] = [];
  let i = 0;
  while (i < lines.length) {
    const current = lines[i];
    if (current.type !== 'deleted') {
      out.push(current);
      i++;
      continue;
    }

    let delEnd = i;
    while (delEnd < lines.length && lines[delEnd].type === 'deleted') delEnd++;

    let addEnd = delEnd;
    while (addEnd < lines.length && lines[addEnd].type === 'added') addEnd++;

    if (addEnd > delEnd) {
      for (let j = i; j < addEnd; j++) out.push({ ...lines[j], type: 'modified' });
      i = addEnd;
      continue;
    }

    out.push(current);
    i++;
  }

  return out;
};

// Hunk header row
const HunkRow: React.FC<{ content: string }> = ({ content }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      height: 28,
      backgroundColor: css.hunkBg,
      borderTop: `1px solid ${css.borderFaint}`,
      borderBottom: `1px solid ${css.borderFaint}`,
      fontFamily: css.fontMono,
      fontSize: 12,
    }}
  >
    <div style={{ width: 3, flexShrink: 0 }} />
    <div
      style={{
        width: 90,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: css.hunkText,
        fontSize: 11,
      }}
    >
      ···
    </div>
    <div
      style={{
        flex: 1,
        paddingLeft: 12,
        color: css.hunkText,
        fontSize: 11,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {content.trim()}
    </div>
  </div>
);

// Single diff line row
const DiffLineRow: React.FC<{ line: DiffLine }> = React.memo(({ line }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (line.type === 'hunk') {
    return <HunkRow content={line.content} />;
  }

  const isChange = line.type === 'added' || line.type === 'deleted' || line.type === 'modified';
  const isDeleted = line.type === 'deleted' || (line.type === 'modified' && line.oldLineNumber && !line.newLineNumber);
  const isAdded = line.type === 'added' || (line.type === 'modified' && line.newLineNumber && !line.oldLineNumber);

  // Background color
  let bg = 'transparent';
  if (isChange) {
    if (line.type === 'added' || (line.type === 'modified' && isAdded)) {
      bg = isHovered ? css.addedBgHover : css.addedBg;
    } else if (line.type === 'deleted' || (line.type === 'modified' && isDeleted)) {
      bg = isHovered ? css.deletedBgHover : css.deletedBg;
    } else if (line.type === 'modified') {
      bg = isHovered ? css.modifiedBgHover : css.modifiedBg;
    }
  } else if (isHovered) {
    bg = css.headerHover;
  }

  // Marker color (left border)
  let marker = 'transparent';
  if (line.type === 'added') marker = css.addedMarker;
  else if (line.type === 'deleted') marker = css.deletedMarker;
  else if (line.type === 'modified') {
    marker = isDeleted ? css.deletedMarker : isAdded ? css.addedMarker : css.modifiedMarker;
  }

  const textColor = isChange ? css.textStrong : css.text;
  const lineNumColor = isHovered ? css.gutterHoverFg : css.gutterFg;

  return (
    <div
      style={{
        display: 'flex',
        fontFamily: css.fontMono,
        fontSize: 12,
        lineHeight: '20px',
        backgroundColor: bg,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left marker */}
      <div style={{ width: 3, flexShrink: 0, backgroundColor: marker }} />

      {/* Old line number */}
      <div
        style={{
          width: 45,
          flexShrink: 0,
          textAlign: 'right',
          paddingRight: 8,
          color: lineNumColor,
          userSelect: 'none',
          backgroundColor: css.bg,
        }}
      >
        {line.oldLineNumber ?? ''}
      </div>

      {/* New line number */}
      <div
        style={{
          width: 45,
          flexShrink: 0,
          textAlign: 'right',
          paddingRight: 8,
          color: lineNumColor,
          userSelect: 'none',
          borderRight: `1px solid ${css.borderFaint}`,
          backgroundColor: css.bg,
        }}
      >
        {line.newLineNumber ?? ''}
      </div>

      {/* Code content */}
      <div
        style={{
          flex: 1,
          paddingLeft: 12,
          paddingRight: 16,
          whiteSpace: 'pre',
          color: textColor,
          overflow: 'hidden',
        }}
      >
        {line.content || '\u00A0'}
      </div>
    </div>
  );
});

DiffLineRow.displayName = 'DiffLineRow';

// File header component
const FileHeader: React.FC<{
  name: string;
  dir: string;
  stats: DiffStats;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ name, dir, stats, collapsed, onToggle }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isDeleted = stats.fileType === 'deleted';

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        backgroundColor: isHovered ? css.headerHover : css.headerBg,
        borderBottom: `1px solid ${css.borderFaint}`,
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: css.fontMono,
        fontSize: 12,
        transition: 'background-color 0.1s ease',
      }}
    >
      {/* Collapse chevron */}
      <span style={{ color: css.textMuted, display: 'flex', alignItems: 'center' }}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </span>

      {/* Status icon */}
      <StatusIcon type={stats.fileType} />

      {/* File name (prominent) */}
      <span
        style={{
          color: isDeleted ? css.textMuted : css.textStrong,
          textDecoration: isDeleted ? 'line-through' : 'none',
          fontWeight: 500,
        }}
      >
        {name}
      </span>

      {/* Directory path (muted) */}
      {dir && (
        <span
          style={{
            color: css.textMuted,
            textDecoration: isDeleted ? 'line-through' : 'none',
          }}
        >
          {dir}
        </span>
      )}

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Stats */}
      <span style={{ display: 'flex', gap: 8, fontSize: 11 }}>
        {stats.additions > 0 && (
          <span style={{ color: css.addedMarker }}>+{stats.additions}</span>
        )}
        {stats.deletions > 0 && (
          <span style={{ color: css.deletedMarker }}>−{stats.deletions}</span>
        )}
      </span>
    </button>
  );
};

export const ZedDiffViewer: React.FC<ZedDiffViewerProps> = ({
  diff,
  filePath,
  filesMeta,
  className = '',
}) => {
  const metaByPath = useMemo(() => {
    const map = new Map<string, FileMeta>();
    for (const m of filesMeta ?? []) map.set(m.path, m);
    return map;
  }, [filesMeta]);

  const orderIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (const [idx, m] of (filesMeta ?? []).entries()) map.set(m.path, idx);
    return map;
  }, [filesMeta]);

  const entries = useMemo(() => {
    const raw = filePath
      ? [{ path: filePath, diff }]
      : splitDiffIntoFiles(diff).filter((s) => s.diff.trim() !== '');

    return raw
      .map((e) => {
        const displayPath = e.path || '(unknown)';
        const { name, dir } = splitPath(displayPath);
        const meta = metaByPath.get(e.path) ?? metaByPath.get(displayPath);
        const stats = meta
          ? { additions: meta.additions, deletions: meta.deletions, fileType: meta.type }
          : calculateDiffStats(e.diff);
        const lines = parseDiffToLines(e.diff);
        const isBinary = e.diff.includes('Binary files');

        return {
          path: e.path,
          displayPath,
          name,
          dir,
          stats,
          lines,
          isBinary,
          order: orderIndex.get(e.path) ?? orderIndex.get(displayPath) ?? Number.MAX_SAFE_INTEGER,
          key: e.path || e.diff.slice(0, 32),
        };
      })
      .sort((a, b) => a.order - b.order || a.displayPath.localeCompare(b.displayPath));
  }, [diff, filePath, metaByPath, orderIndex]);

  const [collapsedByPath, setCollapsedByPath] = useState<Record<string, boolean>>({});
  const toggleCollapsed = useCallback((path: string) => {
    setCollapsedByPath((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  if (!diff || diff.trim() === '' || entries.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full text-sm ${className}`}
        style={{ backgroundColor: css.bg, color: css.textMuted }}
      >
        No changes to display
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`} style={{ backgroundColor: css.bg }}>
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: 'max-content', backgroundColor: css.bg }}>
          {entries.map((entry) => {
            const collapsed = collapsedByPath[entry.path] ?? false;

            return (
              <div key={entry.key}>
                <FileHeader
                  name={entry.name}
                  dir={entry.dir}
                  stats={entry.stats}
                  collapsed={collapsed}
                  onToggle={() => toggleCollapsed(entry.path)}
                />

                {!collapsed && (
                  <div style={{ backgroundColor: css.bg }}>
                    {entry.isBinary ? (
                      <div
                        style={{
                          padding: '12px 16px',
                          fontSize: 12,
                          color: css.textMuted,
                          fontFamily: css.fontMono,
                        }}
                      >
                        Binary file
                      </div>
                    ) : entry.lines.length === 0 ? (
                      <div
                        style={{
                          padding: '12px 16px',
                          fontSize: 12,
                          color: css.textMuted,
                          fontFamily: css.fontMono,
                        }}
                      >
                        Empty file
                      </div>
                    ) : (
                      entry.lines.map((line, idx) => (
                        <DiffLineRow key={`${entry.path}:${idx}`} line={line} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ZedDiffViewer;
