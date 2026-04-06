import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import MeetingReplay from '../../src/pages/MeetingReplay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'meeting-1' }),
  };
});

vi.mock('../../src/services/meetingApi', () => ({
  meetingApi: {
    get: vi.fn().mockResolvedValue({
      id: 'meeting-1',
      room_code: 'ROOM01',
      title: 'Replay Meeting',
      source_language: 'vi',
      status: 'ended',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      has_summary: false,
      join_url: 'https://talkie.app/join/ROOM01',
    }),
    getTranscript: vi.fn().mockResolvedValue({ segments: [], total: 0, limit: 100, offset: 0 }),
    getSummary: vi.fn(),
    requestTranslation: vi.fn(),
    generateSummary: vi.fn(),
  },
}));

describe('replay load performance', () => {
  it('renders the replay shell quickly for local mocked data', () => {
    const startedAt = performance.now();
    render(<MeetingReplay />);
    const elapsedMs = performance.now() - startedAt;
    expect(elapsedMs).toBeLessThan(3000);
  });
});
