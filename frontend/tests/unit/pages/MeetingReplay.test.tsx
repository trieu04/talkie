import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';

import MeetingReplay from '../../../src/pages/MeetingReplay';

const { meetingApiMock } = vi.hoisted(() => ({
  meetingApiMock: {
  get: vi.fn(),
  getTranscript: vi.fn(),
  getSummary: vi.fn(),
  requestTranslation: vi.fn(),
  generateSummary: vi.fn(),
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

describe('MeetingReplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApiMock.get.mockResolvedValue({
      id: 'meeting-1',
      room_code: 'ROOM01',
      title: 'Replay Meeting',
      source_language: 'vi',
      status: 'ended',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: 120,
      has_summary: true,
      available_translations: ['en'],
      join_url: 'https://talkie.app/join/ROOM01',
    });
    meetingApiMock.getTranscript.mockResolvedValue({
      segments: [
        {
          id: 'segment-1',
          sequence: 1,
          text: 'Xin chào',
          start_time_ms: 0,
          end_time_ms: 1000,
          translations: [{ target_language: 'en', translated_text: 'Hello' }],
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });
    meetingApiMock.getSummary.mockResolvedValue({
      id: 'summary-1',
      content: 'Summary content',
      key_points: ['Key point'],
      decisions: [],
      action_items: [],
      created_at: new Date().toISOString(),
    });
  });

  it('renders replay transcript and summary data', async () => {
    render(
      <MemoryRouter initialEntries={['/meeting/meeting-1/replay']}>
        <Routes>
          <Route path="/meeting/:id/replay" element={<MeetingReplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(meetingApiMock.get).toHaveBeenCalledWith('meeting-1'));
    expect(await screen.findByText('Replay Meeting')).toBeInTheDocument();
    expect(await screen.findByText('Xin chào')).toBeInTheDocument();
    expect(await screen.findByText('Summary content')).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });
});
