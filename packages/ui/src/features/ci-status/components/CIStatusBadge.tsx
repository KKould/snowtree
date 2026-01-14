import React from 'react';
import { Check, X, Loader2, Clock, Circle } from 'lucide-react';
import type { CIStatus, CIRollupState } from '../types';

interface CIStatusBadgeProps {
  status: CIStatus;
  onClick?: (e: React.MouseEvent) => void;
  expanded?: boolean;
}

const stateConfig: Record<
  CIRollupState,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  success: {
    icon: Check,
    color: 'var(--st-success)',
    bg: 'color-mix(in srgb, var(--st-success) 15%, transparent)',
    label: 'passed',
  },
  failure: {
    icon: X,
    color: 'var(--st-danger)',
    bg: 'color-mix(in srgb, var(--st-danger) 15%, transparent)',
    label: 'failed',
  },
  in_progress: {
    icon: Loader2,
    color: 'var(--st-accent)',
    bg: 'color-mix(in srgb, var(--st-accent) 15%, transparent)',
    label: 'running',
  },
  pending: {
    icon: Clock,
    color: 'var(--st-text-muted)',
    bg: 'color-mix(in srgb, var(--st-text-muted) 15%, transparent)',
    label: 'pending',
  },
  neutral: {
    icon: Circle,
    color: 'var(--st-text-muted)',
    bg: 'color-mix(in srgb, var(--st-text-muted) 15%, transparent)',
    label: 'neutral',
  },
};

export const CIStatusBadge: React.FC<CIStatusBadgeProps> = ({
  status,
  onClick,
  expanded,
}) => {
  const config = stateConfig[status.rollupState];
  const Icon = config.icon;
  const isAnimated = status.rollupState === 'in_progress';

  // Show count for failure or when there are multiple checks
  const showCount =
    status.rollupState === 'failure' ||
    (status.totalCount > 1 && status.rollupState !== 'success');

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all duration-75 st-hoverable st-focus-ring"
      style={{
        backgroundColor: config.bg,
        color: config.color,
      }}
      title={`CI: ${status.successCount}/${status.totalCount} checks passed`}
    >
      <Icon
        className={`w-3 h-3 ${isAnimated ? 'animate-spin' : ''}`}
        strokeWidth={2.5}
      />
      <span>CI</span>
      {showCount && (
        <span className="font-mono">
          {status.rollupState === 'failure'
            ? `${status.failureCount}/${status.totalCount}`
            : `${status.successCount}/${status.totalCount}`}
        </span>
      )}
      {onClick && (
        <span
          className={`ml-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          style={{ fontSize: '8px' }}
        >
          ▼
        </span>
      )}
    </button>
  );
};
