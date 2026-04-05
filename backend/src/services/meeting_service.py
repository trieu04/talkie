from __future__ import annotations

import secrets
import string
from datetime import UTC, datetime
from typing import ClassVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppError, AuthorizationError, ConflictError, NotFoundError
from src.models import Meeting, MeetingStatus


class MeetingService:
    ROOM_CODE_ALPHABET: ClassVar[str] = string.ascii_uppercase + string.digits
    ROOM_CODE_LENGTH: ClassVar[int] = 6
    ROOM_CODE_MAX_ATTEMPTS: ClassVar[int] = 20

    def __init__(self, db: AsyncSession):
        self.db: AsyncSession = db

    async def create_meeting(
        self, host_id: UUID, title: str | None, source_language: str
    ) -> Meeting:
        normalized_title = title.strip() if title is not None else None
        if normalized_title == "":
            normalized_title = None

        for _ in range(self.ROOM_CODE_MAX_ATTEMPTS):
            room_code = self.generate_room_code()
            if await self.get_meeting_by_room_code(room_code) is not None:
                continue

            meeting = Meeting(
                host_id=host_id,
                title=normalized_title,
                source_language=source_language,
                room_code=room_code,
                status=MeetingStatus.CREATED,
            )
            self.db.add(meeting)

            try:
                await self.db.commit()
            except IntegrityError:
                await self.db.rollback()
                continue

            await self.db.refresh(meeting)
            return meeting

        raise ConflictError("Unable to generate a unique room code")

    async def get_meeting(self, meeting_id: UUID) -> Meeting | None:
        result = await self.db.execute(select(Meeting).where(Meeting.id == meeting_id))
        return result.scalar_one_or_none()

    async def get_meeting_by_room_code(self, room_code: str) -> Meeting | None:
        normalized_room_code = room_code.upper()
        result = await self.db.execute(
            select(Meeting).where(Meeting.room_code == normalized_room_code)
        )
        return result.scalar_one_or_none()

    async def start_meeting(self, meeting_id: UUID, host_id: UUID) -> Meeting:
        meeting = await self._get_owned_meeting(meeting_id, host_id)
        self._ensure_status(meeting, {MeetingStatus.CREATED}, "start")
        await self._ensure_no_other_active_meeting(host_id, exclude_meeting_id=meeting.id)

        meeting.status = MeetingStatus.RECORDING
        meeting.started_at = meeting.started_at or datetime.now(UTC)

        return await self._commit_and_refresh(meeting)

    async def stop_meeting(
        self, meeting_id: UUID, host_id: UUID, abnormal: bool = False
    ) -> Meeting:
        meeting = await self._get_owned_meeting(meeting_id, host_id)
        self._ensure_status(meeting, {MeetingStatus.RECORDING, MeetingStatus.PAUSED}, "stop")

        meeting.status = MeetingStatus.ENDED_ABNORMAL if abnormal else MeetingStatus.ENDED
        meeting.ended_at = datetime.now(UTC)

        return await self._commit_and_refresh(meeting)

    async def pause_meeting(self, meeting_id: UUID, host_id: UUID) -> Meeting:
        meeting = await self._get_owned_meeting(meeting_id, host_id)
        self._ensure_status(meeting, {MeetingStatus.RECORDING}, "pause")

        meeting.status = MeetingStatus.PAUSED
        return await self._commit_and_refresh(meeting)

    async def resume_meeting(self, meeting_id: UUID, host_id: UUID) -> Meeting:
        meeting = await self._get_owned_meeting(meeting_id, host_id)
        self._ensure_status(meeting, {MeetingStatus.PAUSED}, "resume")
        await self._ensure_no_other_active_meeting(host_id, exclude_meeting_id=meeting.id)

        meeting.status = MeetingStatus.RECORDING
        return await self._commit_and_refresh(meeting)

    async def list_meetings(
        self, host_id: UUID, status: str | None, limit: int, offset: int
    ) -> tuple[list[Meeting], int]:
        filters = [Meeting.host_id == host_id]

        if status is not None:
            filters.append(Meeting.status == self._parse_status(status))

        items_result = await self.db.execute(
            select(Meeting)
            .where(*filters)
            .order_by(Meeting.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        count_result = await self.db.execute(
            select(func.count()).select_from(Meeting).where(*filters)
        )

        meetings = list(items_result.scalars().all())
        total = count_result.scalar_one()
        return meetings, total

    @staticmethod
    def generate_room_code() -> str:
        return "".join(
            secrets.choice(MeetingService.ROOM_CODE_ALPHABET)
            for _ in range(MeetingService.ROOM_CODE_LENGTH)
        )

    async def _get_owned_meeting(self, meeting_id: UUID, host_id: UUID) -> Meeting:
        meeting = await self.get_meeting(meeting_id)
        if meeting is None:
            raise NotFoundError("Meeting not found")
        if meeting.host_id != host_id:
            raise AuthorizationError("Only the meeting host can perform this action")
        return meeting

    async def _ensure_no_other_active_meeting(
        self, host_id: UUID, exclude_meeting_id: UUID | None = None
    ) -> None:
        query = select(Meeting).where(
            Meeting.host_id == host_id,
            Meeting.status == MeetingStatus.RECORDING,
        )
        if exclude_meeting_id is not None:
            query = query.where(Meeting.id != exclude_meeting_id)

        result = await self.db.execute(query)
        if result.scalar_one_or_none() is not None:
            raise ConflictError("Host already has an active meeting recording")

    def _ensure_status(
        self, meeting: Meeting, allowed_statuses: set[MeetingStatus], action: str
    ) -> None:
        if meeting.status not in allowed_statuses:
            allowed = ", ".join(status.value for status in sorted(allowed_statuses, key=str))
            raise AppError(
                message=(
                    f"Cannot {action} meeting while status is '{meeting.status.value}'. "
                    f"Allowed statuses: {allowed}"
                ),
                code="INVALID_STATUS_TRANSITION",
                status_code=400,
            )

    def _parse_status(self, status: str) -> MeetingStatus:
        try:
            return MeetingStatus(status)
        except ValueError:
            raise AppError(
                message=f"Invalid meeting status '{status}'",
                code="INVALID_MEETING_STATUS",
                status_code=400,
            )

    async def _commit_and_refresh(self, meeting: Meeting) -> Meeting:
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictError(
                "Meeting state conflicts with an existing active recording"
            ) from exc

        await self.db.refresh(meeting)
        return meeting
