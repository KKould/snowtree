import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CIStatusBadge } from './CIStatusBadge';
import type { CIStatus } from '../types';

describe('CIStatusBadge', () => {
  const createMockStatus = (overrides: Partial<CIStatus> = {}): CIStatus => ({
    rollupState: 'success',
    checks: [],
    totalCount: 3,
    successCount: 3,
    failureCount: 0,
    pendingCount: 0,
    ...overrides,
  });

  it('renders success state correctly', () => {
    const status = createMockStatus({ rollupState: 'success' });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByTitle('CI: 3/3 checks passed')).toBeInTheDocument();
  });

  it('renders failure state with count', () => {
    const status = createMockStatus({
      rollupState: 'failure',
      successCount: 2,
      failureCount: 1,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument(); // Shows failure count
  });

  it('renders in_progress state', () => {
    const status = createMockStatus({
      rollupState: 'in_progress',
      successCount: 1,
      pendingCount: 2,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument(); // Shows success count when in progress
  });

  it('renders pending state', () => {
    const status = createMockStatus({
      rollupState: 'pending',
      successCount: 0,
      pendingCount: 3,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
  });

  it('renders neutral state', () => {
    const status = createMockStatus({
      rollupState: 'neutral',
      successCount: 0,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
  });

  it('does not show count for single success check', () => {
    const status = createMockStatus({
      rollupState: 'success',
      totalCount: 1,
      successCount: 1,
    });
    render(<CIStatusBadge status={status} />);

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.queryByText('1/1')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    render(<CIStatusBadge status={status} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows expand indicator when onClick is provided', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    render(<CIStatusBadge status={status} onClick={onClick} />);

    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('does not show expand indicator when onClick is not provided', () => {
    const status = createMockStatus();
    render(<CIStatusBadge status={status} />);

    expect(screen.queryByText('▼')).not.toBeInTheDocument();
  });

  it('rotates expand indicator when expanded', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    render(<CIStatusBadge status={status} onClick={onClick} expanded={true} />);

    const indicator = screen.getByText('▼');
    expect(indicator).toHaveClass('rotate-180');
  });

  it('does not rotate expand indicator when not expanded', () => {
    const onClick = vi.fn();
    const status = createMockStatus();
    render(<CIStatusBadge status={status} onClick={onClick} expanded={false} />);

    const indicator = screen.getByText('▼');
    expect(indicator).not.toHaveClass('rotate-180');
  });
});
