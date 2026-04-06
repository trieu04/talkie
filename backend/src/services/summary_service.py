from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import ClassVar, cast
from uuid import UUID

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.exceptions import AppError, NotFoundError
from src.models import Meeting, MeetingSummary, TranscriptSegment


@dataclass(slots=True)
class SummaryDecision:
    decision: str
    context: str


@dataclass(slots=True)
class SummaryActionItem:
    task: str
    assignee: str | None
    deadline: str | None


@dataclass(slots=True)
class SummaryPayload:
    content: str
    key_points: list[str]
    decisions: list[dict[str, str]]
    action_items: list[dict[str, str | None]]
    transcript_snapshot_at: datetime
    provider: str


@dataclass(slots=True)
class ChunkSummary:
    key_points: list[str]
    decisions: list[SummaryDecision]
    action_items: list[SummaryActionItem]
    excerpt: str


class SummaryService:
    CHUNK_SIZE: ClassVar[int] = 50
    TRANSCRIPT_PAGE_SIZE: ClassVar[int] = 500
    PROVIDER_NAME: ClassVar[str] = "mock-openai"
    DECISION_HINTS: ClassVar[tuple[str, ...]] = (
        "decided",
        "decision",
        "agree",
        "agreed",
        "approved",
        "resolved",
        "will proceed",
        "thống nhất",
        "quyết định",
        "chốt",
    )
    ACTION_HINTS: ClassVar[tuple[str, ...]] = (
        "will",
        "action item",
        "follow up",
        "next step",
        "todo",
        "need to",
        "should",
        "assign",
        "prepare",
        "send",
        "review",
        "update",
        "cần",
        "sẽ",
        "phụ trách",
    )
    DEADLINE_PATTERNS: ClassVar[tuple[re.Pattern[str], ...]] = (
        re.compile(
            r"\bby\s+([A-Z][a-z]+\s+\d{1,2}|tomorrow|next\s+week|friday|monday)\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(before\s+[A-Z][a-z]+\s+\d{1,2}|end\s+of\s+week|EOW)\b",
            re.IGNORECASE,
        ),
    )
    ASSIGNEE_PATTERNS: ClassVar[tuple[re.Pattern[str], ...]] = (
        re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|to)\b"),
        re.compile(r"\bassigned to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", re.IGNORECASE),
    )

    def __init__(self, db: AsyncSession, openai_api_key: str | None = None) -> None:
        self.db: AsyncSession = db
        self.openai_api_key: str | None = openai_api_key or settings.openai_api_key

    async def get_summary(self, meeting_id: UUID) -> MeetingSummary | None:
        result = await self.db.execute(
            select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
        )
        return result.scalar_one_or_none()

    async def get_summary_or_raise(self, meeting_id: UUID) -> MeetingSummary:
        summary = await self.get_summary(meeting_id)
        if summary is None:
            raise NotFoundError("Meeting summary not found")
        return summary

    async def ensure_summary(
        self,
        meeting_id: UUID,
        regenerate: bool = False,
    ) -> tuple[MeetingSummary, bool]:
        meeting = await self._get_meeting_or_raise(meeting_id)
        existing = await self.get_summary(meeting_id)
        if existing is not None and not regenerate:
            return existing, False

        payload = await self.generate_summary(meeting.id)
        summary = existing or MeetingSummary(meeting_id=meeting.id)
        if existing is None:
            self.db.add(summary)

        summary.content = payload.content
        summary.key_points = cast(list[object], payload.key_points)
        summary.decisions = cast(list[object], payload.decisions)
        summary.action_items = cast(list[object], payload.action_items)
        summary.transcript_snapshot_at = payload.transcript_snapshot_at
        summary.provider = payload.provider

        await self.db.commit()
        await self.db.refresh(summary)
        return summary, True

    async def generate_summary(self, meeting_id: UUID) -> SummaryPayload:
        _ = await self._get_meeting_or_raise(meeting_id)
        segments = await self._get_all_segments(meeting_id)
        if not segments:
            raise AppError(
                message="Transcript is not available for summary generation",
                code="SUMMARY_TRANSCRIPT_EMPTY",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        chunk_summaries = [
            self._summarize_chunk(chunk)
            for chunk in self._chunk_segments(segments, chunk_size=self.CHUNK_SIZE)
        ]
        merged_summary = self._merge_chunk_summaries(chunk_summaries)

        return SummaryPayload(
            content=self._render_summary_content(merged_summary),
            key_points=merged_summary.key_points,
            decisions=[
                {"decision": item.decision, "context": item.context}
                for item in merged_summary.decisions
            ],
            action_items=[
                {
                    "task": item.task,
                    "assignee": item.assignee,
                    "deadline": item.deadline,
                }
                for item in merged_summary.action_items
            ],
            transcript_snapshot_at=datetime.now(UTC),
            provider=self.PROVIDER_NAME,
        )

    async def _get_meeting_or_raise(self, meeting_id: UUID) -> Meeting:
        meeting = await self.db.get(Meeting, meeting_id)
        if meeting is None:
            raise NotFoundError("Meeting not found")
        return meeting

    async def _get_all_segments(self, meeting_id: UUID) -> list[TranscriptSegment]:
        segments: list[TranscriptSegment] = []
        offset = 0

        while True:
            result = await self.db.execute(
                select(TranscriptSegment)
                .where(TranscriptSegment.meeting_id == meeting_id)
                .order_by(TranscriptSegment.sequence.asc())
                .limit(self.TRANSCRIPT_PAGE_SIZE)
                .offset(offset)
            )
            batch = list(result.scalars().all())
            if not batch:
                break

            segments.extend(batch)
            if len(batch) < self.TRANSCRIPT_PAGE_SIZE:
                break
            offset += self.TRANSCRIPT_PAGE_SIZE

        return segments

    def _chunk_segments(
        self,
        segments: Sequence[TranscriptSegment],
        chunk_size: int,
    ) -> list[Sequence[TranscriptSegment]]:
        return [
            segments[start : start + chunk_size] for start in range(0, len(segments), chunk_size)
        ]

    def _summarize_chunk(self, segments: Sequence[TranscriptSegment]) -> ChunkSummary:
        normalized_sentences = self._normalized_sentences(segments)
        excerpt = " ".join(normalized_sentences[:3])
        key_points = self._dedupe_preserve_order(normalized_sentences, limit=4)
        decisions = self._extract_decisions(normalized_sentences)
        action_items = self._extract_action_items(normalized_sentences)

        if not key_points and excerpt:
            key_points = [excerpt]

        return ChunkSummary(
            key_points=key_points,
            decisions=decisions,
            action_items=action_items,
            excerpt=excerpt,
        )

    def _merge_chunk_summaries(self, chunk_summaries: Sequence[ChunkSummary]) -> ChunkSummary:
        merged_key_points: list[str] = []
        merged_decisions: list[SummaryDecision] = []
        merged_action_items: list[SummaryActionItem] = []
        excerpts: list[str] = []

        for chunk_summary in chunk_summaries:
            merged_key_points.extend(chunk_summary.key_points)
            merged_decisions.extend(chunk_summary.decisions)
            merged_action_items.extend(chunk_summary.action_items)
            if chunk_summary.excerpt:
                excerpts.append(chunk_summary.excerpt)

        key_points = self._dedupe_preserve_order(merged_key_points, limit=8)
        decisions = self._dedupe_decisions(merged_decisions, limit=5)
        action_items = self._dedupe_action_items(merged_action_items, limit=8)
        excerpt = " ".join(excerpts[:2])

        if not key_points and excerpt:
            key_points = [excerpt]

        return ChunkSummary(
            key_points=key_points,
            decisions=decisions,
            action_items=action_items,
            excerpt=excerpt,
        )

    def _render_summary_content(self, summary: ChunkSummary) -> str:
        sections: list[str] = []
        if summary.key_points:
            sections.append("This meeting covered " + "; ".join(summary.key_points[:3]) + ".")
        if summary.decisions:
            sections.append(
                "Decisions: "
                + "; ".join(decision.decision for decision in summary.decisions[:3])
                + "."
            )
        if summary.action_items:
            sections.append(
                "Action items: " + "; ".join(item.task for item in summary.action_items[:3]) + "."
            )

        if sections:
            return " ".join(sections)
        if summary.excerpt:
            return summary.excerpt
        return "Summary unavailable."

    def _normalized_sentences(self, segments: Sequence[TranscriptSegment]) -> list[str]:
        sentences: list[str] = []
        for segment in segments:
            text = self._normalize_text(segment.text)
            if not text:
                continue
            if segment.is_partial:
                text = f"{text} (partial)"
            sentences.append(text)
        return sentences

    def _normalize_text(self, text: str) -> str:
        normalized = re.sub(r"\s+", " ", text).strip()
        return normalized.rstrip(" ,;")

    def _extract_decisions(self, sentences: Sequence[str]) -> list[SummaryDecision]:
        decisions: list[SummaryDecision] = []
        for sentence in sentences:
            if not self._contains_hint(sentence, self.DECISION_HINTS):
                continue
            decisions.append(
                SummaryDecision(
                    decision=sentence,
                    context=self._shorten(sentence, 180),
                )
            )
        return self._dedupe_decisions(decisions, limit=3)

    def _extract_action_items(self, sentences: Sequence[str]) -> list[SummaryActionItem]:
        items: list[SummaryActionItem] = []
        for sentence in sentences:
            if not self._contains_hint(sentence, self.ACTION_HINTS):
                continue
            items.append(
                SummaryActionItem(
                    task=self._shorten(sentence, 180),
                    assignee=self._extract_assignee(sentence),
                    deadline=self._extract_deadline(sentence),
                )
            )
        return self._dedupe_action_items(items, limit=3)

    def _extract_assignee(self, sentence: str) -> str | None:
        for pattern in self.ASSIGNEE_PATTERNS:
            match = pattern.search(sentence)
            if match is not None:
                return match.group(1)
        return None

    def _extract_deadline(self, sentence: str) -> str | None:
        for pattern in self.DEADLINE_PATTERNS:
            match = pattern.search(sentence)
            if match is not None:
                return match.group(1)
        return None

    def _contains_hint(self, sentence: str, hints: Sequence[str]) -> bool:
        normalized = sentence.casefold()
        return any(hint.casefold() in normalized for hint in hints)

    def _shorten(self, value: str, limit: int) -> str:
        if len(value) <= limit:
            return value
        return value[: limit - 3].rstrip() + "..."

    def _dedupe_preserve_order(self, values: Sequence[str], limit: int) -> list[str]:
        seen: set[str] = set()
        deduped: list[str] = []
        for value in values:
            key = value.casefold()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(value)
            if len(deduped) >= limit:
                break
        return deduped

    def _dedupe_decisions(
        self,
        decisions: Sequence[SummaryDecision],
        limit: int,
    ) -> list[SummaryDecision]:
        seen: set[str] = set()
        deduped: list[SummaryDecision] = []
        for decision in decisions:
            key = decision.decision.casefold()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(decision)
            if len(deduped) >= limit:
                break
        return deduped

    def _dedupe_action_items(
        self,
        action_items: Sequence[SummaryActionItem],
        limit: int,
    ) -> list[SummaryActionItem]:
        seen: set[str] = set()
        deduped: list[SummaryActionItem] = []
        for action_item in action_items:
            key = action_item.task.casefold()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(action_item)
            if len(deduped) >= limit:
                break
        return deduped
