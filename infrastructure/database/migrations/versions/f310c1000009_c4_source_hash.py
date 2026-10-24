"""Add source_hash and language columns to C4 tables for immutable content pairing and language breakdown.

Non-destructive schema migration. Historical records with NULL source_hash or language are preserved
as non-directly comparable or Unknown language without fabricating retrospective provenance.
"""

import sqlalchemy as sa
from alembic import op

revision = "f310c1000009"
down_revision = "f310c1000008"
branch_labels = None
depends_on = None


def upgrade():
    # 1. c4_explanations
    op.add_column("c4_explanations", sa.Column("source_hash", sa.String(length=64), nullable=True))
    op.add_column("c4_explanations", sa.Column("language", sa.String(length=30), nullable=True))
    op.create_index(op.f("ix_c4_explanations_source_hash"), "c4_explanations", ["source_hash"], unique=False)

    # 2. c4_faithfulness_evaluations
    op.add_column("c4_faithfulness_evaluations", sa.Column("source_hash", sa.String(length=64), nullable=True))
    op.add_column("c4_faithfulness_evaluations", sa.Column("language", sa.String(length=30), nullable=True))
    op.create_index(
        op.f("ix_c4_faithfulness_evaluations_source_hash"),
        "c4_faithfulness_evaluations",
        ["source_hash"],
        unique=False,
    )

    # 3. c4_stability_evaluations
    op.add_column("c4_stability_evaluations", sa.Column("source_hash", sa.String(length=64), nullable=True))
    op.add_column("c4_stability_evaluations", sa.Column("language", sa.String(length=30), nullable=True))
    op.create_index(
        op.f("ix_c4_stability_evaluations_source_hash"),
        "c4_stability_evaluations",
        ["source_hash"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_c4_stability_evaluations_source_hash"),
        table_name="c4_stability_evaluations",
    )
    op.drop_column("c4_stability_evaluations", "language")
    op.drop_column("c4_stability_evaluations", "source_hash")

    op.drop_index(
        op.f("ix_c4_faithfulness_evaluations_source_hash"),
        table_name="c4_faithfulness_evaluations",
    )
    op.drop_column("c4_faithfulness_evaluations", "language")
    op.drop_column("c4_faithfulness_evaluations", "source_hash")

    op.drop_index(op.f("ix_c4_explanations_source_hash"), table_name="c4_explanations")
    op.drop_column("c4_explanations", "language")
    op.drop_column("c4_explanations", "source_hash")
