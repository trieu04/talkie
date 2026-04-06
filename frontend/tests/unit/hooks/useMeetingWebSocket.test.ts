import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeetingWebSocket } from '@/hooks/useMeetingWebSocket';
import { WebSocketService } from '@/services/websocket';
import type { WebSocketConnectionState, WebSocketEnvelope } from '@/types';

vi.mock('@/services/websocket');
vi.mock('@/stores/meetingStore', () => ({
  useMeetingStore: {
    setState: vi.fn(),
    getState: vi.fn(() => ({ meetings: [], currentMeeting: null })),
  },
}));
vi.mock('@/stores/transcriptStore', () => ({
  useTranscriptStore: {
    getState: vi.fn(() => ({
      addSegment: vi.fn(),
      setTranslation: vi.fn(),
      setBackfillStatus: vi.fn(),
    })),
  },
}));

describe('useMeetingWebSocket', () => {
  let mockService: {
    state: WebSocketConnectionState;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    onStateChange: ReturnType<typeof vi.fn>;
  };
  let messageHandler: ((message: WebSocketEnvelope) => void) | null;
  let stateChangeHandler: ((state: WebSocketConnectionState) => void) | null;

  beforeEach(() => {
    vi.useFakeTimers();
    messageHandler = null;
    stateChangeHandler = null;

    mockService = {
      state: 'idle' as WebSocketConnectionState,
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      on: vi.fn().mockImplementation((_type: string, handler: (message: WebSocketEnvelope) => void) => {
        messageHandler = handler;
        return vi.fn();
      }),
      onStateChange: vi.fn().mockImplementation((handler: (state: WebSocketConnectionState) => void) => {
        stateChangeHandler = handler;
        return vi.fn();
      }),
    };

    vi.mocked(WebSocketService).mockImplementation(() => mockService as unknown as WebSocketService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const defaultOptions = {
    meetingId: 'test-meeting-id',
    token: 'test-token',
    role: 'host' as const,
  };

  it('initial connectionState is disconnected', () => {
    const { result } = renderHook(() => useMeetingWebSocket(defaultOptions));
    expect(result.current.connectionState).toBe('disconnected');
  });

  it('connect initiates WebSocket connection', () => {
    const { result } = renderHook(() => useMeetingWebSocket(defaultOptions));

    act(() => {
      result.current.connect();
    });

    expect(mockService.connect).toHaveBeenCalledWith({
      meetingId: 'test-meeting-id',
      role: 'host',
      accessToken: 'test-token',
    });
  });

  it('disconnect closes connection', () => {
    const { result } = renderHook(() => useMeetingWebSocket(defaultOptions));

    act(() => {
      result.current.disconnect();
    });

    expect(mockService.disconnect).toHaveBeenCalled();
  });

  it('handles transcript_segment messages', () => {
    const onSegment = vi.fn();
    renderHook(() => useMeetingWebSocket({ ...defaultOptions, onSegment }));

    act(() => {
      if (stateChangeHandler) {
        stateChangeHandler('connected');
      }
    });

    act(() => {
      if (messageHandler) {
        messageHandler({
          type: 'transcript_segment',
          payload: {
            id: 'seg-1',
            sequence: 1,
            text: 'Hello world',
            start_time_ms: 0,
            end_time_ms: 1000,
            is_partial: true,
          },
        });
      }
    });

    expect(onSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'seg-1',
        sequence: 1,
        text: 'Hello world',
        is_partial: true,
      })
    );
  });

  it('handles participant_joined messages', () => {
    const onParticipantCountChanged = vi.fn();
    renderHook(() =>
      useMeetingWebSocket({ ...defaultOptions, onParticipantCountChanged })
    );

    act(() => {
      if (messageHandler) {
        messageHandler({
          type: 'participant_joined',
          payload: { participant_count: 5 },
        });
      }
    });

    expect(onParticipantCountChanged).toHaveBeenCalledWith(5);
  });

  it('handles participant_left messages', () => {
    const onParticipantCountChanged = vi.fn();
    renderHook(() =>
      useMeetingWebSocket({ ...defaultOptions, onParticipantCountChanged })
    );

    act(() => {
      if (messageHandler) {
        messageHandler({
          type: 'participant_left',
          payload: { participant_count: 3 },
        });
      }
    });

    expect(onParticipantCountChanged).toHaveBeenCalledWith(3);
  });

  it('sendAudioChunk only works for host role', () => {
    mockService.state = 'connected';
    const { result } = renderHook(() => useMeetingWebSocket(defaultOptions));

    const audioData = new ArrayBuffer(100);
    act(() => {
      result.current.sendAudioChunk(audioData, 1, 1000);
    });

    expect(mockService.send).toHaveBeenCalledWith('audio_chunk', expect.objectContaining({
      sequence: 1,
      duration_ms: 1000,
      is_final: false,
    }));
  });

  it('sendAudioChunk does not work for participant role', () => {
    mockService.state = 'connected';
    const { result } = renderHook(() =>
      useMeetingWebSocket({ ...defaultOptions, role: 'participant', roomCode: 'ABC123' })
    );

    const audioData = new ArrayBuffer(100);
    act(() => {
      result.current.sendAudioChunk(audioData, 1, 1000);
    });

    expect(mockService.send).not.toHaveBeenCalled();
  });

  it('sendRecordingControl only works for host role', () => {
    mockService.state = 'connected';
    const { result } = renderHook(() => useMeetingWebSocket(defaultOptions));

    act(() => {
      result.current.sendRecordingControl('start');
    });

    expect(mockService.send).toHaveBeenCalledWith('recording_control', { action: 'start' });
  });

  it('sendRecordingControl does not work for participant role', () => {
    mockService.state = 'connected';
    const { result } = renderHook(() =>
      useMeetingWebSocket({ ...defaultOptions, role: 'participant', roomCode: 'ABC123' })
    );

    act(() => {
      result.current.sendRecordingControl('start');
    });

    expect(mockService.send).not.toHaveBeenCalled();
  });
});
