# Replay Access Model

## Public Replay Scope

Replay access is room-code based and only available for meetings whose status is:

- `ended`
- `ended_abnormal`

Live meetings remain joinable through WebSocket participation, but historical transcript, search,
summary, and translation replay endpoints reject non-ended meetings.

## Public Replay Endpoints

- `GET /api/v1/meetings/join/{room_code}/transcript`
- `GET /api/v1/meetings/join/{room_code}/transcript/search`
- `GET /api/v1/meetings/join/{room_code}/summary`
- `POST /api/v1/meetings/join/{room_code}/summary`
- `POST /api/v1/meetings/join/{room_code}/translate`

Equivalent root-level `/join/{room_code}/...` routes remain available for non-versioned public access.

## Security Notes

- room-code endpoints are rate limited separately from authenticated host endpoints
- request logging records the path but avoids logging auth query strings
- public replay uses ended-only gating through `MeetingService.get_replay_meeting_by_room_code`
