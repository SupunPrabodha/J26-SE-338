"""Add c4_counterfactual_feedback table for counsellor reviewer feedback.

Stores reviewer feedback (natural wording, context preserved, usefulness, bounded comment)
against counterfactual explanation candidates, authenticated reviewer accounts, and timestamps.
"""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000006"
down_revision = "f310c1000005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "c4_counterfactual_feedback",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "counterfactual_id",
            sa.String(length=36),
            sa.ForeignKey("c4_counterfactuals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("candidate_id", sa.String(length=64), nullable=False),
        sa.Column(
            "reviewer_account_id",
            sa.String(length=36),
            sa.ForeignKey("access_accounts.id"),
            nullable=False,
        ),
        sa.Column("natural_wording", sa.String(length=10), nullable=True),
        sa.Column("context_preserved", sa.String(length=10), nullable=True),
        sa.Column("useful", sa.String(length=10), nullable=True),
        sa.Column("comment", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "counterfactual_id",
            "candidate_id",
            "reviewer_account_id",
            name="uq_c4_feedback_candidate_reviewer",
        ),
    )
    op.create_index(
        op.f("ix_c4_counterfactual_feedback_counterfactual_id"),
        "c4_counterfactual_feedback",
        ["counterfactual_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_counterfactual_feedback_candidate_id"),
        "c4_counterfactual_feedback",
        ["candidate_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_counterfactual_feedback_reviewer_account_id"),
        "c4_counterfactual_feedback",
        ["reviewer_account_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_c4_counterfactual_feedback_reviewer_account_id"),
        table_name="c4_counterfactual_feedback",
    )
    op.drop_index(
        op.f("ix_c4_counterfactual_feedback_candidate_id"),
        table_name="c4_counterfactual_feedback",
    )
    op.drop_index(
        op.f("ix_c4_counterfactual_feedback_counterfactual_id"),
        table_name="c4_counterfactual_feedback",
    )
    op.drop_table("c4_counterfactual_feedback")
