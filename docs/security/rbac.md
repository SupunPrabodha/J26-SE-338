# Permission matrix

Operational charts at `/api/v1/admin/analytics` inherit ADMIN-only authorization. They expose
case counts and permitted staff pseudonyms only, with bounded range/output. The owner
checklist cannot access them. Numeric explanation charts remain unavailable because current
authorized mock contracts provide no per-class probabilities or signed contributions.
See [manual assignment and chart evidence](../evidence/c1-manual-assignment-charts.md).

| Role | Allowed | Denied by default |
|---|---|---|
| STUDENT | Own consent, fixture submission, own status and withdrawal | Other cases, review content/actions, assignments |
| COUNSELLOR | Assigned, consent-valid case review tasks and human review actions | Unassigned/withdrawn/expired cases, administrative assignment |
| ADMIN | Staff role/access changes, eligible case assignment/reassignment, bounded metadata/counts/retention and allowlisted audit; component directory | Sensitive review payloads, notes, interpretations, identity mappings and arbitrary logs/queries/jobs |
| RESEARCHER | Explicitly permitted metadata-only component directory | All case content, datasets and annotation; no approved research artefact endpoint exists yet |
| SERVICE | Its audience-bound internal endpoint only | Browser APIs and other internal audiences |

Authorization is enforced by FastAPI dependencies plus case-link/assignment checks and fresh consent checks. Unknown IDs and unauthorized resource IDs return safe 404 where appropriate. ADMIN never inherits COUNSELLOR access. Research aggregates/releases must be separately approved before an endpoint is added.

The counsellor queue `/review-queue` publishes only assigned, consent-valid, unexpired cases,
with case/task references and human-action/save timestamps. Opening a saved record still
reuses `authorized_review`; a queue summary is not a permission grant. The worker's designated
development assignment occurs after successful processing, not after recording consent.
This is synthetic allocation policy, not an approved institutional allocation model.

The staff `/admin` page requires a separately selected ADMIN session through the existing
authentication backend. Its browser cookies are namespaced separately from counsellor and
student cookies. Admin evidence is a bounded snapshot; no general database browser, identity
linkage, notes or unrestricted status strings are exposed. Date/type/case filters do not
expand field permissions. One successful evidence-access receipt is retained per authenticated
session. Comprehensive security-denial logging remains a documented gap.

## Explicit allocation and staff administration (2026-10-24)

`ASSIGNMENT_POLICY` is `DESIGNATED_DEVELOPMENT` by default; `MANUAL` leaves successfully
processed tasks awaiting assignment. In both policies, assignment alone is insufficient:
current consent, case retention, usable staff account/session and review-state checks apply.
New exclusive `/admin/cases/{id}/assignment` replaces all grants or clears them. Stale
different changes return 409; matching repeats recheck policy and do not emit another event.
The legacy `/cases/{id}/assign` remains an additive grant with the same eligibility guards.

Staff management is ADMIN-only, excludes student/service accounts, revokes sessions on
role/access changes and preserves at least one usable admin under concurrent changes.
No public privileged registration exists. Use the private local provisioning helper.
There is no annotator role or approved annotation/dataset route. `/component-routes` is
explicitly permitted metadata for ADMIN, COUNSELLOR and RESEARCHER; C2–C4 are not roles.
See [policy, lock ordering and verification](../evidence/c1-role-assignment.md).
