# Data Model: Realtime Meeting Transcription

**Feature**: 007-realtime-meeting-transcription  
**Date**: 2026-04-04  
**Database**: PostgreSQL with SQLAlchemy 2.0

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────────┐
│     Host        │       │      Meeting        │
├─────────────────┤       ├─────────────────────┤
│ id (PK)         │──1:N──│ id (PK)             │
│ email           │       │ host_id (FK)        │
│ password_hash   │       │ room_code           │
│ display_name    │       │ source_language     │
│ created_at      │       │ status              │
│ updated_at      │       │ started_at          │
└─────────────────┘       │ ended_at            │
                          │ created_at          │
                          │ updated_at          │
                          └─────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                   1:N            1:N            1:1
                    │              │              │
                    ▼              ▼              ▼
        ┌───────────────┐  ┌─────────────┐  ┌─────────────────┐
        │ AudioChunk    │  │ Transcript  │  │ MeetingSummary  │
        │               │  │ Segment     │  │                 │
        ├───────────────┤  ├─────────────┤  ├─────────────────┤
        │ id (PK)       │  │ id (PK)     │  │ id (PK)         │
        │ meeting_id(FK)│  │ meeting_id  │  │ meeting_id (FK) │
        │ sequence      │  │ (FK)        │  │ content         │
        │ storage_key   │  │ sequence    │  │ key_points      │
        │ status        │  │ text        │  │ decisions       │
        │ duration_ms   │  │ start_time  │  │ action_items    │
        │ created_at    │  │ end_time    │  │ created_at      │
        └───────────────┘  │ created_at  │  └─────────────────┘
                           └─────────────┘
                                  │
                                 1:N
                                  │
                                  ▼
                       ┌──────────────────┐
                       │ SegmentTransla-  │
                       │ tion             │
                       ├──────────────────┤
                       │ id (PK)          │
                       │ segment_id (FK)  │
                       │ target_language  │
                       │ translated_text  │
                       │ created_at       │
                       └──────────────────┘
```

---

## Entities

### Host (Tài khoản host)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| `password_hash` | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| `display_name` | VARCHAR(100) | NOT NULL | Display name shown in meetings |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `ix_hosts_email` on `email` (unique)

**Business Rules**:
- Email must be valid format and unique
- Password must meet minimum security requirements (8+ chars, mixed case, number)
- One host can create many meetings

---

### Meeting (Cuộc họp)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `host_id` | UUID | FK → hosts.id, NOT NULL | Meeting creator |
| `room_code` | VARCHAR(10) | UNIQUE, NOT NULL | 6-8 char alphanumeric code for joining |
| `title` | VARCHAR(255) | NULL | Optional meeting title |
| `source_language` | VARCHAR(10) | NOT NULL, DEFAULT 'vi' | Primary transcript language (ISO 639-1) |
| `status` | ENUM | NOT NULL, DEFAULT 'created' | Meeting state |
| `started_at` | TIMESTAMP | NULL | When recording started |
| `ended_at` | TIMESTAMP | NULL | When recording ended |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Meeting creation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Status Enum Values**:
- `created` - Meeting created but not started
- `recording` - Host is actively recording
- `paused` - Recording paused
- `ended` - Recording ended normally
- `ended_abnormal` - Browser closed or connection lost during recording

**Indexes**:
- `ix_meetings_room_code` on `room_code` (unique)
- `ix_meetings_host_id` on `host_id`
- `ix_meetings_status` on `status`
- `ix_meetings_created_at` on `created_at` DESC

**Business Rules**:
- Room code generated on create, 6-8 alphanumeric chars, case-insensitive
- Only one meeting per host can be in `recording` status at a time
- Source language selected before recording starts, immutable during meeting
- Transition: created → recording → (paused ↔ recording) → ended | ended_abnormal

---

### AudioChunk (Đoạn âm thanh)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `meeting_id` | UUID | FK → meetings.id, NOT NULL | Parent meeting |
| `sequence` | INTEGER | NOT NULL | Chunk ordering (0-indexed) |
| `storage_key` | VARCHAR(500) | NOT NULL | S3/MinIO object key |
| `duration_ms` | INTEGER | NOT NULL | Chunk duration in milliseconds |
| `status` | ENUM | NOT NULL, DEFAULT 'pending' | Processing state |
| `worker_id` | VARCHAR(100) | NULL | Assigned Colab worker identifier |
| `assigned_at` | TIMESTAMP | NULL | When assigned to worker |
| `completed_at` | TIMESTAMP | NULL | When processing finished |
| `error_message` | TEXT | NULL | Error details if failed |
| `retry_count` | INTEGER | NOT NULL, DEFAULT 0 | Number of processing attempts |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Upload time |

**Status Enum Values**:
- `pending` - Waiting for worker
- `assigned` - Worker has claimed this chunk
- `processing` - Worker is running STT
- `completed` - Transcript generated successfully
- `failed` - Processing failed after retries

**Indexes**:
- `ix_audio_chunks_meeting_sequence` on `(meeting_id, sequence)` (unique)
- `ix_audio_chunks_status` on `status`
- `ix_audio_chunks_pending` on `(status, created_at)` WHERE status = 'pending'

**Business Rules**:
- Sequence numbers are contiguous per meeting (0, 1, 2, ...)
- Storage key pattern: `meetings/{meeting_id}/audio/{sequence}.opus`
- If worker doesn't respond within timeout (30s), reassign to another worker
- Max retry count: 3, then mark as failed
- Chunk duration target: 4000ms with 750ms overlap

---

### TranscriptSegment (Đoạn phiên âm)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `meeting_id` | UUID | FK → meetings.id, NOT NULL | Parent meeting |
| `audio_chunk_id` | UUID | FK → audio_chunks.id, NULL | Source audio chunk |
| `sequence` | INTEGER | NOT NULL | Display ordering |
| `text` | TEXT | NOT NULL | Transcribed text |
| `start_time_ms` | INTEGER | NOT NULL | Start offset from meeting start |
| `end_time_ms` | INTEGER | NOT NULL | End offset from meeting start |
| `confidence` | FLOAT | NULL | STT confidence score (0-1) |
| `is_partial` | BOOLEAN | NOT NULL, DEFAULT FALSE | True if still being updated |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `ix_transcript_segments_meeting_sequence` on `(meeting_id, sequence)`
- `ix_transcript_segments_meeting_time` on `(meeting_id, start_time_ms)`
- `ix_transcript_segments_search` GIN index on `to_tsvector('simple', text)`

**Business Rules**:
- Segments ordered by sequence within meeting
- Partial segments can be updated until finalized (is_partial = FALSE)
- Text is in source language of meeting
- Multiple segments may come from one audio chunk (sentence boundaries)

---

### SegmentTranslation (Bản dịch đoạn)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `segment_id` | UUID | FK → transcript_segments.id, NOT NULL | Source segment |
| `target_language` | VARCHAR(10) | NOT NULL | Target language (ISO 639-1) |
| `translated_text` | TEXT | NOT NULL | Translated content |
| `provider` | VARCHAR(50) | NOT NULL | Translation service used |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Translation time |

**Indexes**:
- `ix_segment_translations_segment_lang` on `(segment_id, target_language)` (unique)
- `ix_segment_translations_search` GIN index on `to_tsvector('simple', translated_text)`

**Business Rules**:
- One translation per (segment, target_language) pair
- Created on-demand when user requests language
- Provider values: `google_nmt`, `google_tllm`, `deepl`, `openai`
- Cached permanently after creation

---

### MeetingSummary (Tổng hợp cuộc họp)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `meeting_id` | UUID | FK → meetings.id, UNIQUE, NOT NULL | Parent meeting |
| `content` | TEXT | NOT NULL | Full summary text |
| `key_points` | JSONB | NOT NULL, DEFAULT '[]' | Array of key points |
| `decisions` | JSONB | NOT NULL, DEFAULT '[]' | Array of decisions made |
| `action_items` | JSONB | NOT NULL, DEFAULT '[]' | Array of action items |
| `transcript_snapshot_at` | TIMESTAMP | NOT NULL | Transcript state used for summary |
| `provider` | VARCHAR(50) | NOT NULL | LLM service used |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Summary generation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last regeneration time |

**Indexes**:
- `ix_meeting_summaries_meeting` on `meeting_id` (unique)

**JSONB Structure**:
```json
{
  "key_points": ["Point 1", "Point 2"],
  "decisions": [
    {"decision": "...", "context": "..."}
  ],
  "action_items": [
    {"task": "...", "assignee": null, "deadline": null}
  ]
}
```

**Business Rules**:
- One summary per meeting (can be regenerated)
- Created on-demand when user requests
- Can be generated during meeting (partial) or after
- Provider values: `openai_gpt5_mini`, `openai_gpt5`, `claude_sonnet`

---

### Participant (Người tham gia - Session-based, Redis)

This entity is stored in **Redis**, not PostgreSQL, as it's ephemeral session data.

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | STRING | WebSocket session identifier |
| `meeting_id` | UUID | Current meeting |
| `role` | ENUM | `host` or `viewer` |
| `display_name` | STRING | Shown name (optional for viewers) |
| `target_language` | STRING | Selected translation language (NULL = source only) |
| `joined_at` | TIMESTAMP | Session start time |
| `last_seen_at` | TIMESTAMP | Last activity (heartbeat) |

**Redis Key Patterns**:
- `meeting:{meeting_id}:participants` - Hash of session_id → participant data
- `meeting:{meeting_id}:participant_count` - Integer counter
- `session:{session_id}:meeting` - Reverse lookup

**TTL**: 30 minutes after last_seen_at, cleaned up on disconnect

---

## Full-Text Search

### Meeting Search View

For efficient searching across meetings:

```sql
CREATE MATERIALIZED VIEW meeting_search_documents AS
SELECT 
  m.id AS meeting_id,
  m.host_id,
  m.title,
  m.source_language,
  m.created_at,
  string_agg(ts.text, ' ' ORDER BY ts.sequence) AS full_transcript,
  to_tsvector('simple', coalesce(m.title, '') || ' ' || 
    string_agg(ts.text, ' ' ORDER BY ts.sequence)) AS search_vector
FROM meetings m
LEFT JOIN transcript_segments ts ON ts.meeting_id = m.id AND ts.is_partial = FALSE
GROUP BY m.id;

CREATE INDEX ix_meeting_search_vector ON meeting_search_documents USING GIN(search_vector);
```

**Refresh**: After meeting ends or on-demand

---

## State Transitions

### Meeting Status

```
          ┌─────────────┐
          │   created   │
          └──────┬──────┘
                 │ start_recording()
                 ▼
          ┌─────────────┐
    ┌─────│  recording  │─────┐
    │     └──────┬──────┘     │
    │            │            │
    │ pause()    │ stop()     │ connection_lost()
    │            │            │
    ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌──────────────┐
│ paused  │  │  ended  │  │ended_abnormal│
└────┬────┘  └─────────┘  └──────────────┘
     │
     │ resume()
     │
     └────────► recording
```

### AudioChunk Status

```
          ┌─────────┐
          │ pending │
          └────┬────┘
               │ worker_claim()
               ▼
          ┌──────────┐
          │ assigned │
          └────┬─────┘
               │ worker_start()
               ▼
          ┌────────────┐
          │ processing │
          └─────┬──────┘
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
┌───────────┐      ┌──────────┐
│ completed │      │  failed  │
└───────────┘      └────┬─────┘
                        │
                        │ retry_count < 3
                        │
                        └────► pending (reassign)
```

---

## Validation Rules

### Host
- `email`: Valid email format, max 255 chars
- `password`: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
- `display_name`: 1-100 chars, no leading/trailing whitespace

### Meeting
- `room_code`: 6-8 alphanumeric chars, auto-generated
- `source_language`: Valid ISO 639-1 code (vi, en, ja, zh, ko, etc.)
- `title`: 0-255 chars (optional)

### AudioChunk
- `duration_ms`: 1000-10000 (1-10 seconds)
- `sequence`: >= 0, contiguous per meeting

### TranscriptSegment
- `text`: 1-10000 chars
- `start_time_ms`: >= 0
- `end_time_ms`: > start_time_ms
- `confidence`: 0.0-1.0 (nullable)

### SegmentTranslation
- `target_language`: Valid ISO 639-1, different from meeting source_language

---

## Partitioning Strategy

For large-scale deployments:

### transcript_segments
Partition by `meeting_id` hash or by `created_at` range (monthly)

```sql
CREATE TABLE transcript_segments (
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE transcript_segments_2026_04 
  PARTITION OF transcript_segments
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

### audio_chunks
Partition by `created_at` range (monthly), with automatic cleanup of old partitions

---

## Migration Notes

1. **Initial migration**: Create all tables with indexes
2. **Add GIN indexes**: After initial data load for better performance
3. **Materialized view**: Create after first meetings complete
4. **Partitioning**: Add when transcript_segments exceeds 10M rows
