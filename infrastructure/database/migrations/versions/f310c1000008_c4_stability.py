"""Add c4_stability_evaluations table for C4 stability persistence.

Stores stability evaluation results linked to their explanation record:
model/explainer provenance, settings/seeds, selected occurrence offsets,
per-run numerical results, metrics, completion status, timestamps, and expiry.
Full original texts remain strictly transient.
"""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000008"
down_revision = "f310c1000007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "c4_stability_evaluations",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "explanation_id",
            sa.String(length=36),
            sa.ForeignKey("c4_explanations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            sa.String(length=36),
            sa.ForeignKey("access_accounts.id"),
            nullable=False,
        ),
        sa.Column("source_reference", sa.String(length=100), nullable=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=True),
        sa.Column("request_hash", sa.String(length=64), nullable=True),
        sa.Column("method", sa.String(length=20), nullable=False),
        sa.Column("explained_class", sa.String(length=50), nullable=False),
        sa.Column("baseline_probability", sa.Float(), nullable=False),
        sa.Column("model_id", sa.String(length=150), nullable=False),
        sa.Column("model_version", sa.String(length=150), nullable=True),
        sa.Column("model_revision", sa.String(length=100), nullable=True),
        sa.Column("explainer_version", sa.String(length=50), nullable=True),
        sa.Column("settings", sa.JSON(), nullable=True),
        sa.Column("selected_occurrence_offsets", sa.JSON(), nullable=True),
        sa.Column("runs", sa.JSON(), nullable=True),
        sa.Column("word_consistency", sa.JSON(), nullable=True),
        sa.Column("mean_top_k_overlap", sa.Float(), nullable=True),
        sa.Column("mean_rank_correlation", sa.Float(), nullable=True),
        sa.Column("mean_attribution_std", sa.Float(), nullable=True),
        sa.Column("requested_runs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_runs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("effective_k", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_eligible_words", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_deterministic", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("determinism_notice", sa.String(length=255), nullable=True),
        sa.Column("execution_time_ms", sa.Float(), nullable=True),
        sa.Column("outcome", sa.String(length=50), nullable=False),
        sa.Column("outcome_message", sa.String(length=255), nullable=True),
        sa.Column("stopping_reason", sa.String(length=255), nullable=True),
        sa.Column("is_development", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "account_id",
            "idempotency_key",
            name="uq_c4_stability_account_idempotency",
        ),
    )
    op.create_index(
        op.f("ix_c4_stability_evaluations_explanation_id"),
        "c4_stability_evaluations",
        ["explanation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_stability_evaluations_account_id"),
        "c4_stability_evaluations",
        ["account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_stability_evaluations_source_reference"),
        "c4_stability_evaluations",
        ["source_reference"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_stability_evaluations_idempotency_key"),
        "c4_stability_evaluations",
        ["idempotency_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_stability_evaluations_request_hash"),
        "c4_stability_evaluations",
        ["request_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_stability_evaluations_expires_at"),
        "c4_stability_evaluations",
        ["expires_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_c4_stability_evaluations_expires_at"),
        table_name="c4_stability_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_stability_evaluations_request_hash"),
        table_name="c4_stability_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_stability_evaluations_idempotency_key"),
        table_name="c4_stability_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_stability_evaluations_source_reference"),
        table_name="c4_stability_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_stability_evaluations_account_id"),
        table_name="c4_stability_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_stability_evaluations_explanation_id"),
        table_name="c4_stability_evaluations",
    )
    op.drop_table("c4_stability_evaluations")
