"""Add preprocessing JSON to workflow_cases for authorized review access."""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000003"
down_revision = "f310c1000002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("workflow_cases", sa.Column("preprocessing", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("workflow_cases", "preprocessing")
