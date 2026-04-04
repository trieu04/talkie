# API Contracts: WebSocket Protocol

**Feature**: 007-realtime-meeting-transcription  
**Date**: 2026-04-04  
**Protocol**: RFC 6455 WebSocket over TLS

## Connection URLs

| Role | URL Pattern |
|------|-------------|
| Host | `wss://talkie.app/ws/meeting/{meeting_id}/host?token={access_token}` |
| Participant | `wss://talkie.app/ws/meeting/{meeting_id}/participant?room_code={room_code}` |

## Message Format

All messages are JSON with this envelope:

```json
{
  "type": "message_type",
  "payload": { ... },
  "timestamp": "2026-04-04T10:00:00.123Z",
  "message_id": "uuid"
}
```

---

## Client → Server Messages

### Host Messages

#### audio_chunk
Stream audio data to server.

```json
{
  "type": "audio_chunk",
  "payload": {
    "sequence": 5,
    "data": "base64_encoded_audio_data",
    "duration_ms": 4000,
    "is_final": false
  }
}
```

**Notes:**
- `data`: Base64-encoded WebM Opus audio
- `duration_ms`: Target 4000ms with 750ms overlap
- `is_final`: True for last chunk when stopping

---

#### recording_control
Control recording state.

```json
{
  "type": "recording_control",
  "payload": {
    "action": "start" | "pause" | "resume" | "stop"
  }
}
```

---

### Participant Messages

#### set_language
Set translation language preference.

```json
{
  "type": "set_language",
  "payload": {
    "target_language": "en"
  }
}
```

**Notes:**
- `target_language`: ISO 639-1 code, or `null` for source only
- Server will start streaming translations for this language

---

### Common Messages

#### ping
Client heartbeat (sent every 15 seconds).

```json
{
  "type": "ping",
  "payload": {}
}
```

---

#### sync_request
Request missed transcripts after reconnection.

```json
{
  "type": "sync_request",
  "payload": {
    "last_sequence": 42,
    "target_language": "en"
  }
}
```

---

## Server → Client Messages

### Connection

#### connected
Connection established successfully.

```json
{
  "type": "connected",
  "payload": {
    "session_id": "uuid",
    "role": "host" | "participant",
    "meeting": {
      "id": "uuid",
      "title": "Weekly Standup",
      "source_language": "vi",
      "status": "recording",
      "started_at": "2026-04-04T10:00:00Z"
    },
    "participant_count": 5
  }
}
```

---

#### error
Error occurred.

```json
{
  "type": "error",
  "payload": {
    "code": "INVALID_ROOM_CODE",
    "message": "Room code not found",
    "fatal": true
  }
}
```

**Error Codes:**
- `INVALID_TOKEN`: Authentication failed
- `INVALID_ROOM_CODE`: Room code not found
- `MEETING_NOT_ACTIVE`: Meeting not in recording state
- `PERMISSION_DENIED`: Action not allowed for role
- `RATE_LIMITED`: Too many messages
- `INTERNAL_ERROR`: Server error

**Notes:**
- `fatal: true` means connection will be closed

---

### Recording State

#### recording_started
Recording has begun.

```json
{
  "type": "recording_started",
  "payload": {
    "started_at": "2026-04-04T10:00:00Z"
  }
}
```

---

#### recording_paused
Recording paused.

```json
{
  "type": "recording_paused",
  "payload": {
    "paused_at": "2026-04-04T10:30:00Z"
  }
}
```

---

#### recording_resumed
Recording resumed.

```json
{
  "type": "recording_resumed",
  "payload": {
    "resumed_at": "2026-04-04T10:31:00Z"
  }
}
```

---

#### recording_stopped
Recording ended.

```json
{
  "type": "recording_stopped",
  "payload": {
    "ended_at": "2026-04-04T11:00:00Z",
    "duration_seconds": 3600,
    "status": "ended" | "ended_abnormal"
  }
}
```

---

### Transcript Updates

#### transcript_segment
New transcript segment available.

```json
{
  "type": "transcript_segment",
  "payload": {
    "id": "uuid",
    "sequence": 42,
    "text": "Xin chào các bạn",
    "start_time_ms": 125000,
    "end_time_ms": 127500,
    "is_partial": false,
    "confidence": 0.95
  }
}
```

**Notes:**
- `is_partial: true` means segment may be updated
- Partial segments sent for real-time feel before finalization

---

#### transcript_update
Update to existing partial segment.

```json
{
  "type": "transcript_update",
  "payload": {
    "id": "uuid",
    "sequence": 42,
    "text": "Xin chào các bạn, hôm nay chúng ta...",
    "is_partial": true
  }
}
```

---

#### transcript_finalized
Partial segment is now final.

```json
{
  "type": "transcript_finalized",
  "payload": {
    "id": "uuid",
    "sequence": 42,
    "text": "Xin chào các bạn, hôm nay chúng ta sẽ bàn về ngân sách.",
    "confidence": 0.92
  }
}
```

---

### Translation Updates

#### translation_segment
Translation available for segment.

```json
{
  "type": "translation_segment",
  "payload": {
    "segment_id": "uuid",
    "sequence": 42,
    "target_language": "en",
    "translated_text": "Hello everyone, today we will discuss the budget."
  }
}
```

---

#### translation_language_changed
Acknowledgment of language change.

```json
{
  "type": "translation_language_changed",
  "payload": {
    "target_language": "ja",
    "backfill_in_progress": true,
    "segments_to_translate": 42
  }
}
```

---

#### translation_backfill_complete
All existing segments translated.

```json
{
  "type": "translation_backfill_complete",
  "payload": {
    "target_language": "ja",
    "segments_translated": 42
  }
}
```

---

### Participant Updates

#### participant_joined
New participant joined.

```json
{
  "type": "participant_joined",
  "payload": {
    "participant_count": 6
  }
}
```

---

#### participant_left
Participant disconnected.

```json
{
  "type": "participant_left",
  "payload": {
    "participant_count": 5
  }
}
```

---

### Processing Status

#### chunk_received
Audio chunk received by server (host only).

```json
{
  "type": "chunk_received",
  "payload": {
    "sequence": 5,
    "status": "pending"
  }
}
```

---

#### chunk_processed
Audio chunk transcribed (host only).

```json
{
  "type": "chunk_processed",
  "payload": {
    "sequence": 5,
    "status": "completed",
    "segments_created": 2
  }
}
```

---

#### processing_status
Overall processing status.

```json
{
  "type": "processing_status",
  "payload": {
    "pending_chunks": 3,
    "workers_online": 2,
    "estimated_delay_seconds": 8
  }
}
```

**Notes:**
- Sent when no workers available or backlog exists
- Helps UI show "waiting for processing" state

---

### Sync Response

#### sync_response
Response to sync_request after reconnection.

```json
{
  "type": "sync_response",
  "payload": {
    "segments": [
      {
        "id": "uuid",
        "sequence": 43,
        "text": "...",
        "start_time_ms": 130000,
        "end_time_ms": 132500,
        "translation": {
          "en": "..."
        }
      }
    ],
    "last_sequence": 50
  }
}
```

---

### Heartbeat

#### pong
Server heartbeat response.

```json
{
  "type": "pong",
  "payload": {}
}
```

---

## Connection Lifecycle

### Host Flow

```
1. Connect with access_token
2. Receive: connected
3. Send: recording_control (start)
4. Receive: recording_started
5. Loop:
   - Send: audio_chunk
   - Receive: chunk_received
   - Receive: transcript_segment (from worker)
   - Send: ping (every 15s)
   - Receive: pong
6. Send: recording_control (stop)
7. Receive: recording_stopped
8. Connection closed or kept for viewing
```

### Participant Flow

```
1. Connect with room_code
2. Receive: connected (includes current state)
3. Receive: transcript_segment (ongoing)
4. Optional: Send set_language
5. Receive: translation_language_changed
6. Receive: translation_segment (backfill + new)
7. Send: ping (every 15s)
8. Receive: pong
9. Receive: recording_stopped (when host ends)
10. Connection may stay open for review
```

### Reconnection Flow

```
1. Disconnect detected (network loss)
2. Client attempts reconnect with exponential backoff:
   - 1s, 2s, 4s, 8s, 16s, 32s (max)
3. Reconnect with same credentials
4. Receive: connected
5. Send: sync_request with last_sequence
6. Receive: sync_response with missed segments
7. Resume normal flow
```

---

## Rate Limits

| Message Type | Limit |
|--------------|-------|
| audio_chunk | 4/second (host only) |
| set_language | 1/second |
| ping | 1/10 seconds |
| sync_request | 1/5 seconds |

---

## Binary Audio Protocol (Alternative)

For lower latency, audio can be sent as binary frames:

```
[1 byte: message type = 0x01]
[4 bytes: sequence number (uint32 big-endian)]
[4 bytes: duration_ms (uint32 big-endian)]
[1 byte: flags (bit 0 = is_final)]
[remaining bytes: audio data]
```

Server responds with JSON for transcript/status updates.

---

## Error Recovery

### Client-side buffering
- Buffer audio chunks during disconnect (up to 30 seconds)
- Resend buffered chunks after reconnection
- Server deduplicates by sequence number

### Server-side handling
- Keep partial transcript state for 5 minutes after disconnect
- Allow host to resume if reconnects within window
- Mark meeting as `ended_abnormal` if no reconnect

### Duplicate detection
- Server tracks received chunk sequences per meeting
- Duplicate chunks are acknowledged but not reprocessed
- Out-of-order chunks are queued and processed in order
