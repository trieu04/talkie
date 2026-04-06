import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from '@/services/api';
import { useMeetingStore } from '@/stores/meetingStore';
import type { Meeting } from '@/types';

const createMockMeeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: '1',
  room_code: 'ABC123',
  title: 'Test Meeting',
  source_language: 'en',
  status: 'created',
  ...overrides,
});

describe('meetingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMeetingStore.setState({
      currentMeeting: null,
      meetings: [],
      isLoading: false,
      error: null,
    });
  });

  it('has initial state with empty meetings array', () => {
    const state = useMeetingStore.getState();
    expect(state.meetings).toEqual([]);
    expect(state.currentMeeting).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('createMeeting adds meeting to list', async () => {
    const mockMeeting = createMockMeeting();
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockMeeting });

    const result = await useMeetingStore.getState().createMeeting({
      title: 'Test Meeting',
      sourceLanguage: 'en',
    });

    expect(result).toEqual(mockMeeting);
    expect(useMeetingStore.getState().meetings).toContainEqual(mockMeeting);
    expect(useMeetingStore.getState().currentMeeting).toEqual(mockMeeting);
  });

  it('fetchMeetings populates meetings array', async () => {
    const mockMeetings = [createMockMeeting({ id: '1' }), createMockMeeting({ id: '2' })];
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { meetings: mockMeetings, total: 2, limit: 10, offset: 0 },
    });

    await useMeetingStore.getState().fetchMeetings();

    expect(useMeetingStore.getState().meetings).toEqual(mockMeetings);
    expect(useMeetingStore.getState().isLoading).toBe(false);
  });

  it('setCurrentMeeting updates currentMeeting', () => {
    const mockMeeting = createMockMeeting();

    useMeetingStore.getState().setCurrentMeeting(mockMeeting);

    expect(useMeetingStore.getState().currentMeeting).toEqual(mockMeeting);
  });

  it('startRecording updates meeting status', async () => {
    const mockMeeting = createMockMeeting({ status: 'created' });
    useMeetingStore.setState({ currentMeeting: mockMeeting, meetings: [mockMeeting] });

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { status: 'recording', started_at: '2024-01-01T10:00:00Z' },
    });

    await useMeetingStore.getState().startRecording('1');

    const state = useMeetingStore.getState();
    expect(state.currentMeeting?.status).toBe('recording');
    expect(state.currentMeeting?.started_at).toBe('2024-01-01T10:00:00Z');
    expect(state.isLoading).toBe(false);
  });

  it('stopRecording updates meeting status', async () => {
    const mockMeeting = createMockMeeting({ status: 'recording' });
    useMeetingStore.setState({ currentMeeting: mockMeeting, meetings: [mockMeeting] });

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { status: 'ended', ended_at: '2024-01-01T11:00:00Z', duration_seconds: 3600 },
    });

    await useMeetingStore.getState().stopRecording('1');

    const state = useMeetingStore.getState();
    expect(state.currentMeeting?.status).toBe('ended');
    expect(state.currentMeeting?.ended_at).toBe('2024-01-01T11:00:00Z');
    expect(state.currentMeeting?.duration_seconds).toBe(3600);
    expect(state.isLoading).toBe(false);
  });

  it('createMeeting handles errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      useMeetingStore.getState().createMeeting({ title: 'Test', sourceLanguage: 'en' }),
    ).rejects.toThrow('Network error');

    expect(useMeetingStore.getState().error).toBe('Network error');
    expect(useMeetingStore.getState().isLoading).toBe(false);
  });
});
