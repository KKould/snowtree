import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';

interface ErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  error: string;
  details?: string;
  command?: string;
}

export function ErrorDialog({
  isOpen,
  onClose,
  title = 'Command Failed',
  error,
  details,
  command
}: ErrorDialogProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  if (!isOpen) return null;

  const shouldCollapse = Boolean(details && details.length > 500);
  const displayDetails = shouldCollapse && !isDetailsExpanded
    ? `${details?.substring(0, 400)}...`
    : details;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div
        className="w-full max-w-3xl rounded-xl border shadow-2xl overflow-hidden"
        style={{
          borderColor: 'color-mix(in srgb, var(--st-border) 70%, transparent)',
          backgroundColor: 'var(--st-surface)',
          color: 'var(--st-text)',
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'color-mix(in srgb, var(--st-border) 70%, transparent)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--st-danger)' }} />
            <div className="text-sm font-medium truncate" style={{ color: 'var(--st-text)' }}>{title}</div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded st-hoverable st-focus-ring" title="Close">
            <X className="w-4 h-4" style={{ color: 'var(--st-text-faint)' }} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--st-text-muted)' }}>{error}</div>

          {command && (
            <div>
              <div className="text-xs mb-1 st-text-faint">Command</div>
              <pre
                className="text-xs font-mono rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--st-editor) 70%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--st-border) 70%, transparent)',
                  color: 'var(--st-text)',
                }}
              >
                {command}
              </pre>
            </div>
          )}

          {details && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs st-text-faint">Details</div>
                {shouldCollapse && (
                  <button
                    type="button"
                    onClick={() => setIsDetailsExpanded((prev) => !prev)}
                    className="text-xs flex items-center gap-1 st-hoverable st-focus-ring"
                    style={{ color: 'var(--st-text-muted)' }}
                  >
                    <span>{isDetailsExpanded ? 'Show less' : 'Show more'}</span>
                    {isDetailsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <pre
                className="text-xs font-mono rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words border"
                style={{
                  color: 'var(--st-danger)',
                  backgroundColor: 'color-mix(in srgb, var(--st-danger) 14%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--st-danger) 30%, transparent)',
                }}
              >
                {displayDetails}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
