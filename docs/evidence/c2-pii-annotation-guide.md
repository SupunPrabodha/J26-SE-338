# C2 fictional PII annotation guide v1

Purpose: human-reviewable domain data for the next **local trainable NER baseline**.
This is not participant collection, research validation, or dataset-release approval.
Only fictional inputs are allowed. Do not add participant text or actual contacts.
The initial 120 proposals are **UNREVIEWED**, not gold-standard human labels.

## Span decisions

Use original, unchanged text and half-open Python Unicode character offsets
`[start,end)`. Count code points, not UTF-8 bytes, JavaScript UTF-16 units, visible
glyphs or editor columns. Exclude surrounding spaces, punctuation and emoji.
Never normalize, trim, transliterate or change spelling to fit a prediction.

| Label | Include | Exclude / flag |
|---|---|---|
| PERSON | The complete contiguous fictional name, including given names and surname; lowercase names supported by context; each of multiple names separately | Introductory words (`my name is`, `mage nama`), titles, pronouns, emotion/wellbeing words; uncertain common-word names need adjudication |
| LOCATION | The complete contiguous named fictional geographic place, including constituent words | Generic `home`, `class`, `near`, `at`, wellbeing descriptions; uncertain place/common-word readings need adjudication |
| EMAIL | Complete fictional email address, e.g. `@example.com` | Trailing punctuation; never use a real contact |
| PHONE | Complete fictional phone surface including a leading `+`, internal separators when part of the contact | Adjacent sentence punctuation; synthetic digits only |
| STUDENT_ID | Complete invented identifier including its prefix | Surrounding explanatory words; no actual student identifiers |

Full names form one PERSON span, not one label per word. Do not infer a person
from capitalization alone; lowercase `supun` can be a name in a contextual sentence.
Romanized spelling variations remain exactly as written, and belong to the same
name-pool family for partitioning. A variant is not automatically correct PII merely
because it resembles a known name. No name dictionary is added to runtime.

Sinhala names include **all their combining marks and internal joiners**. Never
end before a vowel sign/virama, start at a combining mark, or cut beside ZWJ/ZWNJ.
For a clearly separable grammatical suffix (`ට`, `ගේ`, or Romanized `ta`, `ge`),
annotate the underlying name and exclude the suffix, even when attached, only when
the reading is unambiguous and the root boundary is Unicode-safe. For example,
`ශ්‍රියාට` contains PERSON `ශ්‍රියා`; the `ට` is outside the span. If a purported
suffix could instead be part of the name or its marks, flag for adjudication.
Future tokenizer conversion must report unalignable subword/root spans rather than
silently expanding labels or dropping records.

Ordinary `dukai`, `duki`, `gana dukai`, `mahansi`, `exams`, sadness, worry and sleep
expressions are not PERSON/LOCATION simply because an NER model predicts them.
Words can also be names in a different context; do not implement a global veto.

## Ambiguity and disagreement

When name/place identity is genuinely unclear, keep a separate ambiguity span
with `status: NEEDS_ADJUDICATION`, candidate labels and `resolution: null`.
Do **not** add a confident entity label. The starter pack's common-word examples
ask whether a token is PERSON or NONE; LOCATION/common-noun ambiguity can use
LOCATION or NONE as well. Negative examples with no ambiguity have `entities: []`.

A human reviews the proposed labels and negatives, checks every full span in its
sentence, and records a private local pseudonymous reviewer reference. Do not
invent reviewer identities. If readings differ, use `review.status: DISAGREEMENT`,
retain the reviewers' alternatives and reasons, and keep the row blocked.
An adjudicator records the final decision and an `adjudicator_id`; disagreements
must remain in the review history. No agreement percentage is calculated without
independent annotations and a separately documented measurement protocol.

Review states:

- `UNREVIEWED`: generated proposal; no approval/reviewer references; entity
  `annotation_status` is `UNREVIEWED`.
- `REVIEWED`: a human reviewed the full row, including negatives; actual private
  `reviewer_ids` supplied; each accepted/corrected entity is `HUMAN_REVIEWED`;
  no unresolved ambiguity or disagreements.
- `DISAGREEMENT`: alternatives are recorded; cannot enter trainable exports.
- `ADJUDICATED`: human adjudicator supplied; ambiguity resolution recorded and
  reflected in final entities; disagreement history retained.

The offline tool checks metadata consistency. It cannot authenticate reviewers,
prove their independence, or guarantee a claimed review was actually performed.
Record review honestly; file metadata is not approval by the research team.

## Supplied diagnostic proposals

- `Mata exams gana dukai.`: no PERSON.
- `mt supun banna nisa duki`: PERSON `supun`.
- `Mage nama Nimal Perera. Mata exams gana dukai.`: PERSON `Nimal Perera`;
  `gana dukai` is ordinary wellbeing content.
- `Mge nngige nama senali eyt ghuwa kiyl mt supun bnna`: PERSON `senali` and
  `supun` as specified by the supplied fictional diagnostic. The informal context
  does not authorize a diagnostic/treatment inference.

These are user-supplied proposals awaiting human annotation review. Their spans
are calculated from actual original text; they are not injected into model output.
Previously inspected diagnostics remain development cases, never untouched tests.
