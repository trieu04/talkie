from __future__ import annotations

import uuid
from collections.abc import Callable, Sequence
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import AppError
from src.models import Meeting, TranscriptSegment
from src.services.summary_service import (
    ChunkSummary,
    SummaryActionItem,
    SummaryDecision,
    SummaryService,
)


def make_scalars_result(values: list[object]) -> MagicMock:
    result = MagicMock()
    scalars = MagicMock()
    scalars.all = MagicMock(return_value=values)
    result.scalars = MagicMock(return_value=scalars)
    return result


class TestSummaryService:
    def test_normalize_text_strips_whitespace_and_trailing_punctuation(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        normalize_text = cast(Callable[[str], str], getattr(service, "_normalize_text"))

        normalized = normalize_text("  Kickoff   meeting agenda ;,  ")

        assert normalized == "Kickoff meeting agenda"

    def test_contains_hint_finds_hint_keywords_case_insensitively(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        contains_hint = cast(
            Callable[[str, Sequence[str]], bool],
            getattr(service, "_contains_hint"),
        )

        assert contains_hint("We DECIDED to ship next week", ("decided",)) is True

    def test_extract_decisions_finds_sentences_with_decision_keywords(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        extract_decisions = cast(
            Callable[[Sequence[str]], list[SummaryDecision]],
            getattr(service, "_extract_decisions"),
        )

        decisions = extract_decisions(
            [
                "We agreed to move forward with the launch",
                "The team reviewed the draft agenda",
            ]
        )

        assert [decision.decision for decision in decisions] == [
            "We agreed to move forward with the launch"
        ]

    def test_extract_action_items_finds_sentences_with_action_keywords(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        extract_action_items = cast(
            Callable[[Sequence[str]], list[SummaryActionItem]],
            getattr(service, "_extract_action_items"),
        )

        action_items = extract_action_items(
            [
                "John will send the report by Friday",
                "The team discussed the draft agenda",
            ]
        )

        assert [item.task for item in action_items] == ["John will send the report by Friday"]

    def test_extract_assignee_extracts_john_will_pattern(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        extract_assignee = cast(Callable[[str], str | None], getattr(service, "_extract_assignee"))

        assignee = extract_assignee("John will send the report by Friday")

        assert assignee == "John"

    def test_extract_deadline_extracts_by_friday_pattern(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        extract_deadline = cast(Callable[[str], str | None], getattr(service, "_extract_deadline"))

        deadline = extract_deadline("John will send the report by Friday")

        assert deadline == "Friday"

    def test_dedupe_preserve_order_removes_duplicates_and_respects_limit(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        dedupe_preserve_order = cast(
            Callable[[Sequence[str], int], list[str]],
            getattr(service, "_dedupe_preserve_order"),
        )

        deduped = dedupe_preserve_order(["Alpha", "beta", "ALPHA", "Gamma", "Delta"], 3)

        assert deduped == ["Alpha", "beta", "Gamma"]

    def test_chunk_segments_splits_segments_into_chunks_of_correct_size(
        self,
        transcript_segment_factory: Callable[..., TranscriptSegment],
    ):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        chunk_segments = cast(
            Callable[[Sequence[TranscriptSegment], int], list[Sequence[TranscriptSegment]]],
            getattr(service, "_chunk_segments"),
        )
        meeting_id = uuid.uuid4()
        segments = [
            transcript_segment_factory(
                meeting_id=meeting_id, sequence=index + 1, text=f"Segment {index + 1}"
            )
            for index in range(5)
        ]

        chunks = chunk_segments(segments, 2)

        assert [len(chunk) for chunk in chunks] == [2, 2, 1]
        assert [segment.sequence for segment in chunks[-1]] == [5]

    def test_render_summary_content_produces_expected_output_structure(self):
        service = SummaryService(MagicMock(), openai_api_key="test-key")
        render_summary_content = cast(
            Callable[[ChunkSummary], str],
            getattr(service, "_render_summary_content"),
        )
        summary = ChunkSummary(
            key_points=["project scope", "delivery timeline"],
            decisions=[
                SummaryDecision(
                    decision="Approved the revised budget", context="Approved the revised budget"
                )
            ],
            action_items=[
                SummaryActionItem(
                    task="John will send the report",
                    assignee="John",
                    deadline="Friday",
                )
            ],
            excerpt="Project scope and delivery timeline were reviewed",
        )

        content = render_summary_content(summary)

        assert (
            content
            == "This meeting covered project scope; delivery timeline. Decisions: Approved the revised budget. Action items: John will send the report."
        )

    @patch("src.services.summary_service.settings")
    async def test_generate_summary_raises_app_error_when_no_segments_exist(
        self,
        mock_settings: MagicMock,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
    ):
        mock_settings.openai_api_key = None
        meeting = meeting_factory()
        mock_db_session.get = AsyncMock(return_value=meeting)
        mock_db_session.execute = AsyncMock(return_value=make_scalars_result([]))
        service = SummaryService(mock_db_session)

        with pytest.raises(AppError, match="Transcript is not available for summary generation"):
            _ = await service.generate_summary(meeting.id)
