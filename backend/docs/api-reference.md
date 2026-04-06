# Talkie API Reference

**Base URL**: `/api/v1`  
**OpenAPI**: Available at `/docs` (Swagger UI) and `/redoc` (ReDoc)

---

## Authentication

All protected endpoints require Bearer token authentication:
```
Authorization: Bearer <access_token>
```

### POST /auth/register
Create a new host account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "display_name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "John Doe",
  "created_at": "2026-04-04T10:00:00Z"
}
```

**Errors:**
- `409 Conflict` - Email already registered

---

### POST /auth/login
Authenticate and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Errors:**
- `401 Unauthorized` - Invalid credentials

---

### POST /auth/refresh
Refresh access token.

**Request Body:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJ...",
  "expires_in": 3600
}
```

---

## Meetings

### POST /meetings
Create a new meeting. **Requires auth.**

**Request Body:**
```json
{
  "title": "Team Standup",
  "source_language": "vi"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "room_code": "ABC123",
  "title": "Team Standup",
  "source_language": "vi",
  "status": "created",
  "created_at": "2026-04-04T10:00:00Z",
  "started_at": null,
  "ended_at": null,
  "join_url": "https://talkie.app/join/ABC123",
  "has_transcript": false,
  "has_summary": false
}
```

---

### GET /meetings
List host's meetings with pagination. **Requires auth.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string | null | Filter by status (created, recording, ended) |
| limit | int | 20 | Max results (1-100) |
| offset | int | 0 | Pagination offset |

**Response:** `200 OK`
```json
{
  "meetings": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### GET /meetings/{id}
Get meeting details. **Requires auth (owner only).**

**Response:** `200 OK` - Meeting object

---

### POST /meetings/{id}/start
Start recording a meeting. **Requires auth (owner only).**

**Response:** `200 OK`
```json
{
  "status": "recording",
  "started_at": "2026-04-04T10:05:00Z",
  "websocket_url": "wss://talkie.app/ws/meeting/{id}/host"
}
```

---

### POST /meetings/{id}/stop
Stop recording a meeting. **Requires auth (owner only).**

**Response:** `200 OK`
```json
{
  "status": "ended",
  "ended_at": "2026-04-04T11:00:00Z",
  "duration_seconds": 3300,
  "pending_chunks": 0
}
```

---

### POST /meetings/{id}/audio
Upload audio chunk during recording. **Requires auth (owner only).**

**Content-Type:** `multipart/form-data`

**Form Fields:**
| Field | Type | Description |
|-------|------|-------------|
| sequence | int | Chunk sequence number |
| duration_ms | int | Chunk duration in milliseconds |
| audio | file | WebM/Opus audio file |

**Response:** `201 Created`
```json
{
  "chunk_id": "uuid",
  "sequence": 1,
  "status": "pending",
  "storage_key": "meetings/{id}/chunks/1.webm"
}
```

---

## Transcript

### GET /meetings/{id}/transcript
Get meeting transcript with pagination. **Requires auth (owner only).**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | int | 100 | Max segments (1-500) |
| offset | int | 0 | Pagination offset |
| include_translations | string | null | Comma-separated language codes |

**Response:** `200 OK`
```json
{
  "meeting_id": "uuid",
  "source_language": "vi",
  "segments": [
    {
      "id": "uuid",
      "sequence": 1,
      "text": "Xin chào mọi người",
      "start_time_ms": 0,
      "end_time_ms": 2500,
      "confidence": 0.95,
      "is_partial": false,
      "translations": [
        {
          "target_language": "en",
          "translated_text": "Hello everyone"
        }
      ]
    }
  ],
  "total_segments": 150,
  "limit": 100,
  "offset": 0
}
```

---

### GET /meetings/{id}/transcript/search
Search within transcript. **Requires auth (owner only).**

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| q | string | Yes | Search query |
| language | string | No | Search in specific translation |
| limit | int | No | Max results (default: 20) |

**Response:** `200 OK`
```json
{
  "meeting_id": "uuid",
  "query": "budget",
  "language": null,
  "matches": [
    {
      "id": "uuid",
      "sequence": 42,
      "text": "We discussed the budget allocation",
      "highlight": "We discussed the <mark>budget</mark> allocation",
      "matched_language": "source",
      ...
    }
  ],
  "total_matches": 5,
  "limit": 20
}
```

---

## Translation

### POST /meetings/{id}/translate
Request translation for a meeting. **Requires auth (owner only).**

**Request Body:**
```json
{
  "target_language": "en"
}
```

**Response:** `200 OK`
```json
{
  "meeting_id": "uuid",
  "target_language": "en",
  "status": "complete",
  "segments_translated": 150,
  "total_segments": 150
}
```

Or if translation is in progress:
```json
{
  "status": "processing",
  "segments_translated": 42,
  "total_segments": 150
}
```

---

## Summary

### POST /meetings/{id}/summary
Generate or retrieve meeting summary. **Requires auth (owner only).**

**Request Body:**
```json
{
  "regenerate": false
}
```

**Response:** `200 OK` (existing summary)
```json
{
  "id": "uuid",
  "content": "This meeting covered quarterly planning...",
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
      "assignee": "John",
      "deadline": "2026-04-10"
    }
  ],
  "created_at": "2026-04-04T11:05:00Z"
}
```

**Response:** `202 Accepted` (generating)
```json
{
  "status": "processing",
  "estimated_seconds": 45
}
```

---

### GET /meetings/{id}/summary
Get existing summary. **Requires auth (owner only).**

**Response:** `200 OK` - Summary object

**Errors:**
- `404 Not Found` - Summary not generated yet

---

## Public Endpoints

### GET /join/{room_code}
Join a meeting by room code. **No auth required.**

**Response:** `200 OK`
```json
{
  "meeting_id": "uuid",
  "title": "Team Standup",
  "source_language": "vi",
  "status": "recording",
  "started_at": "2026-04-04T10:05:00Z",
  "websocket_url": "wss://talkie.app/ws/meeting/{id}/participant?room_code=ABC123"
}
```

---

### GET /join/{room_code}/transcript
Get transcript for a meeting by room code. **No auth required.**

Same response format as `GET /meetings/{id}/transcript`.

---

## Worker API

Internal API for GPU workers to poll and process audio chunks.

### GET /worker/jobs
Poll for pending jobs.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| worker_id | string | Yes | Worker identifier |
| limit | int | No | Max jobs (default: 1, max: 5) |

**Response:** `200 OK`
```json
{
  "jobs": [
    {
      "chunk_id": "uuid",
      "meeting_id": "uuid",
      "sequence": 1,
      "audio_url": "https://minio/...",
      "source_language": "vi",
      "timeout_seconds": 30
    }
  ]
}
```

---

### POST /worker/jobs/{chunk_id}/claim
Claim a job for processing.

**Request Body:**
```json
{
  "worker_id": "colab-worker-1"
}
```

**Response:** `200 OK`
```json
{
  "status": "processing",
  "chunk_id": "uuid",
  "worker_id": "colab-worker-1"
}
```

---

### POST /worker/jobs/{chunk_id}/result
Submit transcription result.

**Request Body:**
```json
{
  "worker_id": "colab-worker-1",
  "segments": [
    {
      "text": "Xin chào mọi người",
      "start_offset_ms": 0,
      "end_offset_ms": 2500,
      "confidence": 0.95
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "status": "accepted",
  "segments_created": 1
}
```

---

### POST /worker/jobs/{chunk_id}/heartbeat
Send heartbeat during processing.

**Request Body:**
```json
{
  "worker_id": "colab-worker-1",
  "progress_percent": 50
}
```

**Response:** `200 OK`
```json
{
  "status": "acknowledged",
  "timeout_extended_to": "2026-04-04T10:06:00Z"
}
```

---

## Health Check

### GET /health
Check API health status.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTHENTICATION_ERROR | 401 | Invalid or missing token |
| AUTHORIZATION_ERROR | 403 | Not permitted |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| VALIDATION_ERROR | 422 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /auth/login | 10/minute |
| /auth/register | 5/minute |
| /worker/* | 1000/minute |
| Default | 100/minute |

Rate limit headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `Retry-After`: Seconds until reset (on 429)
