import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';

import JoinMeeting from '../../../src/pages/JoinMeeting';

const { meetingApiMock } = vi.hoisted(() => ({
  meetingApiMock: {
  join: vi.fn(),
  getPublicTranscript: vi.fn(),
  getPublicSummary: vi.fn(),
  requestPublicTranslation: vi.fn(),
  generatePublicSummary: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'replay.segmentCount' && options) {
        return `${options.loaded}/${options.total}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/services/meetingApi', () => ({
  meetingApi: meetingApiMock,
}));

vi.mock('@/hooks/useMeetingWebSocket', () => ({
  useMeetingWebSocket: () => ({
    connectionState: 'connected',
    participantCount: 3,
    setLanguage: vi.fn(),
  }),
}));

describe('JoinMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApiMock.join.mockResolvedValue({
      meeting_id: 'meeting-1',
      title: 'Ended Meeting',
      source_language: 'vi',
      status: 'ended',
      started_at: new Date().toISOString(),
      websocket_url: 'ws://localhost/ws',
      has_summary: true,
      available_translations: ['en'],
    });
    meetingApiMock.getPublicTranscript.mockResolvedValue({
      segments: [
        {
          id: 'segment-1',
          sequence: 1,
          text: 'Đã kết thúc',
          start_time_ms: 0,
          end_time_ms: 1500,
          translations: [{ target_language: 'en', translated_text: 'Ended' }],
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });
    meetingApiMock.getPublicSummary.mockResolvedValue({
      id: 'summary-1',
      content: 'Public summary',
      key_points: [],
      decisions: [],
      action_items: [],
      created_at: new Date().toISOString(),
    });
  });

  it('loads ended-meeting replay via public endpoints', async () => {
    render(
      <MemoryRouter initialEntries={['/join/ROOM01']}>
        <Routes>
          <Route path="/join/:roomCode" element={<JoinMeeting />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(meetingApiMock.join).toHaveBeenCalledWith('ROOM01'));
    expect(await screen.findByText('Ended Meeting')).toBeInTheDocument();
  });
});
