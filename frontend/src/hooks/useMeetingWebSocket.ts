import { useCallback, useEffect, useRef, useState } from 'react';

import { WebSocketService } from '@/services/websocket';
import { useMeetingStore } from '@/stores/meetingStore';
import { useTranscriptStore } from '@/stores/transcriptStore';
import type { Meeting, WebSocketConnectionState, WebSocketEnvelope } from '@/types';

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 30_000;

export interface UseMeetingWebSocketOptions {
  meetingId: string;
  token: string;
  role: 'host' | 'participant';
  roomCode?: string;
  onSegment?: (segment: TranscriptSegment) => void;
  onSegmentUpdate?: (segment: TranscriptSegment) => void;
  onSegmentFinalized?: (segment: TranscriptSegment) => void;
  onRecordingStarted?: () => void;
  onRecordingStopped?: () => void;
  onParticipantCountChanged?: (count: number) => void;
  onProcessingStatus?: (status: ProcessingStatus) => void;
}

export interface TranscriptSegment {
  id: string;
  sequence: number;
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  is_partial: boolean;
  confidence: number | null;
}

export interface ProcessingStatus {
  pending_chunks: number;
  workers_online: number;
  estimated_delay_seconds: number;
}

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface UseMeetingWebSocketReturn {
  connectionState: ConnectionState;
  participantCount: number;
  lastSequence: number;
  connect: () => void;
  disconnect: () => void;
  sendAudioChunk: (
    data: ArrayBuffer,
    sequence: number,
    durationMs: number,
    isFinal?: boolean,
  ) => void;
  sendRecordingControl: (action: 'start' | 'pause' | 'resume' | 'stop') => void;
  sendSyncRequest: (lastSequence: number, targetLanguage?: string) => void;
  setLanguage: (targetLanguage: string | null) => void;
}

type RawPayload = Record<string, unknown>;

const mapConnectionState = (state: WebSocketConnectionState): ConnectionState => {
  if (state === 'idle') {
    return 'disconnected';
  }

  return state;
};

const toBase64 = (data: ArrayBuffer): string => {
  const bytes = new Uint8Array(data);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

const asRecord = (value: unknown): RawPayload =>
  typeof value === 'object' && value !== null ? (value as RawPayload) : {};

const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const normalizeSegment = (payload: unknown, isPartialOverride?: boolean): TranscriptSegment | null => {
  const raw = asRecord(payload);
  const source = 'segment' in raw ? asRecord(raw.segment) : raw;
  const id = asString(source.id);
  const sequence = asNumber(source.sequence);
  const text = asString(source.text);
  const startTimeMs = asNumber(source.start_time_ms);
  const endTimeMs = asNumber(source.end_time_ms);

  if (!id || sequence === null || text === null || startTimeMs === null || endTimeMs === null) {
    return null;
  }

  const isPartial =
    typeof isPartialOverride === 'boolean'
      ? isPartialOverride
      : typeof source.is_partial === 'boolean'
        ? source.is_partial
        : false;

  return {
    id,
    sequence,
    text,
    start_time_ms: startTimeMs,
    end_time_ms: endTimeMs,
    is_partial: isPartial,
    confidence: asNumber(source.confidence),
  };
};

const toStoreSegment = (segment: TranscriptSegment) => ({
  id: segment.id,
  sequence: segment.sequence,
  text: segment.text,
  start_time_ms: segment.start_time_ms,
  end_time_ms: segment.end_time_ms,
  is_partial: segment.is_partial,
  ...(segment.confidence !== null ? { confidence: segment.confidence } : {}),
});

const mergeMeetingPatch = (
  meetings: Meeting[],
  meetingId: string,
  patch: Partial<Meeting>,
): Meeting[] => {
  const index = meetings.findIndex((meeting) => meeting.id === meetingId);

  if (index === -1) {
    return meetings;
  }

  const nextMeetings = [...meetings];
  const currentMeeting = nextMeetings[index];

  if (!currentMeeting) {
    return meetings;
  }

  nextMeetings[index] = { ...currentMeeting, ...patch };
  return nextMeetings;
};

export const useMeetingWebSocket = (
  options: UseMeetingWebSocketOptions,
): UseMeetingWebSocketReturn => {
  const serviceRef = useRef<WebSocketService | null>(null);
  const optionsRef = useRef(options);
  const lastSequenceRef = useRef(0);
  const participantCountRef = useRef(0);
  const targetLanguageRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const lastPongAtRef = useRef<number>(Date.now());
  const hasConnectedOnceRef = useRef(false);
  const shouldReconnectSyncRef = useRef(false);

  if (!serviceRef.current) {
    serviceRef.current = new WebSocketService();
  }

  optionsRef.current = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [participantCount, setParticipantCount] = useState(0);
  const [lastSequence, setLastSequence] = useState(0);

  const updateMeetingStore = useCallback(
    (patch: Partial<Meeting>) => {
      useMeetingStore.setState((state) => {
        const currentMeeting = state.currentMeeting;

        return {
          currentMeeting:
            currentMeeting && currentMeeting.id === options.meetingId
              ? { ...currentMeeting, ...patch }
              : currentMeeting,
          meetings: mergeMeetingPatch(state.meetings, options.meetingId, patch),
        };
      });
    },
    [options.meetingId],
  );

  const updateLastSequence = useCallback((sequence: number) => {
    lastSequenceRef.current = Math.max(lastSequenceRef.current, sequence);
    setLastSequence(lastSequenceRef.current);
  }, []);

  const updateParticipantCount = useCallback(
    (nextCount: number) => {
      participantCountRef.current = nextCount;
      setParticipantCount(nextCount);
      updateMeetingStore({ participant_count: nextCount });
      optionsRef.current.onParticipantCountChanged?.(nextCount);
    },
    [updateMeetingStore],
  );

  const handleSegment = useCallback(
    (
      payload: unknown,
      callback?: ((segment: TranscriptSegment) => void) | undefined,
      isPartialOverride?: boolean,
    ) => {
      const segment = normalizeSegment(payload, isPartialOverride);

      if (!segment) {
        return;
      }

      useTranscriptStore.getState().addSegment(toStoreSegment(segment));
      updateLastSequence(segment.sequence);
      callback?.(segment);
    },
    [updateLastSequence],
  );

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
    }

    lastPongAtRef.current = Date.now();
    heartbeatTimerRef.current = window.setInterval(() => {
      const service = serviceRef.current;

      if (!service || service.state !== 'connected') {
        return;
      }

      if (Date.now() - lastPongAtRef.current > HEARTBEAT_TIMEOUT_MS) {
        service.disconnect(false);
        return;
      }

      service.send('ping', {});
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const sendSyncRequest = useCallback((sequence: number, targetLanguage?: string) => {
    const service = serviceRef.current;

    if (!service) {
      return;
    }

    if (service.state !== 'connected') {
      return;
    }

    service.send('sync_request', {
      last_sequence: sequence,
      ...(targetLanguage ? { target_language: targetLanguage } : {}),
    });
  }, []);

  const connect = useCallback(() => {
    const service = serviceRef.current;

    if (!service) {
      return;
    }

    service.connect({
      meetingId: options.meetingId,
      role: options.role,
      ...(options.role === 'host' ? { accessToken: options.token } : {}),
      ...(options.role === 'participant' && options.roomCode ? { roomCode: options.roomCode } : {}),
    });
  }, [options.meetingId, options.role, options.roomCode, options.token]);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    serviceRef.current?.disconnect();
  }, [stopHeartbeat]);

  const sendAudioChunk = useCallback(
    (data: ArrayBuffer, sequence: number, durationMs: number, isFinal = false) => {
      if (options.role !== 'host') {
        return;
      }

      if (serviceRef.current?.state !== 'connected') {
        return;
      }

      serviceRef.current?.send('audio_chunk', {
        sequence,
        data: toBase64(data),
        duration_ms: durationMs,
        is_final: isFinal,
      });
    },
    [options.role],
  );

  const sendRecordingControl = useCallback(
    (action: 'start' | 'pause' | 'resume' | 'stop') => {
      if (options.role !== 'host') {
        return;
      }

      if (serviceRef.current?.state !== 'connected') {
        return;
      }

      serviceRef.current?.send('recording_control', { action });
    },
    [options.role],
  );

  const setLanguage = useCallback((targetLanguage: string | null) => {
    targetLanguageRef.current = targetLanguage;

    if (options.role !== 'participant' || !targetLanguage || serviceRef.current?.state !== 'connected') {
      return;
    }

    if (targetLanguage) {
      serviceRef.current?.send('set_language', { target_language: targetLanguage });
    }
  }, [options.role]);

  useEffect(() => {
    const service = serviceRef.current;

    if (!service) {
      return undefined;
    }

    const unsubscribeMessage = service.on('*', (message: WebSocketEnvelope) => {
      const payload = asRecord(message.payload);

      switch (message.type) {
        case 'connected': {
          const count = asNumber(payload.participant_count);
          if (count !== null) {
            updateParticipantCount(count);
          }
          break;
        }
        case 'transcript_segment': {
          handleSegment(payload, optionsRef.current.onSegment, true);
          break;
        }
        case 'transcript_update': {
          handleSegment(payload, optionsRef.current.onSegmentUpdate, true);
          break;
        }
        case 'transcript_finalized': {
          handleSegment(payload, optionsRef.current.onSegmentFinalized, false);
          break;
        }
        case 'participant_joined': {
          updateParticipantCount(
            asNumber(payload.participant_count ?? payload.count) ?? participantCountRef.current + 1,
          );
          break;
        }
        case 'participant_left': {
          updateParticipantCount(
            asNumber(payload.participant_count ?? payload.count) ??
              Math.max(0, participantCountRef.current - 1),
          );
          break;
        }
        case 'recording_started': {
          updateMeetingStore({
            status: 'recording',
            ...(typeof payload.started_at === 'string' ? { started_at: payload.started_at } : {}),
          });
          optionsRef.current.onRecordingStarted?.();
          break;
        }
        case 'recording_stopped': {
          updateMeetingStore({
            status: 'ended',
            ...(typeof payload.ended_at === 'string' ? { ended_at: payload.ended_at } : {}),
            ...(typeof payload.duration_seconds === 'number'
              ? { duration_seconds: payload.duration_seconds }
              : {}),
          });
          optionsRef.current.onRecordingStopped?.();
          break;
        }
        case 'recording_paused': {
          updateMeetingStore({ status: 'paused' });
          break;
        }
        case 'recording_resumed': {
          updateMeetingStore({ status: 'recording' });
          break;
        }
        case 'processing_status': {
          const status: ProcessingStatus = {
            pending_chunks: asNumber(payload.pending_chunks) ?? 0,
            workers_online: asNumber(payload.workers_online) ?? 0,
            estimated_delay_seconds: asNumber(payload.estimated_delay_seconds) ?? 0,
          };
          optionsRef.current.onProcessingStatus?.(status);
          break;
        }
        case 'pong': {
          lastPongAtRef.current = Date.now();
          break;
        }
        case 'sync_response': {
          const segments = Array.isArray(payload.segments) ? payload.segments : [];
          segments.forEach((segmentPayload) => {
            const segment = normalizeSegment(segmentPayload);
            if (!segment) {
              return;
            }

            useTranscriptStore.getState().addSegment(toStoreSegment(segment));
            updateLastSequence(segment.sequence);
          });
          break;
        }
        case 'translation_segment': {
          const segmentId = asString(payload.segment_id);
          const targetLanguage = asString(payload.target_language);
          const translatedText = asString(payload.translated_text);

          if (segmentId && targetLanguage && translatedText) {
            useTranscriptStore.getState().setTranslation(segmentId, targetLanguage, translatedText);
          }
          break;
        }
        case 'translation_language_changed': {
          const targetLanguage = asString(payload.target_language);
          const backfillInProgress = payload.backfill_in_progress === true;

          if (backfillInProgress && targetLanguage) {
            useTranscriptStore.getState().setBackfillStatus(true, targetLanguage);
          }
          break;
        }
        case 'translation_backfill_complete': {
          useTranscriptStore.getState().setBackfillStatus(false, null);
          break;
        }
        case 'error': {
          setConnectionState('error');
          break;
        }
        default:
          break;
      }
    });

    const unsubscribeState = service.onStateChange((state) => {
      const nextState = mapConnectionState(state);
      setConnectionState(nextState);

      if (nextState === 'connected') {
        startHeartbeat();

        if (hasConnectedOnceRef.current && shouldReconnectSyncRef.current) {
          sendSyncRequest(lastSequenceRef.current, targetLanguageRef.current ?? undefined);
        }

        hasConnectedOnceRef.current = true;
        shouldReconnectSyncRef.current = false;
        return;
      }

      stopHeartbeat();

      if (nextState === 'reconnecting') {
        shouldReconnectSyncRef.current = true;
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeState();
    };
  }, [handleSegment, sendSyncRequest, startHeartbeat, stopHeartbeat, updateLastSequence, updateMeetingStore, updateParticipantCount]);

  useEffect(() => {
    lastSequenceRef.current = 0;
    participantCountRef.current = 0;
    setLastSequence(0);
    setParticipantCount(0);
  }, [options.meetingId]);

  useEffect(() => {
    if (!options.meetingId) {
      return undefined;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, options.meetingId]);

  return {
    connectionState,
    participantCount,
    lastSequence,
    connect,
    disconnect,
    sendAudioChunk,
    sendRecordingControl,
    sendSyncRequest,
    setLanguage,
  };
};

export default useMeetingWebSocket;
