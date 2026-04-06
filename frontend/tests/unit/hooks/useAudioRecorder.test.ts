import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const createMockMediaStream = () => {
  const track = {
    stop: vi.fn(),
    kind: 'audio',
    enabled: true,
  };
  return {
    getTracks: () => [track],
    clone: vi.fn().mockImplementation(function(this: MediaStream) { return this; }),
  } as unknown as MediaStream;
};

const createMockMediaRecorder = () => {
  const mockRecorder = {
    state: 'inactive' as RecordingState,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    ondataavailable: null as ((event: BlobEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onstop: null as (() => void) | null,
  };

  mockRecorder.start = vi.fn().mockImplementation(() => {
    mockRecorder.state = 'recording';
  });

  mockRecorder.stop = vi.fn().mockImplementation(() => {
    mockRecorder.state = 'inactive';
    if (mockRecorder.onstop) {
      mockRecorder.onstop();
    }
  });

  return mockRecorder;
};

describe('useAudioRecorder', () => {
  let mockMediaRecorderInstance: ReturnType<typeof createMockMediaRecorder>;
  let originalNavigator: Navigator;
  let originalMediaRecorder: typeof MediaRecorder;

  beforeEach(() => {
    vi.useFakeTimers();
    originalNavigator = global.navigator;
    originalMediaRecorder = global.MediaRecorder;

    mockMediaRecorderInstance = createMockMediaRecorder();

    const MockMediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorderInstance);
    MockMediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(createMockMediaStream()),
        },
        permissions: {
          query: vi.fn().mockResolvedValue({
            state: 'prompt',
            onchange: null,
          }),
        },
        onLine: true,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    global.navigator = originalNavigator;
    global.MediaRecorder = originalMediaRecorder;
  });

  it('initial state is not recording', () => {
    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('initial permission status is unknown', () => {
    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    expect(result.current.permissionStatus).toBe('unknown');
  });

  it('startRecording requests microphone permission', async () => {
    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('startRecording sets isRecording to true on success', async () => {
    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.permissionStatus).toBe('granted');
  });

  it('stopRecording sets isRecording to false', async () => {
    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it('pauseRecording sets isPaused to true', async () => {
    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.isRecording).toBe(true);
  });

  it('resumeRecording sets isPaused to false', async () => {
    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.isPaused).toBe(false);
  });

  it('error handling for missing MediaRecorder', async () => {
    (global as unknown as { MediaRecorder: undefined }).MediaRecorder = undefined;

    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe('This browser does not support MediaRecorder.');
    expect(result.current.isRecording).toBe(false);
  });

  it('error handling for permission denied', async () => {
    const permissionError = new DOMException('Permission denied', 'NotAllowedError');
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(permissionError);

    const onChunkReady = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onChunkReady }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe('Microphone access was denied.');
    expect(result.current.permissionStatus).toBe('denied');
    expect(result.current.isRecording).toBe(false);
  });
});
