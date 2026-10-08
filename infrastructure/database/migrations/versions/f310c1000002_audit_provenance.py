"""Retain synthetic provider provenance and the separately observed expiry deadline."""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000002"
down_revision = "f310c1000001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("audit_events", sa.Column("trace_id", sa.String(36), nullable=True))
    op.add_column("workflow_cases", sa.Column("provenance", sa.JSON(), nullable=True))
    op.add_column(
        "audit_events", sa.Column("policy_expires_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade():
    op.drop_column("audit_events", "trace_id")
    # Native DROP COLUMN preserves append-only audit triggers on SQLite and PostgreSQL.
    op.drop_column("audit_events", "policy_expires_at")
    op.drop_column("workflow_cases", "provenance")
