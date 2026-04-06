# Architecture Decisions

## Translation Caching

- source transcript is always stored first
- translations are generated on demand per target language
- cached translations are stored in `segment_translations`
- replay and live views reuse the same cached translation records

## Summary Generation

- summaries are generated from persisted transcript segments
- repeated requests reuse an existing summary unless regeneration is requested
- summary content is stored alongside structured `key_points`, `decisions`, and `action_items`

## Replay Delivery

- host replay uses authenticated meeting-id endpoints
- participant replay uses public room-code endpoints gated to ended meetings only
- transcript pagination remains the primary replay delivery mechanism for large meetings
