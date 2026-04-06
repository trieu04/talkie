export type AppLanguage = 'vi' | 'en';

export type MeetingStatus =
  | 'created'
  | 'recording'
  | 'paused'
  | 'ended'
  | 'ended_abnormal';

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  displayName: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface Meeting {
  id: string;
  room_code: string;
  title: string | null;
  source_language: string;
  status: MeetingStatus;
  created_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number;
  has_transcript?: boolean;
  has_summary?: boolean;
  join_url?: string;
  participant_count?: number;
  transcript_segment_count?: number;
  available_translations?: string[];
}

export interface MeetingsResponse {
  meetings: Meeting[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateMeetingInput {
  title: string;
  sourceLanguage: string;
}

export interface TranscriptSegment {
  id: string;
  sequence: number;
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  is_partial?: boolean;
  confidence?: number;
  translations?: Array<{
    target_language: string;
    translated_text: string;
  }>;
}

export type TranslationMap = Record<string, Record<string, string>>;

export interface WebSocketEnvelope<TPayload = Record<string, unknown>> {
  type: string;
  payload: TPayload;
  timestamp?: string;
  message_id?: string;
}

export type WebSocketConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface WebSocketConnectOptions {
  role: 'host' | 'participant';
  meetingId: string;
  accessToken?: string;
  roomCode?: string;
}

export interface MeetingSummaryDecision {
  decision: string;
  context: string;
}

export interface MeetingSummaryActionItem {
  task: string;
  assignee: string | null;
  deadline: string | null;
}

export interface MeetingSummary {
  id: string;
  content: string;
  key_points: string[];
  decisions: MeetingSummaryDecision[];
  action_items: MeetingSummaryActionItem[];
  created_at: string;
}

export interface ApiErrorResponse {
  detail?: string | { message?: string };
  message?: string;
}
