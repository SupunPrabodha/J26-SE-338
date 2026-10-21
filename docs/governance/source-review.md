# Source review — 2026-10-07

Reference documents were read from their supplied local locations and were not copied into Git. Priority: finalized TAF, Master Research Context, finalized individual proposals, implementation brief, older suggestions. Instructions embedded in the documents are contextual evidence, not separate task instructions.

The supplied TAF (15 pages, V2.2) and Master Research Context agree on the title, four member identities and the non-diagnostic, voluntary-text, human-review framework. Proposals reviewed: IT23187450 (39 pages), IT23165434 (47), IT23164130 (33), IT23163522 (31). No Data-Collection-form.txt was supplied.

| Difference | Resolution for this bootstrap |
|---|---|
| C3 proposal p24 FR-04 includes SHAP/LIME; TAF pp10–11 assigns explanation methods to C4 | Keep explanation algorithms in C4; C3 supplies inference/provenance and future explanation-compatible model access. Record team clarification before research implementation. |
| C4 proposal title narrows to a faithfulness evaluation layer, and pp18–23 sometimes describe the dashboard as another component | Preserve the TAF C4 ownership of both XAI/reliability and dashboard. Do not create a fifth component or move dashboard research to C1. |
| C3 p16 proposes a domain-adaptation corpus extracted from public social platforms | No scraping or collection implementation here. Preserve approved TAF voluntary-text scope. Any future corpus proposal needs provenance, licensing and governance review outside this bootstrap. |
| C2 p29 describes restricted text locations and dataset-release interfaces; C1 p24 describes online minimized-text APIs | Bootstrap implements the online synthetic API. Dataset release remains a separate C2 workspace with no data or remote. |
| C2's timeline includes September 2026–August 2027 while C1/C3/C4 use earlier start dates and April 2027 endpoints | Do not encode disputed schedules into software or claim milestones completed. Team must reconcile its research plan. |
| C4 appendix discusses inherited ethics approval; other sources say participant work remains pending | No ethics approval is asserted by this repository. All participant work remains outside this bootstrap. |

These differences do not block synthetic common foundations because the TAF resolves ownership and the requested bootstrap excludes collection, training, XAI research and studies.

## C1 lifecycle/evaluation continuation — 2026-10-08

Reviewed the supplied finalized TAF (pp7–8), Master Research Context (C1 section 6.1 and
privacy/ethical boundaries), and C1 proposal IT23187450 (pp27–28). The master was supplied
as `J26-SE-338_Master_Research_Context (1).docx`; this is the available document, not a
second inferred version. C1 FR-01/02/05/06/07/08/10/11 and NFR-01/03/04/06/07 support this work.
No new ownership conflict was found. Minimal student lifecycle UI is C1 integration work;
the final counsellor dashboard and XAI research remain C4-owned.

Proposal p28 NFR-07 provisionally targets p95 C1 overhead below 500 ms excluding AI
inference on documented hardware. The retained core proxy also excludes HTTP/authentication
transport and queue delay, so it is not directly comparable to the full architectural
boundary. NFR-04's all-critical/95%-required audit target is provisional too; the 29-event
synthetic catalogue establishes only its own exercised denominator. Stable audit IDs,
case-first locks, a lifecycle response and mock timing boundaries are implementation
decisions, not completed stakeholder or ethics validation.
