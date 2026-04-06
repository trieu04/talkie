from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260405_000001"
down_revision = None
branch_labels = None
depends_on = None


meeting_status = postgresql.ENUM(
    "created",
    "recording",
    "paused",
    "ended",
    "ended_abnormal",
    name="meeting_status",
    create_type=False,
)

audio_chunk_status = postgresql.ENUM(
    "pending",
    "assigned",
    "processing",
    "completed",
    "failed",
    name="audio_chunk_status",
    create_type=False,
)


def upgrade() -> None:
    meeting_status.create(op.get_bind(), checkfirst=True)
    audio_chunk_status.create(op.get_bind(), checkfirst=True)

    _ = op.create_table(
        "hosts",
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_hosts")),
    )
    op.create_index(op.f("ix_hosts_email"), "hosts", ["email"], unique=True)

    _ = op.create_table(
        "meetings",
        sa.Column("host_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("room_code", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("source_language", sa.String(length=10), server_default="vi", nullable=False),
        sa.Column("status", meeting_status, server_default="created", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["host_id"], ["hosts.id"], name=op.f("fk_meetings_host_id_hosts"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_meetings")),
    )
    op.create_index(op.f("ix_meetings_room_code"), "meetings", ["room_code"], unique=True)
    op.create_index("ix_meetings_host_id", "meetings", ["host_id"], unique=False)
    op.create_index("ix_meetings_status", "meetings", ["status"], unique=False)
    op.create_index(
        "ix_meetings_created_at", "meetings", [sa.text("created_at DESC")], unique=False
    )
    op.create_index(
        "uq_meetings_host_recording",
        "meetings",
        ["host_id"],
        unique=True,
        postgresql_where=sa.text("status = 'recording'"),
    )

    _ = op.create_table(
        "audio_chunks",
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("status", audio_chunk_status, server_default="pending", nullable=False),
        sa.Column("worker_id", sa.String(length=100), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["meeting_id"],
            ["meetings.id"],
            name=op.f("fk_audio_chunks_meeting_id_meetings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audio_chunks")),
    )
    op.create_index(
        "ix_audio_chunks_meeting_sequence", "audio_chunks", ["meeting_id", "sequence"], unique=True
    )
    op.create_index("ix_audio_chunks_status", "audio_chunks", ["status"], unique=False)
    op.create_index(
        "ix_audio_chunks_pending",
        "audio_chunks",
        ["status", "created_at"],
        unique=False,
        postgresql_where=sa.text("status = 'pending'"),
    )

    _ = op.create_table(
        "transcript_segments",
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("audio_chunk_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("start_time_ms", sa.Integer(), nullable=False),
        sa.Column("end_time_ms", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("is_partial", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["audio_chunk_id"],
            ["audio_chunks.id"],
            name=op.f("fk_transcript_segments_audio_chunk_id_audio_chunks"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["meeting_id"],
            ["meetings.id"],
            name=op.f("fk_transcript_segments_meeting_id_meetings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transcript_segments")),
    )
    op.create_index(
        "ix_transcript_segments_meeting_sequence",
        "transcript_segments",
        ["meeting_id", "sequence"],
        unique=False,
    )
    op.create_index(
        "ix_transcript_segments_meeting_time",
        "transcript_segments",
        ["meeting_id", "start_time_ms"],
        unique=False,
    )
    op.execute(
        "CREATE INDEX ix_transcript_segments_search ON transcript_segments USING gin (to_tsvector('simple', text))"
    )

    _ = op.create_table(
        "segment_translations",
        sa.Column("segment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_language", sa.String(length=10), nullable=False),
        sa.Column("translated_text", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["segment_id"],
            ["transcript_segments.id"],
            name=op.f("fk_segment_translations_segment_id_transcript_segments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_segment_translations")),
    )
    op.create_index(
        "ix_segment_translations_segment_lang",
        "segment_translations",
        ["segment_id", "target_language"],
        unique=True,
    )
    op.execute(
        "CREATE INDEX ix_segment_translations_search ON segment_translations USING gin (to_tsvector('simple', translated_text))"
    )

    _ = op.create_table(
        "meeting_summaries",
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "key_points",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "decisions",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "action_items",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("transcript_snapshot_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["meeting_id"],
            ["meetings.id"],
            name=op.f("fk_meeting_summaries_meeting_id_meetings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_meeting_summaries")),
    )
    op.create_index(
        op.f("ix_meeting_summaries_meeting_id"), "meeting_summaries", ["meeting_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_meeting_summaries_meeting_id"), table_name="meeting_summaries")
    op.drop_table("meeting_summaries")

    op.execute("DROP INDEX ix_segment_translations_search")
    op.drop_index("ix_segment_translations_segment_lang", table_name="segment_translations")
    op.drop_table("segment_translations")

    op.execute("DROP INDEX ix_transcript_segments_search")
    op.drop_index("ix_transcript_segments_meeting_time", table_name="transcript_segments")
    op.drop_index("ix_transcript_segments_meeting_sequence", table_name="transcript_segments")
    op.drop_table("transcript_segments")

    op.drop_index("ix_audio_chunks_pending", table_name="audio_chunks")
    op.drop_index("ix_audio_chunks_status", table_name="audio_chunks")
    op.drop_index("ix_audio_chunks_meeting_sequence", table_name="audio_chunks")
    op.drop_table("audio_chunks")

    op.drop_index("uq_meetings_host_recording", table_name="meetings")
    op.drop_index("ix_meetings_created_at", table_name="meetings")
    op.drop_index("ix_meetings_status", table_name="meetings")
    op.drop_index("ix_meetings_host_id", table_name="meetings")
    op.drop_index(op.f("ix_meetings_room_code"), table_name="meetings")
    op.drop_table("meetings")

    op.drop_index(op.f("ix_hosts_email"), table_name="hosts")
    op.drop_table("hosts")

    audio_chunk_status.drop(op.get_bind(), checkfirst=True)
    meeting_status.drop(op.get_bind(), checkfirst=True)
