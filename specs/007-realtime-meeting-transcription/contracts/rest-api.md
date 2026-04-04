# API Contracts: REST Endpoints

**Feature**: 007-realtime-meeting-transcription  
**Date**: 2026-04-04  
**Base URL**: `/api/v1`

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <access_token>
```

Public endpoints (participant access) use room code in path.

---

## Endpoints

### Authentication

#### POST /auth/register
Create new host account.

**Request:**
```json
{
  "email": "host@example.com",
  "password": "SecurePass123",
  "display_name": "John Doe"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "email": "host@example.com",
  "display_name": "John Doe",
  "created_at": "2026-04-04T10:00:00Z"
}
```

**Errors:**
- 400: Invalid email/password format
- 409: Email already registered

---

#### POST /auth/login
Authenticate and get tokens.

**Request:**
```json
{
  "email": "host@example.com",
  "password": "SecurePass123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Errors:**
- 401: Invalid credentials

---

#### POST /auth/refresh
Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 3600
}
```

---

### Meetings

#### POST /meetings
Create new meeting. **Requires auth.**

**Request:**
```json
{
  "title": "Weekly Standup",
  "source_language": "vi"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "room_code": "ABC123",
  "title": "Weekly Standup",
  "source_language": "vi",
  "status": "created",
  "created_at": "2026-04-04T10:00:00Z",
  "join_url": "https://talkie.app/join/ABC123"
}
```

**Errors:**
- 400: Invalid source_language
- 401: Not authenticated
- 409: Host already has active recording

---

#### GET /meetings
List host's meetings. **Requires auth.**

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (default: 20, max: 100)
- `offset` (default: 0)

**Response 200:**
```json
{
  "meetings": [
    {
      "id": "uuid",
      "room_code": "ABC123",
      "title": "Weekly Standup",
      "source_language": "vi",
      "status": "ended",
      "started_at": "2026-04-04T10:00:00Z",
      "ended_at": "2026-04-04T11:00:00Z",
      "duration_seconds": 3600,
      "has_transcript": true,
      "has_summary": true
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

#### GET /meetings/{meeting_id}
Get meeting details. **Requires auth (host) or room_code (participant).**

**Response 200:**
```json
{
  "id": "uuid",
  "room_code": "ABC123",
  "title": "Weekly Standup",
  "source_language": "vi",
  "status": "ended",
  "started_at": "2026-04-04T10:00:00Z",
  "ended_at": "2026-04-04T11:00:00Z",
  "participant_count": 5,
  "transcript_segment_count": 150,
  "has_summary": true,
  "available_translations": ["en", "ja"]
}
```

---

#### POST /meetings/{meeting_id}/start
Start recording. **Requires auth (host only).**

**Response 200:**
```json
{
  "status": "recording",
  "started_at": "2026-04-04T10:00:00Z",
  "websocket_url": "wss://talkie.app/ws/meeting/{meeting_id}/host"
}
```

**Errors:**
- 400: Meeting already started/ended
- 401: Not authenticated
- 403: Not the host

---

#### POST /meetings/{meeting_id}/stop
Stop recording. **Requires auth (host only).**

**Response 200:**
```json
{
  "status": "ended",
  "ended_at": "2026-04-04T11:00:00Z",
  "duration_seconds": 3600,
  "pending_chunks": 2
}
```

---

### Join Meeting (Public)

#### GET /join/{room_code}
Get meeting info for joining. **Public.**

**Response 200:**
```json
{
  "meeting_id": "uuid",
  "title": "Weekly Standup",
  "source_language": "vi",
  "status": "recording",
  "started_at": "2026-04-04T10:00:00Z",
  "websocket_url": "wss://talkie.app/ws/meeting/{meeting_id}/participant"
}
```

**Errors:**
- 404: Invalid room code

---

### Transcript

#### GET /meetings/{meeting_id}/transcript
Get full transcript. **Requires auth (host) or room_code.**

**Query Parameters:**
- `include_translations` (optional): Comma-separated language codes
- `offset` (default: 0): Segment offset
- `limit` (default: 100, max: 500)

**Response 200:**
```json
{
  "meeting_id": "uuid",
  "source_language": "vi",
  "segments": [
    {
      "id": "uuid",
      "sequence": 0,
      "text": "Xin chào các bạn",
      "start_time_ms": 0,
      "end_time_ms": 2500,
      "translations": {
        "en": "Hello everyone",
        "ja": "皆さん、こんにちは"
      }
    }
  ],
  "total_segments": 150,
  "limit": 100,
  "offset": 0
}
```

---

#### GET /meetings/{meeting_id}/transcript/search
Search transcript. **Requires auth (host) or room_code.**

**Query Parameters:**
- `q` (required): Search query
- `language` (optional): Search in specific language
- `limit` (default: 20)

**Response 200:**
```json
{
  "query": "budget",
  "matches": [
    {
      "segment_id": "uuid",
      "sequence": 42,
      "text": "...discussing the budget for Q2...",
      "highlight": "...discussing the <mark>budget</mark> for Q2...",
      "start_time_ms": 125000
    }
  ],
  "total_matches": 5
}
```

---

### Translation

#### POST /meetings/{meeting_id}/translate
Request translation for a language. **Requires auth (host) or room_code.**

**Request:**
```json
{
  "target_language": "en"
}
```

**Response 202:**
```json
{
  "status": "processing",
  "target_language": "en",
  "segments_to_translate": 150,
  "estimated_seconds": 30
}
```

**Response 200 (if already exists):**
```json
{
  "status": "complete",
  "target_language": "en",
  "segments_translated": 150
}
```

---

### Summary

#### POST /meetings/{meeting_id}/summary
Generate meeting summary. **Requires auth (host) or room_code.**

**Request:**
```json
{
  "regenerate": false
}
```

**Response 202:**
```json
{
  "status": "processing",
  "estimated_seconds": 45
}
```

**Response 200 (if exists and not regenerating):**
```json
{
  "id": "uuid",
  "content": "This meeting covered...",
  "key_points": [
    "Discussed Q2 budget allocation",
    "Reviewed project timeline"
  ],
  "decisions": [
    {
      "decision": "Increase marketing budget by 15%",
      "context": "Based on Q1 performance"
    }
  ],
  "action_items": [
    {
      "task": "Prepare detailed budget breakdown",
      "assignee": null,
      "deadline": null
    }
  ],
  "created_at": "2026-04-04T11:05:00Z"
}
```

---

#### GET /meetings/{meeting_id}/summary
Get existing summary. **Requires auth (host) or room_code.**

**Response 200:** Same as POST response when exists.

**Errors:**
- 404: Summary not yet generated

---

### Audio Upload (Host Only)

#### POST /meetings/{meeting_id}/audio
Upload audio chunk. **Requires auth (host only).**

**Request:**
- Content-Type: `multipart/form-data`
- `audio`: Audio file (WebM Opus, max 10s)
- `sequence`: Chunk sequence number
- `duration_ms`: Chunk duration

**Response 201:**
```json
{
  "chunk_id": "uuid",
  "sequence": 5,
  "status": "pending",
  "storage_key": "meetings/{meeting_id}/audio/5.opus"
}
```

**Errors:**
- 400: Invalid audio format or sequence
- 413: Chunk too large (>1MB)

---

### Worker API (Internal)

#### GET /worker/jobs
Poll for pending audio chunks. **Requires worker auth.**

**Query Parameters:**
- `worker_id` (required): Worker identifier
- `limit` (default: 1, max: 5)

**Response 200:**
```json
{
  "jobs": [
    {
      "chunk_id": "uuid",
      "meeting_id": "uuid",
      "sequence": 5,
      "audio_url": "https://storage.../chunk.opus",
      "source_language": "vi",
      "timeout_seconds": 30
    }
  ]
}
```

---

#### POST /worker/jobs/{chunk_id}/result
Submit transcription result. **Requires worker auth.**

**Request:**
```json
{
  "worker_id": "colab-abc123",
  "segments": [
    {
      "text": "Xin chào các bạn",
      "start_offset_ms": 0,
      "end_offset_ms": 2500,
      "confidence": 0.95
    }
  ]
}
```

**Response 200:**
```json
{
  "status": "accepted",
  "segments_created": 1
}
```

---

#### POST /worker/jobs/{chunk_id}/heartbeat
Keep job alive during processing. **Requires worker auth.**

**Request:**
```json
{
  "worker_id": "colab-abc123",
  "progress_percent": 50
}
```

**Response 200:**
```json
{
  "status": "acknowledged",
  "timeout_extended_to": "2026-04-04T10:01:30Z"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "reason": "Must be a valid email address"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource state conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Auth endpoints | 10/minute |
| Meeting CRUD | 100/minute |
| Audio upload | 60/minute (per meeting) |
| Transcript/Translation | 200/minute |
| Worker API | 1000/minute |
