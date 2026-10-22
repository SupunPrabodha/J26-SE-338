"""Add c4_faithfulness_evaluations table for C4 faithfulness persistence.

Stores faithfulness evaluation results linked to their explanation record:
model/explainer provenance, settings/seed, selected occurrence offsets,
per-step numerical results, metrics, completion status, timestamps, and expiry.
Full original and modified texts remain strictly transient.
"""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000007"
down_revision = "f310c1000006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "c4_faithfulness_evaluations",
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
        sa.Column("step_results", sa.JSON(), nullable=True),
        sa.Column("aopc", sa.Float(), nullable=True),
        sa.Column("final_comprehensiveness_drop", sa.Float(), nullable=True),
        sa.Column("final_sufficiency_gap", sa.Float(), nullable=True),
        sa.Column("final_random_mean_drop", sa.Float(), nullable=True),
        sa.Column("final_difference_from_random", sa.Float(), nullable=True),
        sa.Column("total_eligible_words", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("budget_evaluated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_steps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_trials", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_inferences", sa.Integer(), nullable=False, server_default="0"),
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
            name="uq_c4_faithfulness_account_idempotency",
        ),
    )
    op.create_index(
        op.f("ix_c4_faithfulness_evaluations_explanation_id"),
        "c4_faithfulness_evaluations",
        ["explanation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_faithfulness_evaluations_account_id"),
        "c4_faithfulness_evaluations",
        ["account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_faithfulness_evaluations_source_reference"),
        "c4_faithfulness_evaluations",
        ["source_reference"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_faithfulness_evaluations_idempotency_key"),
        "c4_faithfulness_evaluations",
        ["idempotency_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_faithfulness_evaluations_request_hash"),
        "c4_faithfulness_evaluations",
        ["request_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_faithfulness_evaluations_expires_at"),
        "c4_faithfulness_evaluations",
        ["expires_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_c4_faithfulness_evaluations_expires_at"),
        table_name="c4_faithfulness_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_faithfulness_evaluations_request_hash"),
        table_name="c4_faithfulness_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_faithfulness_evaluations_idempotency_key"),
        table_name="c4_faithfulness_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_faithfulness_evaluations_source_reference"),
        table_name="c4_faithfulness_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_faithfulness_evaluations_account_id"),
        table_name="c4_faithfulness_evaluations",
    )
    op.drop_index(
        op.f("ix_c4_faithfulness_evaluations_explanation_id"),
        table_name="c4_faithfulness_evaluations",
    )
    op.drop_table("c4_faithfulness_evaluations")
