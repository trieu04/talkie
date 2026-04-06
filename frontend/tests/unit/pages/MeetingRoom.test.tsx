import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';

import MeetingRoom from '../../../src/pages/MeetingRoom';

const { meetingApiMock, meetingStoreState, transcriptStoreState, authStoreState } = vi.hoisted(() => ({
  meetingApiMock: {
    get: vi.fn(),
    generateSummary: vi.fn(),
    getSummary: vi.fn(),
  },
  meetingStoreState: {
    currentMeeting: null,
    meetings: [],
    setCurrentMeeting: vi.fn(),
  },
  transcriptStoreState: {
    segments: [],
    translations: {},
    isBackfillInProgress: false,
    clearSegments: vi.fn(),
  },
  authStoreState: {
    accessToken: 'token',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/services/meetingApi', () => ({ meetingApi: meetingApiMock }));
vi.mock('@/hooks/useMeetingWebSocket', () => ({
  useMeetingWebSocket: () => ({
    connectionState: 'connected',
    participantCount: 2,
    sendAudioChunk: vi.fn(),
    sendRecordingControl: vi.fn(),
    setLanguage: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    error: null,
    permissionStatus: 'granted',
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
  }),
}));
vi.mock('@/stores', () => ({
  useAuthStore: (selector: (state: typeof authStoreState) => unknown) => selector(authStoreState),
  useMeetingStore: (selector: (state: typeof meetingStoreState) => unknown) => selector(meetingStoreState),
  useTranscriptStore: (selector: (state: typeof transcriptStoreState) => unknown) => selector(transcriptStoreState),
}));

describe('MeetingRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingStoreState.currentMeeting = {
      id: 'meeting-1',
      room_code: 'ROOM01',
      title: 'Room Meeting',
      source_language: 'vi',
      status: 'created',
      created_at: new Date().toISOString(),
      started_at: null,
      ended_at: null,
      join_url: 'https://talkie.app/join/ROOM01',
    };
    meetingApiMock.get.mockResolvedValue({
      id: 'meeting-1',
      room_code: 'ROOM01',
      title: 'Room Meeting',
      source_language: 'vi',
      status: 'created',
      created_at: new Date().toISOString(),
      started_at: null,
      ended_at: null,
      join_url: 'https://talkie.app/join/ROOM01',
    });
  });

  it('renders meeting details and recording controls', async () => {
    render(
      <MemoryRouter initialEntries={['/meeting/meeting-1']}>
        <Routes>
          <Route path="/meeting/:id" element={<MeetingRoom />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Room Meeting')).toBeInTheDocument();
    expect(screen.getByLabelText('Recording controls')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'recording.start' }));
  });
});
