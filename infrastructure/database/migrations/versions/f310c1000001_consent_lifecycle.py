"""Add pre-submission withdrawal receipts and explicit disposal reasons.

Revision ID: f310c1000001
Revises: e2985e1a1001
"""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000001"
down_revision = "e2985e1a1001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "workflow_retention",
        sa.Column("reason", sa.String(30), nullable=False, server_default="LEGACY_DISPOSAL"),
    )
    # Backfill old rows without leaving a runtime default that masks missing reasons.
    with op.batch_alter_table("workflow_retention") as batch:
        batch.alter_column("reason", server_default=None)
    op.create_table(
        "linkage_consent_withdrawals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "consent_id",
            sa.String(36),
            sa.ForeignKey("linkage_consents.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("linkage_consent_withdrawals")
    with op.batch_alter_table("workflow_retention") as batch:
        batch.drop_column("reason")
