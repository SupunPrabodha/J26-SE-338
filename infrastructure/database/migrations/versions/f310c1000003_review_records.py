"""Add protected synthetic counsellor interpretation and follow-up records."""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000003"
down_revision = "f310c1000002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "review_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("task_id", sa.String(36), sa.ForeignKey("review_tasks.id"), nullable=False),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("access_accounts.id"), nullable=False),
        sa.Column("interpretation", sa.String(2000), nullable=False),
        sa.Column("follow_up", sa.String(30), nullable=False),
        sa.Column("idempotency_key", sa.String(36), nullable=False),
        sa.UniqueConstraint("task_id"),
        sa.CheckConstraint("length(interpretation) BETWEEN 1 AND 2000"),
        sa.CheckConstraint(
            "follow_up IN ('NO_FOLLOW_UP_PLANNED','DISCUSSION_OFFERED','FOLLOW_UP_REQUESTED')"
        ),
    )


def downgrade():
    # Operator-only destructive rollback; use disposable data for downgrade tests.
    op.drop_table("review_records")
