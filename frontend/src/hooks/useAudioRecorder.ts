import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_CHUNK_DURATION_MS = 4000;
const DEFAULT_OVERLAP_MS = 750;
const DEFAULT_MAX_BUFFER_SECONDS = 30;
const RECORDER_TIMESLICE_MS = 250;
const BUFFER_FLUSH_INTERVAL_MS = 1000;
const SUPPORTED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm'] as const;

export interface AudioChunk {
  sequence: number;
  data: ArrayBuffer;
  durationMs: number;
  timestamp: number;
}

export interface UseAudioRecorderOptions {
  onChunkReady: (chunk: AudioChunk) => void;
  chunkDurationMs?: number;
  overlapMs?: number;
  maxBufferSeconds?: number;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  error: string | null;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  bufferedChunks: number;
  isBuffering: boolean;
}

type MicrophonePermissionStatus = UseAudioRecorderReturn['permissionStatus'];

interface ActiveChunkRecorder {
  id: number;
  recorder: MediaRecorder;
  stream: MediaStream;
  startedAt: number;
  parts: BlobPart[];
  stopTimer: number | null;
}

const resolveSupportedMimeType = (): string | null => {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return SUPPORTED_MIME_TYPES[0];
  }

  return SUPPORTED_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
};

const getPermissionErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Microphone access was denied.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No microphone was found.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Microphone is not available right now.';
      case 'AbortError':
        return 'Microphone access was interrupted.';
      default:
        return error.message || 'Could not access the microphone.';
    }
  }

  return error instanceof Error ? error.message : 'Could not access the microphone.';
};

export const useAudioRecorder = ({
  onChunkReady,
  chunkDurationMs = DEFAULT_CHUNK_DURATION_MS,
  overlapMs = DEFAULT_OVERLAP_MS,
  maxBufferSeconds = DEFAULT_MAX_BUFFER_SECONDS,
}: UseAudioRecorderOptions): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<MicrophonePermissionStatus>('unknown');
  const [bufferedChunks, setBufferedChunks] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string | null>(null);
  const activeRecordersRef = useRef(new Map<number, ActiveChunkRecorder>());
  const nextRecorderIdRef = useRef(0);
  const nextSequenceRef = useRef(0);
  const nextWindowTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const pendingChunksRef = useRef<AudioChunk[]>([]);
  const processingQueueRef = useRef(Promise.resolve());

  const stepMs = useMemo(() => Math.max(250, chunkDurationMs - overlapMs), [chunkDurationMs, overlapMs]);
  const maxBufferDurationMs = useMemo(() => Math.max(0, maxBufferSeconds * 1000), [maxBufferSeconds]);

  const syncBufferedChunkCount = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    setBufferedChunks(pendingChunksRef.current.length);
  }, []);

  const trimBufferedChunks = useCallback(() => {
    if (maxBufferDurationMs <= 0) {
      pendingChunksRef.current = [];
      syncBufferedChunkCount();
      return;
    }

    let totalDurationMs = pendingChunksRef.current.reduce((sum, chunk) => sum + chunk.durationMs, 0);
    while (totalDurationMs > maxBufferDurationMs && pendingChunksRef.current.length > 0) {
      const droppedChunk = pendingChunksRef.current.shift();
      totalDurationMs -= droppedChunk?.durationMs ?? 0;
    }

    syncBufferedChunkCount();
  }, [maxBufferDurationMs, syncBufferedChunkCount]);

  const updateBufferingState = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    const shouldBuffer = !navigator.onLine || pendingChunksRef.current.length > 0;
    setIsBuffering(shouldBuffer);
  }, []);

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearNextWindowTimer = useCallback(() => {
    if (nextWindowTimerRef.current !== null) {
      window.clearTimeout(nextWindowTimerRef.current);
      nextWindowTimerRef.current = null;
    }
  }, []);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const stopAllActiveRecorders = useCallback(() => {
    activeRecordersRef.current.forEach((entry) => {
      if (entry.stopTimer !== null) {
        window.clearTimeout(entry.stopTimer);
      }

      if (entry.recorder.state !== 'inactive') {
        entry.recorder.stop();
      }
    });
  }, []);

  const enqueueProcessing = useCallback((work: () => Promise<void>) => {
    processingQueueRef.current = processingQueueRef.current
      .then(work)
      .catch((processingError: unknown) => {
        if (!isMountedRef.current) {
          return;
        }

        const message =
          processingError instanceof Error
            ? processingError.message
            : 'Audio chunk processing failed.';
        setError(message);
      });
  }, []);

  const deliverChunk = useCallback(
    async (chunk: AudioChunk) => {
      await Promise.resolve(onChunkReady(chunk));
    },
    [onChunkReady],
  );

  const flushBufferedChunks = useCallback(async () => {
    if (!navigator.onLine) {
      updateBufferingState();
      return;
    }

    while (pendingChunksRef.current.length > 0) {
      const nextChunk = pendingChunksRef.current[0];

      if (!nextChunk) {
        break;
      }

      try {
        await deliverChunk(nextChunk);
        pendingChunksRef.current.shift();
        syncBufferedChunkCount();
      } catch (deliveryError) {
        if (isMountedRef.current) {
          setError(
            deliveryError instanceof Error
              ? deliveryError.message
              : 'Could not send buffered audio chunk.',
          );
        }

        updateBufferingState();
        return;
      }
    }

    updateBufferingState();
  }, [deliverChunk, syncBufferedChunkCount, updateBufferingState]);

  const queueOrDispatchChunk = useCallback(
    async (chunk: AudioChunk) => {
      if (!navigator.onLine) {
        pendingChunksRef.current.push(chunk);
        trimBufferedChunks();
        updateBufferingState();
        return;
      }

      await flushBufferedChunks();

      try {
        await deliverChunk(chunk);
        if (isMountedRef.current) {
          setError(null);
        }
      } catch (deliveryError) {
        pendingChunksRef.current.push(chunk);
        trimBufferedChunks();

        if (isMountedRef.current) {
          setError(
            deliveryError instanceof Error ? deliveryError.message : 'Could not send audio chunk.',
          );
        }

        updateBufferingState();
        return;
      }

      updateBufferingState();
    },
    [deliverChunk, flushBufferedChunks, trimBufferedChunks, updateBufferingState],
  );

  const finalizeChunkRecorder = useCallback(
    (entry: ActiveChunkRecorder) => {
      activeRecordersRef.current.delete(entry.id);

      if (entry.stopTimer !== null) {
        window.clearTimeout(entry.stopTimer);
      }

      entry.stream.getTracks().forEach((track) => track.stop());

      if (entry.parts.length === 0) {
        return;
      }

      enqueueProcessing(async () => {
        const blob = new Blob(entry.parts, { type: mimeTypeRef.current ?? 'audio/webm' });
        const chunk: AudioChunk = {
          sequence: nextSequenceRef.current,
          data: await blob.arrayBuffer(),
          durationMs: Math.max(1, Date.now() - entry.startedAt),
          timestamp: entry.startedAt,
        };

        nextSequenceRef.current += 1;
        await queueOrDispatchChunk(chunk);
      });
    },
    [enqueueProcessing, queueOrDispatchChunk],
  );

  const startChunkRecorder = useCallback(() => {
    const sourceStream = streamRef.current;
    const mimeType = mimeTypeRef.current;

    if (!sourceStream || !mimeType || !isMountedRef.current) {
      return;
    }

    const stream = sourceStream.clone();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 64000,
    });

    const entry: ActiveChunkRecorder = {
      id: nextRecorderIdRef.current,
      recorder,
      stream,
      startedAt: Date.now(),
      parts: [],
      stopTimer: null,
    };

    nextRecorderIdRef.current += 1;
    activeRecordersRef.current.set(entry.id, entry);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        entry.parts.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      activeRecordersRef.current.delete(entry.id);
      entry.stream.getTracks().forEach((track) => track.stop());

      if (!isMountedRef.current) {
        return;
      }

      const message = event.error?.message || 'MediaRecorder encountered an error.';
      setError(message);
    };

    recorder.onstop = () => {
      finalizeChunkRecorder(entry);
    };

    recorder.start(RECORDER_TIMESLICE_MS);
    entry.stopTimer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, chunkDurationMs);
  }, [chunkDurationMs, finalizeChunkRecorder]);

  const scheduleNextChunkRecorder = useCallback(() => {
    clearNextWindowTimer();

    if (!isMountedRef.current || !streamRef.current || isPaused) {
      return;
    }

    nextWindowTimerRef.current = window.setTimeout(() => {
      startChunkRecorder();
      scheduleNextChunkRecorder();
    }, stepMs);
  }, [clearNextWindowTimer, isPaused, startChunkRecorder, stepMs]);

  const beginChunkLoop = useCallback(() => {
    startChunkRecorder();
    scheduleNextChunkRecorder();
  }, [scheduleNextChunkRecorder, startChunkRecorder]);

  const cleanupRecording = useCallback(() => {
    clearNextWindowTimer();
    clearFlushTimer();
    stopAllActiveRecorders();
    stopStreamTracks();
  }, [clearFlushTimer, clearNextWindowTimer, stopAllActiveRecorders, stopStreamTracks]);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support microphone recording.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('This browser does not support MediaRecorder.');
      return;
    }

    const mimeType = resolveSupportedMimeType();
    if (!mimeType) {
      setError('This browser does not support WebM Opus audio recording.');
      return;
    }

    if (overlapMs >= chunkDurationMs) {
      setError('Audio overlap must be shorter than the chunk duration.');
      return;
    }

    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mimeTypeRef.current = mimeType;
      streamRef.current = stream;
      nextSequenceRef.current = 0;
      pendingChunksRef.current = [];
      syncBufferedChunkCount();
      setPermissionStatus('granted');
      setIsRecording(true);
      setIsPaused(false);
      updateBufferingState();
      beginChunkLoop();

      clearFlushTimer();
      flushTimerRef.current = window.setInterval(() => {
        enqueueProcessing(flushBufferedChunks);
      }, BUFFER_FLUSH_INTERVAL_MS);
    } catch (permissionError) {
      const message = getPermissionErrorMessage(permissionError);
      setError(message);
      setPermissionStatus(
        permissionError instanceof DOMException &&
          ['NotAllowedError', 'PermissionDeniedError'].includes(permissionError.name)
          ? 'denied'
          : 'prompt',
      );
      cleanupRecording();
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [
    beginChunkLoop,
    chunkDurationMs,
    cleanupRecording,
    clearFlushTimer,
    enqueueProcessing,
    flushBufferedChunks,
    isRecording,
    overlapMs,
    syncBufferedChunkCount,
    updateBufferingState,
  ]);

  const stopRecording = useCallback(() => {
    cleanupRecording();
    setIsRecording(false);
    setIsPaused(false);
    updateBufferingState();
    enqueueProcessing(flushBufferedChunks);
  }, [cleanupRecording, enqueueProcessing, flushBufferedChunks, updateBufferingState]);

  const pauseRecording = useCallback(() => {
    if (!isRecording || isPaused) {
      return;
    }

    clearNextWindowTimer();
    stopAllActiveRecorders();
    setIsPaused(true);
  }, [clearNextWindowTimer, isPaused, isRecording, stopAllActiveRecorders]);

  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused || !streamRef.current) {
      return;
    }

    setIsPaused(false);
    beginChunkLoop();
  }, [beginChunkLoop, isPaused, isRecording]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanupRecording();
    };
  }, [cleanupRecording]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
      return;
    }

    let isCancelled = false;
    let permissionStatusHandle: PermissionStatus | null = null;

    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (isCancelled) {
          return;
        }

        permissionStatusHandle = status;
        setPermissionStatus(status.state);

        status.onchange = () => {
          if (!isCancelled) {
            setPermissionStatus(status.state);
          }
        };
      })
      .catch(() => {
        if (!isCancelled) {
          setPermissionStatus('unknown');
        }
      });

    return () => {
      isCancelled = true;
      if (permissionStatusHandle) {
        permissionStatusHandle.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      updateBufferingState();
      enqueueProcessing(flushBufferedChunks);
    };

    const handleOffline = () => {
      updateBufferingState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enqueueProcessing, flushBufferedChunks, updateBufferingState]);

  return {
    isRecording,
    isPaused,
    error,
    permissionStatus,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    bufferedChunks,
    isBuffering,
  };
};

export default useAudioRecorder;
