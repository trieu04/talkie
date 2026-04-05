import api from './api';

import type { MeetingStatus } from '@/types';

export interface MeetingCreate {
  title?: string;
  source_language?: string;
}

export interface MeetingResponse {
  id: string;
  room_code: string;
  title: string | null;
  source_language: string;
  status: MeetingStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  join_url: string;
}

export interface MeetingListResponse {
  meetings: MeetingResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface StartRecordingResponse {
  status: string;
  started_at: string;
  websocket_url: string;
}

export interface StopRecordingResponse {
  status: string;
  ended_at: string;
  duration_seconds: number;
  pending_chunks: number;
}

export interface JoinMeetingResponse {
  meeting_id: string;
  title: string | null;
  source_language: string;
  status: string;
  started_at: string | null;
  websocket_url: string;
}

export const meetingApi = {
  create: async (data: MeetingCreate): Promise<MeetingResponse> => {
    const response = await api.post<MeetingResponse>('/meetings', data);
    return response.data;
  },

  list: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<MeetingListResponse> => {
    const response = await api.get<MeetingListResponse>('/meetings', { params });
    return response.data;
  },

  get: async (meetingId: string): Promise<MeetingResponse> => {
    const response = await api.get<MeetingResponse>(`/meetings/${meetingId}`);
    return response.data;
  },

  start: async (meetingId: string): Promise<StartRecordingResponse> => {
    const response = await api.post<StartRecordingResponse>(`/meetings/${meetingId}/start`);
    return response.data;
  },

  stop: async (meetingId: string): Promise<StopRecordingResponse> => {
    const response = await api.post<StopRecordingResponse>(`/meetings/${meetingId}/stop`);
    return response.data;
  },

  join: async (roomCode: string): Promise<JoinMeetingResponse> => {
    const response = await api.get<JoinMeetingResponse>(`/meetings/join/${roomCode}`);
    return response.data;
  },
};

export default meetingApi;
