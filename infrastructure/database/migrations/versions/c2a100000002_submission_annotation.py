"""Add immutable synthetic submission grouping and explicit paired assignments."""

import sqlalchemy as sa
from alembic import op

revision = "c2a100000002"
down_revision = "c2a100000001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "c2_annotation_submissions",
        sa.Column("submission_id", sa.String(80), primary_key=True),
        sa.Column("submission_version", sa.String(64), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=False),
    )
    op.create_table(
        "c2_submission_assignments",
        sa.Column(
            "submission_id",
            sa.String(80),
            sa.ForeignKey("c2_annotation_submissions.submission_id"),
            primary_key=True,
        ),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("access_accounts.id"), primary_key=True),
        sa.Column("slot", sa.Integer(), nullable=False),
        sa.UniqueConstraint("submission_id", "slot"),
        sa.CheckConstraint("slot IN (1,2)"),
    )
    op.create_table(
        "c2_submission_answers",
        sa.Column(
            "submission_id",
            sa.String(80),
            sa.ForeignKey("c2_annotation_submissions.submission_id"),
            primary_key=True,
        ),
        sa.Column("question_id", sa.String(4), primary_key=True),
        sa.Column("source_record_id", sa.String(80), unique=True, nullable=False),
        sa.Column("question_text", sa.String(1000), nullable=False),
        sa.Column("state", sa.String(30), nullable=False),
        sa.Column("record_id", sa.String(80), sa.ForeignKey("c2_annotation_records.record_id")),
        sa.Column("blocking_reasons", sa.JSON(), nullable=False),
        sa.CheckConstraint(
            "state IN ('AVAILABLE','WITHHELD','OPTIONAL_UNANSWERED','MISSING_REQUIRED')"
        ),
    )
    dialect = op.get_bind().dialect.name
    for table in (
        "c2_annotation_submissions",
        "c2_submission_assignments",
        "c2_submission_answers",
    ):
        if dialect == "postgresql":
            op.execute(
                f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION c2_annotation_immutable()"
            )
        elif dialect == "sqlite":
            for action in ("UPDATE", "DELETE"):
                op.execute(
                    f"CREATE TRIGGER {table}_{action.lower()} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'C2 submission rows are immutable'); END"
                )


def downgrade():
    for table in (
        "c2_submission_answers",
        "c2_submission_assignments",
        "c2_annotation_submissions",
    ):
        op.drop_table(table)
