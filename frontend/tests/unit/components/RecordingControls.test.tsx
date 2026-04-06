import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecordingControls from '@/components/RecordingControls';
import type { RecordingControlsProps } from '@/components/RecordingControls';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps: RecordingControlsProps = {
  status: 'created',
  isConnected: true,
  isRecording: false,
  permissionStatus: 'granted',
  startedAt: null,
  onStart: vi.fn(),
  onStop: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
};

describe('RecordingControls', () => {
  it('shows start button when status is created', () => {
    render(<RecordingControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'recording.start' })).toBeInTheDocument();
  });

  it('shows pause and stop buttons when recording', () => {
    render(
      <RecordingControls
        {...defaultProps}
        status="recording"
        isRecording
      />
    );

    expect(screen.getByRole('button', { name: 'recording.pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'recording.stop' })).toBeInTheDocument();
  });

  it('shows resume and stop buttons when paused', () => {
    render(
      <RecordingControls
        {...defaultProps}
        status="paused"
        isRecording
      />
    );

    expect(screen.getByRole('button', { name: 'recording.resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'recording.stop' })).toBeInTheDocument();
  });

  it('displays connection status indicator', () => {
    render(<RecordingControls {...defaultProps} />);
    expect(screen.getByText('recording.connected')).toBeInTheDocument();
  });

  it('displays disconnected status when not connected', () => {
    render(<RecordingControls {...defaultProps} isConnected={false} />);
    expect(screen.getByText('recording.disconnected')).toBeInTheDocument();
  });

  it('displays elapsed time when recording', () => {
    render(
      <RecordingControls
        {...defaultProps}
        status="recording"
        isRecording
        startedAt={new Date().toISOString()}
      />
    );

    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('shows error alert when error prop is set', () => {
    render(<RecordingControls {...defaultProps} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onStart when start button clicked', () => {
    const onStart = vi.fn();
    render(<RecordingControls {...defaultProps} onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: 'recording.start' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when stop button clicked', () => {
    const onStop = vi.fn();
    render(
      <RecordingControls
        {...defaultProps}
        status="recording"
        isRecording
        onStop={onStop}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'recording.stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when pause button clicked', () => {
    const onPause = vi.fn();
    render(
      <RecordingControls
        {...defaultProps}
        status="recording"
        isRecording
        onPause={onPause}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'recording.pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });
});
