import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { api } from '@/services/api';
import type { CreateMeetingInput, Meeting, MeetingsResponse } from '@/types';

interface MeetingStore {
  currentMeeting: Meeting | null;
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;
  createMeeting: (input: CreateMeetingInput) => Promise<Meeting>;
  fetchMeetings: (params?: { status?: string; limit?: number; offset?: number }) => Promise<void>;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  startRecording: (meetingId: string) => Promise<void>;
  stopRecording: (meetingId: string) => Promise<void>;
}

const upsertMeeting = (meetings: Meeting[], nextMeeting: Meeting): Meeting[] => {
  const existingIndex = meetings.findIndex((meeting) => meeting.id === nextMeeting.id);

  if (existingIndex === -1) {
    return [nextMeeting, ...meetings];
  }

  const updatedMeetings = [...meetings];
  updatedMeetings[existingIndex] = { ...updatedMeetings[existingIndex], ...nextMeeting };
  return updatedMeetings;
};

export const useMeetingStore = create<MeetingStore>()(
  devtools(
    (set, get) => ({
      currentMeeting: null,
      meetings: [],
      isLoading: false,
      error: null,
      async createMeeting(input) {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post<Meeting>('/meetings', {
            title: input.title,
            source_language: input.sourceLanguage,
          });

          const createdMeeting = response.data;

          set((state) => ({
            currentMeeting: createdMeeting,
            meetings: upsertMeeting(state.meetings, createdMeeting),
            isLoading: false,
            error: null,
          }));

          return createdMeeting;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not create meeting.';
          set({ isLoading: false, error: message });
          throw error;
        }
      },
      async fetchMeetings(params) {
        set({ isLoading: true, error: null });

        try {
          const response = await api.get<MeetingsResponse>('/meetings', { params });
          set({ meetings: response.data.meetings, isLoading: false, error: null });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Could not fetch meetings.',
          });
          throw error;
        }
      },
      setCurrentMeeting(meeting) {
        set({ currentMeeting: meeting });
      },
      async startRecording(meetingId) {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post<Pick<Meeting, 'status' | 'started_at'>>(
            `/meetings/${meetingId}/start`,
          );

          const currentMeeting = get().currentMeeting;
          const nextMeeting = currentMeeting
            ? { ...currentMeeting, ...response.data, id: currentMeeting.id }
            : null;

          set((state) => ({
            currentMeeting: nextMeeting,
            meetings: nextMeeting ? upsertMeeting(state.meetings, nextMeeting) : state.meetings,
            isLoading: false,
            error: null,
          }));
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Could not start recording.',
          });
          throw error;
        }
      },
      async stopRecording(meetingId) {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post<Pick<Meeting, 'status' | 'ended_at' | 'duration_seconds'>>(
            `/meetings/${meetingId}/stop`,
          );

          const currentMeeting = get().currentMeeting;
          const nextMeeting = currentMeeting
            ? { ...currentMeeting, ...response.data, id: currentMeeting.id }
            : null;

          set((state) => ({
            currentMeeting: nextMeeting,
            meetings: nextMeeting ? upsertMeeting(state.meetings, nextMeeting) : state.meetings,
            isLoading: false,
            error: null,
          }));
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Could not stop recording.',
          });
          throw error;
        }
      },
    }),
    { name: 'meeting-store' },
  ),
);
