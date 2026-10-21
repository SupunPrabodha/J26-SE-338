"""Add c4_counterfactuals table for C4 counterfactual explanation persistence.

Stores counterfactual explanation records with verified probabilities, edit operations,
search limits and outcomes. Keeps complete student text transient.
Safely ensures idempotency uniqueness constraint on c4_explanations if missing.
"""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000005"
down_revision = "f310c1000004"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Safely add idempotency uniqueness constraint to c4_explanations if not present
    if "c4_explanations" in inspector.get_table_names():
        existing_constraints = [
            c["name"] for c in inspector.get_unique_constraints("c4_explanations")
        ]
        if "uq_c4_explanations_account_idempotency" not in existing_constraints:
            op.create_unique_constraint(
                "uq_c4_explanations_account_idempotency",
                "c4_explanations",
                ["account_id", "idempotency_key"],
            )

    # 2. Create c4_counterfactuals table
    op.create_table(
        "c4_counterfactuals",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "account_id",
            sa.String(length=36),
            sa.ForeignKey("access_accounts.id"),
            nullable=False,
        ),
        sa.Column("source_reference", sa.String(length=100), nullable=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=True),
        sa.Column("request_hash", sa.String(length=64), nullable=True),
        sa.Column("target_class", sa.String(length=50), nullable=False),
        sa.Column("original_predicted_class", sa.String(length=50), nullable=True),
        sa.Column("original_probabilities", sa.JSON(), nullable=True),
        sa.Column("model_id", sa.String(length=150), nullable=False),
        sa.Column("model_version", sa.String(length=150), nullable=True),
        sa.Column("model_revision", sa.String(length=100), nullable=True),
        sa.Column("outcome", sa.String(length=50), nullable=False),
        sa.Column("outcome_message", sa.String(length=255), nullable=True),
        sa.Column("search_limits", sa.JSON(), nullable=True),
        sa.Column("candidates", sa.JSON(), nullable=True),
        sa.Column("best_candidate", sa.JSON(), nullable=True),
        sa.Column("is_development", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("execution_time_ms", sa.Float(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "account_id", "idempotency_key", name="uq_c4_counterfactuals_account_idempotency"
        ),
    )
    op.create_index(
        op.f("ix_c4_counterfactuals_account_id"),
        "c4_counterfactuals",
        ["account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_counterfactuals_source_reference"),
        "c4_counterfactuals",
        ["source_reference"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_counterfactuals_idempotency_key"),
        "c4_counterfactuals",
        ["idempotency_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_counterfactuals_request_hash"),
        "c4_counterfactuals",
        ["request_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_counterfactuals_expires_at"),
        "c4_counterfactuals",
        ["expires_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_c4_counterfactuals_expires_at"), table_name="c4_counterfactuals")
    op.drop_index(op.f("ix_c4_counterfactuals_request_hash"), table_name="c4_counterfactuals")
    op.drop_index(op.f("ix_c4_counterfactuals_idempotency_key"), table_name="c4_counterfactuals")
    op.drop_index(op.f("ix_c4_counterfactuals_source_reference"), table_name="c4_counterfactuals")
    op.drop_index(op.f("ix_c4_counterfactuals_account_id"), table_name="c4_counterfactuals")
    op.drop_table("c4_counterfactuals")
