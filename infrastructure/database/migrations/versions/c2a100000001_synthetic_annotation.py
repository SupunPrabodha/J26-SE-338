"""C2 synthetic annotation history only; existing C1 tables are unchanged."""

import sqlalchemy as sa
from alembic import op

revision = "c2a100000001"
down_revision = "f310c1000002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "c2_annotation_records",
        sa.Column("record_id", sa.String(80), primary_key=True),
        sa.Column("record_version", sa.String(64), nullable=False),
        sa.Column("pipeline_version", sa.String(600), nullable=False),
        sa.Column("annotation_schema_version", sa.String(80), nullable=False),
        sa.Column("vocabulary_version", sa.String(80), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
    )
    op.create_table(
        "c2_annotation_slots",
        sa.Column(
            "record_id",
            sa.String(80),
            sa.ForeignKey("c2_annotation_records.record_id"),
            primary_key=True,
        ),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("access_accounts.id"), primary_key=True),
        sa.Column("slot", sa.Integer(), nullable=False),
        sa.UniqueConstraint("record_id", "slot"),
        sa.CheckConstraint("slot IN (1,2)"),
    )
    op.create_table(
        "c2_annotation_revisions",
        sa.Column(
            "record_id",
            sa.String(80),
            sa.ForeignKey("c2_annotation_records.record_id"),
            primary_key=True,
        ),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("access_accounts.id"), primary_key=True),
        sa.Column("revision", sa.Integer(), primary_key=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("labels", sa.JSON(), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("revision > 0"),
        sa.CheckConstraint("status IN ('DRAFT','FINAL')"),
    )
    # Enforce immutability beyond route code; independent history is never UPDATEd.
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(
            "CREATE FUNCTION c2_annotation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'C2 annotation rows are immutable'; END $$"
        )
    for table in ("c2_annotation_records", "c2_annotation_slots", "c2_annotation_revisions"):
        if dialect == "postgresql":
            op.execute(
                f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION c2_annotation_immutable()"
            )
        elif dialect == "sqlite":
            for action in ("UPDATE", "DELETE"):
                op.execute(
                    f"CREATE TRIGGER {table}_{action.lower()} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'C2 annotation rows are immutable'); END"
                )


def downgrade():
    for table in ("c2_annotation_revisions", "c2_annotation_slots", "c2_annotation_records"):
        op.drop_table(table)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP FUNCTION c2_annotation_immutable()")
