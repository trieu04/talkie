from __future__ import annotations

from alembic import op

revision = "20260405_000002"
down_revision = "20260405_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _execute_concurrently(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transcript_segments_meeting_sequence "
        + "ON transcript_segments (meeting_id, sequence)"
    )
    _execute_concurrently(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transcript_segments_meeting_created_at "
        + "ON transcript_segments (meeting_id, created_at)"
    )
    _execute_concurrently(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_segment_translations_segment_lang "
        + "ON segment_translations (segment_id, target_language)"
    )
    _execute_concurrently(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_audio_chunks_meeting_status "
        + "ON audio_chunks (meeting_id, status)"
    )


def downgrade() -> None:
    _execute_concurrently("DROP INDEX CONCURRENTLY IF EXISTS ix_audio_chunks_meeting_status")
    _execute_concurrently("DROP INDEX CONCURRENTLY IF EXISTS ix_segment_translations_segment_lang")
    _execute_concurrently(
        "DROP INDEX CONCURRENTLY IF EXISTS ix_transcript_segments_meeting_created_at"
    )
    _execute_concurrently(
        "DROP INDEX CONCURRENTLY IF EXISTS ix_transcript_segments_meeting_sequence"
    )


def _execute_concurrently(statement: str) -> None:
    with op.get_context().autocommit_block():
        op.execute(statement)
