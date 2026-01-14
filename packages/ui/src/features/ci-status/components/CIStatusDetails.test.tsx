import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CIStatusDetails } from './CIStatusDetails';
import type { CICheck } from '../types';

describe('CIStatusDetails', () => {
  const createMockCheck = (overrides: Partial<CICheck> = {}): CICheck => ({
    id: 1,
    name: 'test-check',
    status: 'completed',
    conclusion: 'success',
    startedAt: '2026-01-14T05:25:00Z',
    completedAt: '2026-01-14T05:30:00Z',
    detailsUrl: 'https://github.com/test/repo/actions/runs/123',
    ...overrides,
  });

  it('renders empty state when no checks', () => {
    render(<CIStatusDetails checks={[]} />);
    expect(screen.getByText('No checks')).toBeInTheDocument();
  });

  it('renders check names', () => {
    const checks = [
      createMockCheck({ id: 1, name: 'build' }),
      createMockCheck({ id: 2, name: 'test' }),
      createMockCheck({ id: 3, name: 'lint' }),
    ];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('build')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('lint')).toBeInTheDocument();
  });

  it('renders success status label', () => {
    const checks = [createMockCheck({ conclusion: 'success' })];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('success')).toBeInTheDocument();
  });

  it('renders failure status label', () => {
    const checks = [createMockCheck({ conclusion: 'failure' })];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('failure')).toBeInTheDocument();
  });

  it('renders running status for in_progress checks', () => {
    const checks = [
      createMockCheck({
        status: 'in_progress',
        conclusion: null,
        completedAt: null,
      }),
    ];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('renders pending status for queued checks', () => {
    const checks = [
      createMockCheck({
        status: 'queued',
        conclusion: null,
        completedAt: null,
      }),
    ];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders skipped status', () => {
    const checks = [createMockCheck({ conclusion: 'skipped' })];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('skipped')).toBeInTheDocument();
  });

  it('renders cancelled status', () => {
    const checks = [createMockCheck({ conclusion: 'cancelled' })];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('cancelled')).toBeInTheDocument();
  });

  it('calls onCheckClick when check with URL is clicked', () => {
    const onCheckClick = vi.fn();
    const check = createMockCheck({ detailsUrl: 'https://github.com/test' });
    render(<CIStatusDetails checks={[check]} onCheckClick={onCheckClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onCheckClick).toHaveBeenCalledWith(check);
  });

  it('does not call onCheckClick when check without URL is clicked', () => {
    const onCheckClick = vi.fn();
    const check = createMockCheck({ detailsUrl: null });
    render(<CIStatusDetails checks={[check]} onCheckClick={onCheckClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onCheckClick).not.toHaveBeenCalled();
  });

  it('disables button when check has no URL', () => {
    const check = createMockCheck({ detailsUrl: null });
    render(<CIStatusDetails checks={[check]} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('enables button when check has URL', () => {
    const check = createMockCheck({ detailsUrl: 'https://github.com/test' });
    render(<CIStatusDetails checks={[check]} />);

    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('renders multiple checks in order', () => {
    const checks = [
      createMockCheck({ id: 1, name: 'first' }),
      createMockCheck({ id: 2, name: 'second' }),
      createMockCheck({ id: 3, name: 'third' }),
    ];
    render(<CIStatusDetails checks={checks} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('renders check with neutral conclusion', () => {
    const checks = [createMockCheck({ conclusion: 'neutral' })];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('neutral')).toBeInTheDocument();
  });

  it('renders check with timed_out conclusion', () => {
    const checks = [createMockCheck({ conclusion: 'timed_out' })];
    render(<CIStatusDetails checks={checks} />);

    expect(screen.getByText('timed_out')).toBeInTheDocument();
  });
});
