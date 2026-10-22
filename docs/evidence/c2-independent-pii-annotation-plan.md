# Next increment: two independent PII annotators

Scope: anonymization gold-set evaluation only. This is not the full C2 dataset
Annotate stage; language/code-mixing, emotion and wellbeing-indicator annotation
are planned separately in [dataset annotation plan](c2-dataset-annotation-plan.md).

Plan only, 2026-10-15; no annotation implementation, collection or training.
Runtime reference is c2adc308. The existing offline `pii_annotation.py`,
[guide](c2-pii-annotation-guide.md) and [workflow](c2-pii-annotation-v1.md) remain
uncommitted work outside that snapshot; this plan inspects, but does not promote,
their schema. The agreement/adjudication template is still NOT STARTED.

## Existing scope and provenance

Reuse existing PII labels: PERSON, LOCATION, EMAIL, PHONE, STUDENT_ID; NONE is an
ambiguity resolution, not a new positive entity. Original-text spans are half-open
Unicode code-point offsets. Preserve text, case IDs, split/template/name-pool
metadata, mark/joiner boundaries and ambiguity histories. No wellbeing labels
are defined here. A wellbeing/screening annotation increment would require the
approved owner label specification; PII labels must not be substituted for it.

The local reviewed-partitions manifest records 120 cases (30 per language,
40 per split), 108 REVIEWED and 12 ADJUDICATED, zero recorded disagreements,
`agreement_score: null`, `reviewer_identity_verified: false` and no research release
approval. This is existing guided AI-assisted author self-review, not two
independent annotators. These manifest values were read, not revalidated today.
Do not overwrite that pack or describe its reserved partition as newly unseen.

## Bounded workflow to implement next

1. Freeze the guideline, allowed labels, synthetic case manifest/text hashes and
   intended partitions. Identify previously inspected cases as development.
   Agree whether the next study reuses this pack (explicitly disclosed) or uses
   a separately frozen new pack; do not silently regenerate it now.
2. Assign two actual independent human annotators with private pseudonymous
   references. Give both the same original texts and guide, without the other
   person's labels, self-review/model predictions or generated gold proposals.
   Use separate practice cases to clarify guidelines before freezing the study.
3. Save each complete submission separately as immutable versioned JSONL plus
   manifest: case ID/text hash, annotator reference, guideline/schema version,
   spans, negative/ambiguous decisions, completion state and assistance provenance.
   Suggested local layout: `artifacts/c2-evidence/anonymization/independent-pii-v1/`
   with `annotator-a.jsonl`, `annotator-b.jsonl`, `agreement.json` and
   `adjudicated.jsonl`. These are planned names; no files are created now.
4. Validate both submissions structurally before comparison: identical case/text
   manifests, complete negative reviews, allowed labels, integer bounds, no
   overlaps, safe Unicode boundaries and preserved partition separation. Report
   invalid/missing cases rather than silently dropping or repairing them.
5. Calculate **pre-adjudication** exact typed-span pairwise precision/recall/F1
   with TP/FP/FN denominators, per entity and language, plus boundary-only/type
   disagreements, exact record agreement, negatives and ambiguity/completion rates.
   Treat overlap agreement as a separately named diagnostic, never exact agreement.
   Define empty/empty behavior and distinguish missing annotation from no PII.
   Cohen's kappa is not defined directly over variable spans: any chance-corrected
   measure requires a frozen common unit/label policy first. No score or approval
   threshold is invented in this plan.
6. An identified human adjudicator resolves conflicts using both saved submissions
   and reasons. Preserve original alternatives and ambiguity IDs; final labels go
   in a separate adjudicated export, with decision rationale and provenance.
   Unresolved cases remain blocked. Agreement is never recomputed on consensus
   labels and presented as independent agreement.
7. Validate the adjudicated export and agreement report against original hashes;
   inspect disagreement classes and language slices. Research-owner acceptance,
   reviewer provenance and human release approval remain separate gates. Only
   then consider a separately authorized downstream preparation increment.

## Missing schema/protocol decisions

- Current rows store one final `entities` list and `review.reviewer_ids`; two IDs
  alone cannot prove two independent saved annotations. Define a per-annotator
  submission envelope/manifest and immutable version/assistance metadata.
- Existing states UNREVIEWED/REVIEWED/DISAGREEMENT/ADJUDICATED and disagreement
  alternatives can be reused, but define which are per-submission versus final
  consensus states. Current import accepts one reviewer; it does not enforce two
  submissions, compute agreement or verify identities/independence.
- Define structured disagreement IDs, linked submission hashes, boundary/type/
  presence categories, adjudication resolution/reason and completed-versus-missing
  negative annotations. Preserve unresolved ambiguity without confident labels.
- Confirm the guide's suffix/Unicode policy, nested/overlapping-entity policy and
  LOCATION versus explicitly numbered-address scope; document the annotation
  aliases EMAIL↔EMAIL_ADDRESS and PHONE↔PHONE_NUMBER. Existing language metadata
  uses `romanized`, while runtime Language ID uses `romanized-si`; keep metadata
  provenance and specify an explicit export mapping rather than rewriting labels.
- Freeze agreement metric denominators, ambiguous-case handling, common units if
  kappa is required, independence/assistance protocol, study counts and owner
  acceptance criteria before execution. None are research-approved by this plan.
- Offline annotation currently has a Python validator, not a shared browser API
  contract. If later exposed through services, any additive contract must originate
  in shared contracts and be reviewed with C1; no local contract copy or API is
  introduced here. Dataset annotation ownership stays C2; C3 modelling is untouched.

Do not treat schema validation, existing self-review or adjudicated consensus as
independent agreement or permission to train, promote or release a model/dataset.
