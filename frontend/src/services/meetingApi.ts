import api from './api';

import type { MeetingStatus, MeetingSummary, TranscriptSegment } from '@/types';

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
  duration_seconds?: number;
  has_transcript?: boolean;
  has_summary?: boolean;
  available_translations?: string[];
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
  has_transcript?: boolean;
  has_summary?: boolean;
  available_translations?: string[];
}

export interface TranscriptResponse {
  segments: TranscriptSegment[];
  total: number;
  limit: number;
  offset: number;
}

export interface TranscriptSearchResult {
  segment_id: string;
  sequence: number;
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  highlights: Array<{ start: number; end: number }>;
}

export interface TranscriptSearchResponse {
  results: TranscriptSearchResult[];
  total: number;
  query: string;
}

export interface TranslationRequestResponse {
  meeting_id: string;
  target_language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  segments_translated?: number;
  total_segments?: number;
}

export interface GenerateSummaryRequest {
  regenerate?: boolean;
}

export interface GenerateSummaryResponse {
  status: 'completed' | 'processing';
  summary?: MeetingSummary;
  message?: string;
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

  getTranscript: async (
    meetingId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<TranscriptResponse> => {
    const response = await api.get<TranscriptResponse>(
      `/meetings/${meetingId}/transcript`,
      { params },
    );
    return response.data;
  },

  searchTranscript: async (
    meetingId: string,
    query: string,
  ): Promise<TranscriptSearchResponse> => {
    const response = await api.get<TranscriptSearchResponse>(
      `/meetings/${meetingId}/transcript/search`,
      { params: { q: query } },
    );
    return response.data;
  },

  requestTranslation: async (
    meetingId: string,
    targetLanguage: string,
  ): Promise<TranslationRequestResponse> => {
    const response = await api.post<TranslationRequestResponse>(
      `/meetings/${meetingId}/translate`,
      { target_language: targetLanguage },
    );
    return response.data;
  },

  generateSummary: async (
    meetingId: string,
    data: GenerateSummaryRequest = {},
  ): Promise<GenerateSummaryResponse> => {
    const response = await api.post<GenerateSummaryResponse>(
      `/meetings/${meetingId}/summary`,
      data,
    );
    return response.data;
  },

  getSummary: async (meetingId: string): Promise<MeetingSummary> => {
    const response = await api.get<MeetingSummary>(`/meetings/${meetingId}/summary`);
    return response.data;
  },
};

export default meetingApi;
