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

interface BackendTranscriptResponse {
  meeting_id: string;
  source_language: string;
  segments: TranscriptSegment[];
  total_segments: number;
  limit: number;
  offset: number;
}

interface BackendTranscriptSearchMatch {
  id: string;
  sequence: number;
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  highlight: string;
  matched_language: string;
  translations?: Array<{ target_language: string; translated_text: string }>;
}

interface BackendTranscriptSearchResponse {
  matches: BackendTranscriptSearchMatch[];
  total_matches: number;
  query: string;
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
  message?: string | undefined;
}

const MARK_START = '<mark>';
const MARK_END = '</mark>';

const toTranscriptResponse = (response: BackendTranscriptResponse): TranscriptResponse => ({
  segments: response.segments,
  total: response.total_segments,
  limit: response.limit,
  offset: response.offset,
});

const parseHighlightMarkup = (markup: string): { text: string; highlights: Array<{ start: number; end: number }> } => {
  const highlights: Array<{ start: number; end: number }> = [];
  let plainText = '';
  let cursor = 0;

  while (cursor < markup.length) {
    const start = markup.indexOf(MARK_START, cursor);
    if (start === -1) {
      plainText += markup.slice(cursor);
      break;
    }

    plainText += markup.slice(cursor, start);
    const highlightedStart = plainText.length;
    const contentStart = start + MARK_START.length;
    const end = markup.indexOf(MARK_END, contentStart);
    if (end === -1) {
      plainText += markup.slice(contentStart);
      break;
    }

    const highlightedText = markup.slice(contentStart, end);
    plainText += highlightedText;
    highlights.push({ start: highlightedStart, end: highlightedStart + highlightedText.length });
    cursor = end + MARK_END.length;
  }

  return { text: plainText, highlights };
};

const toTranscriptSearchResponse = (
  response: BackendTranscriptSearchResponse,
): TranscriptSearchResponse => ({
  results: response.matches.map((match) => {
    const parsedHighlight = parseHighlightMarkup(match.highlight);
    return {
      segment_id: match.id,
      sequence: match.sequence,
      text: parsedHighlight.text || match.text,
      start_time_ms: match.start_time_ms,
      end_time_ms: match.end_time_ms,
      highlights: parsedHighlight.highlights,
    };
  }),
  total: response.total_matches,
  query: response.query,
});

const toGenerateSummaryResponse = (
  response: MeetingSummary | { status: 'processing'; estimated_seconds?: number },
): GenerateSummaryResponse => {
  if ('status' in response && response.status === 'processing') {
    return {
      status: 'processing',
      ...(typeof response.estimated_seconds === 'number'
        ? { message: `Estimated ${response.estimated_seconds} seconds` }
        : {}),
    };
  }

  return {
    status: 'completed',
    summary: response as MeetingSummary,
  };
};

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
    params?: { limit?: number; offset?: number; include_translations?: string },
  ): Promise<TranscriptResponse> => {
    const response = await api.get<BackendTranscriptResponse>(
      `/meetings/${meetingId}/transcript`,
      { params },
    );
    return toTranscriptResponse(response.data);
  },

  getPublicTranscript: async (
    roomCode: string,
    params?: { limit?: number; offset?: number; include_translations?: string },
  ): Promise<TranscriptResponse> => {
    const response = await api.get<BackendTranscriptResponse>(
      `/meetings/join/${roomCode}/transcript`,
      { params },
    );
    return toTranscriptResponse(response.data);
  },

  searchTranscript: async (
    meetingId: string,
    query: string,
  ): Promise<TranscriptSearchResponse> => {
    const response = await api.get<BackendTranscriptSearchResponse>(
      `/meetings/${meetingId}/transcript/search`,
      { params: { q: query } },
    );
    return toTranscriptSearchResponse(response.data);
  },

  searchPublicTranscript: async (
    roomCode: string,
    query: string,
  ): Promise<TranscriptSearchResponse> => {
    const response = await api.get<BackendTranscriptSearchResponse>(
      `/meetings/join/${roomCode}/transcript/search`,
      { params: { q: query } },
    );
    return toTranscriptSearchResponse(response.data);
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

  requestPublicTranslation: async (
    roomCode: string,
    targetLanguage: string,
  ): Promise<TranslationRequestResponse> => {
    const response = await api.post<TranslationRequestResponse>(
      `/meetings/join/${roomCode}/translate`,
      { target_language: targetLanguage },
    );
    return response.data;
  },

  generateSummary: async (
    meetingId: string,
    data: GenerateSummaryRequest = {},
  ): Promise<GenerateSummaryResponse> => {
    const response = await api.post<MeetingSummary | { status: 'processing'; estimated_seconds?: number }>(
      `/meetings/${meetingId}/summary`,
      data,
    );
    return toGenerateSummaryResponse(response.data);
  },

  generatePublicSummary: async (
    roomCode: string,
    data: GenerateSummaryRequest = {},
  ): Promise<GenerateSummaryResponse> => {
    const response = await api.post<MeetingSummary | { status: 'processing'; estimated_seconds?: number }>(
      `/meetings/join/${roomCode}/summary`,
      data,
    );
    return toGenerateSummaryResponse(response.data);
  },

  getSummary: async (meetingId: string): Promise<MeetingSummary> => {
    const response = await api.get<MeetingSummary>(`/meetings/${meetingId}/summary`);
    return response.data;
  },

  getPublicSummary: async (roomCode: string): Promise<MeetingSummary> => {
    const response = await api.get<MeetingSummary>(`/meetings/join/${roomCode}/summary`);
    return response.data;
  },
};

export default meetingApi;
