# Permission matrix

| Role | Allowed | Denied by default |
|---|---|---|
| STUDENT | Own consent, fixture submission, own status and withdrawal | Other cases, review content/actions, assignments |
| COUNSELLOR | Assigned, consent-valid case review tasks and human review actions | Unassigned/withdrawn/expired cases, administrative assignment |
| ADMIN | Assign enabled counsellors to a consent-valid case using IDs | Sensitive review payloads and human interpretation |
| RESEARCHER | Authentication only in this bootstrap | All case content; no approved research artefact endpoint exists yet |
| SERVICE | Its audience-bound internal endpoint only | Browser APIs and other internal audiences |

Authorization is enforced by FastAPI dependencies plus case-link/assignment checks and fresh consent checks. Unknown IDs and unauthorized resource IDs return safe 404 where appropriate. ADMIN never inherits COUNSELLOR access. Research aggregates/releases must be separately approved before an endpoint is added.
