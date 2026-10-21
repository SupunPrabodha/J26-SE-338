"""Add c4_explanations table for LIME and SHAP persistence.

Stores explanation records with sensitive token contributions protected under existing access
and retention controls. Does not create permanent input or prediction tables.
"""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000004"
down_revision = "f310c1000003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "c4_explanations",
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
        sa.Column("method", sa.String(length=20), nullable=False),
        sa.Column("target_class", sa.String(length=50), nullable=False),
        sa.Column("model_id", sa.String(length=150), nullable=False),
        sa.Column("model_version", sa.String(length=150), nullable=True),
        sa.Column("model_revision", sa.String(length=100), nullable=True),
        sa.Column("explainer_version", sa.String(length=50), nullable=True),
        sa.Column("explainer_config", sa.JSON(), nullable=True),
        sa.Column("contributions", sa.JSON(), nullable=True),
        sa.Column("tokens", sa.JSON(), nullable=True),
        sa.Column("weights", sa.JSON(), nullable=True),
        sa.Column("base_value", sa.Float(), nullable=True),
        sa.Column("output_value", sa.Float(), nullable=True),
        sa.Column("target_class_probability", sa.Float(), nullable=True),
        sa.Column("predicted_class", sa.String(length=50), nullable=True),
        sa.Column("probabilities", sa.JSON(), nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("truncated", sa.Boolean(), nullable=True),
        sa.Column("diagnostics", sa.JSON(), nullable=True),
        sa.Column("reconstructed_output", sa.Float(), nullable=True),
        sa.Column("additivity_residual", sa.Float(), nullable=True),
        sa.Column("additivity_within_tolerance", sa.Boolean(), nullable=True),
        sa.Column("additivity_discrepancy_message", sa.String(length=500), nullable=True),
        sa.Column("is_development", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="READY"),
        sa.Column("status_message", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "account_id", "idempotency_key", name="uq_c4_explanations_account_idempotency"
        ),
        sa.CheckConstraint("method IN ('LIME','SHAP')"),
    )
    op.create_index(
        op.f("ix_c4_explanations_account_id"), "c4_explanations", ["account_id"], unique=False
    )
    op.create_index(
        op.f("ix_c4_explanations_source_reference"),
        "c4_explanations",
        ["source_reference"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_explanations_idempotency_key"),
        "c4_explanations",
        ["idempotency_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_explanations_request_hash"),
        "c4_explanations",
        ["request_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_c4_explanations_expires_at"), "c4_explanations", ["expires_at"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_c4_explanations_expires_at"), table_name="c4_explanations")
    op.drop_index(op.f("ix_c4_explanations_request_hash"), table_name="c4_explanations")
    op.drop_index(op.f("ix_c4_explanations_idempotency_key"), table_name="c4_explanations")
    op.drop_index(op.f("ix_c4_explanations_source_reference"), table_name="c4_explanations")
    op.drop_index(op.f("ix_c4_explanations_account_id"), table_name="c4_explanations")
    op.drop_table("c4_explanations")
