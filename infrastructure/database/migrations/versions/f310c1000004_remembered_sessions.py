"""Add opt-in staff session persistence without altering existing sessions."""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000004"
down_revision = "f310c1000003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "access_sessions",
        sa.Column("remembered", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "access_sessions",
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    # Operator-only rollback; removes remembered-session metadata. Disposable data only.
    op.drop_column("access_sessions", "absolute_expires_at")
    op.drop_column("access_sessions", "remembered")
