# C2 dataset annotation stage — proposed next increment

## Subsequent bounded demonstration (2026-10-15)

A development-only subset is now implemented uncommitted: immutable synthetic
queue, provisional vocabulary, persisted drafts/finals and server-authenticated
two-account separation. See [implementation evidence](c2-synthetic-dataset-annotation-v1.md).
The design/protocol below is preserved as the broader plan. Independent human gold
annotation, expert approval, agreement/adjudication and dataset release remain
pending; the bounded demonstration does not complete those research deliverables.

Documentation only, 2026-10-15. Runtime baseline: c2adc308. No annotation feature,
API, labels, metrics, training, participant collection or release is implemented
by this plan. Annotate remains Pending until its actual workflow is implemented
and human submissions exist.

## Scope and source authority

This is the C2 **dataset annotation stage**, covering language type/code-mixing,
human-verified emotions and non-diagnostic wellbeing-related linguistic indicators.
The separate [independent PII plan](c2-independent-pii-annotation-plan.md) evaluates
anonymization gold spans; it does not complete these dataset dimensions. Neither
PII labels nor quality PASS/REVIEW/REJECT are emotion/wellbeing annotations.

Sources read locally, without copying academic source files into Git:

- Available `Final taf.pdf` and `Final taf (1).pdf`, V2.2: p4 non-diagnostic
  screening boundary; pp8–9 C2 annotation schema/consistency and C3 modelling.
  They have 11/12 pages; the historical source review records a 15-page edition.
  The source-edition discrepancy is recorded in
  [source review](../governance/source-review.md). No newer approval is inferred.
- C2 proposal `D:/rp/proposal/IT23165434.pdf`, 47 pages: pp16–17 dataset/schema
  and annotation procedure, p22 provisional agreement target, p30 ownership;
  corresponding `J26-SE-338_Component_2_Proposal_Report (2).docx` tables 6–7
  agree on the relevant fields and candidate labels. The proposal labels are
  explicitly provisional, not evidence of completed expert approval.
- `J26-SE-338_Development_Handoff_Guide.pdf`, p4: human-assisted annotation,
  agreement, validation and release belong to C2; modelling belongs to C3.
- Existing shared contracts and offline PII schema were inspected. Shared
  `PreprocessResponse` is still `mock-1`; `InferenceResponse` uses synthetic mock
  labels. C2 demo Language ID is provisional automation, not human gold.

TAF > Master Research Context > finalized proposal remains the authority order.
No new Master Research Context copy was located for this increment; its recorded
ownership/boundaries remain as documented, not silently replaced by a proposal.

## Vocabulary status — scope approval is not taxonomy approval

| Dimension | Source-supported scope | Current status / decision needed |
| --- | --- | --- |
| Language type | Sinhala, English, Romanized Sinhala, Sinhala-English code-mixed are TAF language families | In-scope categories; exact export enum, `other`, `unknown` and `uncertain` semantics need a versioned guideline, not an inferred research approval |
| Code-mixing | Proposal: none, insertion, intra-sentential, inter-sentential, uncertain | Provisional; define unit, borrowed-word policy, overlapping patterns and whether one or multiple patterns may apply |
| Emotion | Proposal examples: neutral, sadness, worry/fear, anger, joy, mixed, uncertain | **No final expert-approved vocabulary found.** Examples are candidates, not adopted labels; decide whether worry/fear is merged or separate, neutral versus insufficient evidence, and single/multi-label rules |
| Wellbeing indicators | Proposal examples: academic pressure; sleep/energy; concentration/motivation; social connection; coping/support; no clear indicator; uncertain | **Provisional; appropriate expert review required.** Describe text evidence, not conditions, symptoms scored as diagnoses, severity or treatment decisions |
| PII | Existing PERSON, LOCATION, EMAIL, PHONE, STUDENT_ID span guide | Separate anonymization-evaluation task; no transfer into emotion/wellbeing classes |
| Mock inference | `synthetic-academic-pressure`, `synthetic-neutral`, `synthetic-busy-timetable` | Existing integration placeholders only; not approved research taxonomy or human labels |

No diagnostic vocabulary is introduced. GoEmotions/Dreaddit references in the
proposal do not approve wholesale transfer of their labels to local student data.
Approval requires recorded vocabulary version, definitions, bilingual examples,
exclusions, decision owners/date and expert/supervisor review evidence.

## Annotation units and schema proposal

Start with record-level language, emotion and wellbeing dimensions; optional
supporting spans/code-switch boundaries require a separately agreed policy.
This is a proposed starting unit, not a finalized model target. Human annotators
see the privacy-cleared anonymized text and, where useful, its read-only normalized
view. They do not see identity mappings or raw participant text. Labels must state
which immutable text view/hash they refer to; offsets cannot mix original,
anonymized, normalized or model-token coordinate systems.

Retain the proposal's `record_id`, `language_label`, `emotion_label`,
`wellbeing_indicator`, `code_mix_pattern`, `pipeline_version` concepts. Additive
schema design must resolve:

- Dataset/schema/taxonomy/guideline versions; input view/hash and transformation
  provenance; immutable per-annotator submission ID, revision and actual reviewer
  reference; human completion/abstention and assistance provenance.
- Independent per-dimension decisions, optional evidence/reasons, uncertainty,
  missing/incomplete versus verified negative, and separate human versus automatic
  language evidence. An empty list must not silently mean a reviewed negative.
- Multi-label representation, mixed/neutral/uncertain exclusivity, negation,
  quoted/third-person statements, sarcasm, temporal context, intensity (if any),
  and insufficient-context rules. No numeric clinical scale is assumed.
- Separate dataset eligibility/review/exclusion from runtime quality and privacy
  fields. Proposal quality states must not overwrite current PASS/REVIEW/REJECT.
- Immutable disagreements, linked submission hashes, adjudicator decisions/reasons,
  and unresolved states blocked from finalized gold/export.
- Explicit mappings across mock `en/si/romanized-si/mixed/uncertain`, demo
  `english/sinhala/romanized-si/code-mixed/uncertain/unknown`, and the proposal's
  `other`; never collapse or rename categories silently.

Language annotation distinguishes script from language: Romanized Sinhala beside
Sinhala script can be Sinhala in two scripts; Latin script alone does not imply
English mixing. Freeze how borrowed/shared words and clause switches are judged.
The [current Language ID policy](c2-language-category-policy.md) is development
evidence for guideline review, not a substitute for independent human decisions.

## Independent gold subset

1. C2, C3, supervisor and appropriate domain/bilingual experts review and freeze
   guideline, vocabulary, units, sample design and agreement protocol before gold
   annotation. Use separate practice items, resolving guideline questions first.
2. Freeze a diverse synthetic gold-subset manifest: all four language families,
   mixed-script and mixed-language cases, spelling/case/abbreviations, short and
   uncertain content, negation, punctuation/emoji, multiple/absent indicators,
   quoted/ambiguous expressions and uneven categories. Do not cherry-pick easy
   cases. Final counts and review rates follow pilot/supervisor approval, not an
   invented research sample size. Participant work remains separately gated.
3. Two trained bilingual annotators independently label the **same** items,
   blinded to each other's submissions and model/rule/self-review suggestions.
   Save complete separate immutable JSONL submissions and manifests, including
   negatives, uncertainty, reasons and incomplete tasks. Do not fabricate reviewer
   identities or independence; record assistance/protocol deviations honestly.
4. Validate schema, item/text hashes, completeness, language coverage and any
   Unicode/offset alignment; report exclusions and missing data explicitly.
   Keep participant/template grouping and inspected-case split provenance intact.
5. Compute agreement **before adjudication**, separately for each dimension and
   language. For a frozen single-label nominal task, use raw agreement plus
   Cohen's kappa where defined; Krippendorff's alpha requires a specified scale,
   missing-data policy and distance. For multi-label tasks, predefine per-label
   binary agreement/chance-corrected summaries and a separately named set-agreement
   metric. Span tasks need their own exact-boundary/type metrics. Report counts,
   confusion/disagreement matrices, prevalence, abstentions, incomplete cases and
   undefined metrics; no universal metric covers all dimensions.
6. Preserve both original submissions and all disagreements. An identified
   adjudicator with relevant expertise resolves disputed meanings, records reasons
   and produces a separate versioned consensus. Unresolved items remain blocked;
   consensus agreement is not independent agreement. If the guide changes, retain
   old measurements and use a new explicitly versioned annotation round.

Proposal p22 mentions kappa/alpha >=0.80 **provisionally, where appropriate**.
This is not an approved acceptance threshold, a privacy-release threshold or an
achieved score. C3/expert/supervisor alignment must confirm metric and decision
criteria before execution. Existing PII author self-review supplies no emotion/
wellbeing gold labels or two-annotator agreement for this stage.

## Remaining corpus: human-assisted, not independent gold

After the pilot and vocabulary approval, optional rules/model suggestions may
assist the remaining privacy-cleared corpus. Record suggestion source/version,
human accepted/corrected/abstained outcomes and final verified labels separately.
Every assisted label requires actual human verification. Target second review to
uncertainty, corrections/disagreements, expert-defined safety-sensitive content
and a stratified quality sample. Freeze rates and sampling with the supervisor;
report coverage and correction burden rather than claiming full double annotation.

Do not count assisted corrections as blinded agreement. If suggestion models later
exist, prevent gold/test leakage and preserve their training/split provenance.
Record class/language distributions without deleting difficult/minority cases to
improve agreement. Dataset eligibility, privacy clearance and human release approval
remain independent requirements. The proposal's possible >10,000-record corpus
is a scale consideration, not an implemented dataset or approved collection size.

## Alignment before implementation

- **C3:** task units, exact emotion/indicator vocabularies and cardinality,
  uncertainty/negative labels, target mappings, token/span coordinates, export
  contract, split leakage and suitable per-task agreement/evaluation metrics.
- **Appropriate wellbeing expert/counsellor and supervisor:** cultural validity,
  bilingual definitions/examples, safe non-diagnostic interpretation, ambiguity,
  sensitive-content handling, annotator preparation and adjudication competence.
  This is review of text labels, not clinical assessment of students.
- **C1:** annotation-role authorization (do not reuse counsellor role blindly),
  restricted saved-submission access, retention/withdrawal, metadata-only audits,
  storage and additive shared contracts. C1 consent/auth workflows stay unchanged.
- **C4:** any final research dashboard integration and presentation semantics;
  C2's synthetic annotation workbench does not implement C4 research.
- **Supervisor/source owners:** confirm the governing source edition and record
  taxonomy/metric approval. No such new approval is claimed here.

## Synthetic UI/API demonstration plan — not implemented

Use a C2-only development workbench with server-owned fictional items, frozen
record/schema/vocabulary versions and authenticated authorized annotators. Two
separate sessions save language, code-mixing and, once approved, emotion/indicator
decisions. Show read-only anonymized text, label definitions, uncertainty, save/
submit acknowledgement and completion state; do not preselect model labels for
the blinded gold workflow. Provisional-only demonstration choices must be visibly
marked and must not create approved gold labels.

Proposed additive API operations: list assigned synthetic items; retrieve the
versioned vocabulary/guide; save a bounded draft; submit an immutable revision;
retrieve one's own submission; privileged pre-adjudication agreement summary;
save adjudication referencing both submissions. Route names and payloads are
pending C1/C3 shared-contract review. Existing demo run responses cannot stand in
for saved annotation. Store fictional submissions in a dedicated local, ignored
store with metadata/version hashes; never put text/label notes in logs, browser
storage, analytics or hosted inference. No store/endpoints are created now.

Demonstration sequence: annotators A/B independently submit the same fictional
item set → show actual saved records and pre-adjudication agreement/disagreement
counts → adjudicator records reasoned resolutions → export validated synthetic
consensus plus provenance. Later engineering verification must cover independent
access, stale versions, incomplete/uncertain decisions, genuine disagreements,
Unicode boundaries and blocked release. Never simulate agreement or mark Annotate
complete just because preprocessing ran or a plan/tool UI exists.

Spreadsheet, doccano and Label Studio Community are proposal candidates only;
no annotation-tool comparison or usability result was executed for this plan.
Implementation/tool selection is a separately authorized increment.

## Completion boundary

This plan resolves documentation scope only. Remaining deliverables are approved
taxonomy/guide, saved independent submissions, measured agreement, preserved
adjudication evidence, a human-assisted verification workflow, schema validation
and controlled dataset packaging/release. None is completed by PII evaluation or
by the existing automated Language ID/quality stages. No clinical diagnosis,
wellbeing accuracy, human approval or independent validation is asserted.
