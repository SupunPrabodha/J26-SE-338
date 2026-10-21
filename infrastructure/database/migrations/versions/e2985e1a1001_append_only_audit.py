"""Prevent application-level audit updates/deletes; administrators remain a trust boundary."""

from alembic import op

revision = "e2985e1a1001"
down_revision = "da6bd1560a9f"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("""CREATE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'audit events are append only'; END;
        $$ LANGUAGE plpgsql""")
        op.execute(
            "CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation()"
        )
    else:
        for action in ("UPDATE", "DELETE"):
            op.execute(
                f"CREATE TRIGGER audit_no_{action.lower()} BEFORE {action} ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append only'); END"
            )


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER audit_append_only ON audit_events")
        op.execute("DROP FUNCTION reject_audit_mutation()")
    else:
        op.execute("DROP TRIGGER audit_no_update")
        op.execute("DROP TRIGGER audit_no_delete")
