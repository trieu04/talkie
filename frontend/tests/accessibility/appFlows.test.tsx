import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Login from '../../src/pages/Login';
import Register from '../../src/pages/Register';
import TranscriptView from '../../src/components/TranscriptView';
import RecordingControls from '../../src/components/RecordingControls';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    register: vi.fn(),
    isLoading: false,
    isAuthenticated: false,
    error: null,
    setError: vi.fn(),
  }),
}));

describe('accessibility coverage', () => {
  it('login and register expose labeled form controls', () => {
    const { rerender } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('common.email')).toBeInTheDocument();
    expect(screen.getByLabelText('common.password')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('common.displayName')).toBeInTheDocument();
    expect(screen.getAllByLabelText('common.password').length).toBeGreaterThan(0);
  });

  it('transcript and recording surfaces expose live regions', () => {
    render(
      <>
        <TranscriptView segments={[]} />
        <RecordingControls
          status="recording"
          isConnected
          isRecording
          permissionStatus="granted"
          startedAt={new Date().toISOString()}
          onStart={vi.fn()}
          onStop={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });
});
