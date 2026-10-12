"""Plain-English tool-selection evidence from existing aggregate measurements."""

import hashlib
import json
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from preprocessing.pdf_report import STRATEGIES, _NumberedCanvas, validate_results


def export_selection_pdf(source: Path, destination: Path):
    """Round presentation only; embed exact original JSON without new measurement."""
    if source.resolve() == destination.resolve():
        raise ValueError("PDF destination must differ from measured JSON")
    raw = source.read_bytes()
    data = validate_results(json.loads(raw))
    scores = data["strategies"]
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Body", fontSize=11, leading=15, spaceAfter=8))
    styles.add(ParagraphStyle("Cell", fontSize=10, leading=13))
    styles["Code"].fontSize = 8
    styles["Code"].leading = 11
    styles["Code"].spaceAfter = 6
    story = []
    width = landscape(A4)[0] - 72

    def para(text, style="Body"):
        story.append(Paragraph(escape(str(text)), styles[style]))

    def heading(text):
        para(text, "Heading2")

    def table(headers, rows, widths=None):
        cells = [
            [Paragraph(escape(str(v)), styles["Cell"]) for v in row] for row in [headers, *rows]
        ]
        item = Table(
            cells,
            colWidths=widths or [width / len(headers)] * len(headers),
            repeatRows=1,
            hAlign="LEFT",
        )
        item.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbe7f2")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f3f6fa")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#b9c9d9")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.extend([item, Spacer(1, 10)])

    def pct(value):
        return f"{100 * value:.2f}%"

    para("Anonymization: tool selection evidence", "Title")
    para("Component 2 | Research decision and supporting results")
    para(
        "Provisional recommendation: Presidio. Production selection remains pending; Regex remains the current default."
    )
    heading("1. What did we need to choose?")
    para(
        "A method that masks personal information while preserving ordinary wellbeing language. We compared the same three approaches on the same held-out test cases. Evaluated information: names, locations, emails, Sri Lankan mobile numbers and student IDs."
    )
    heading("2. Which tools were tested?")
    table(
        ["Approach", "How the configured approach works"],
        [
            [
                "Regex",
                "Fixed patterns for identifiers and names introduced by particular phrases. Fast and simple, but can miss names or mask ordinary words.",
            ],
            [
                "Presidio",
                "Microsoft Presidio with the English spaCy en_core_web_sm model and custom mobile/student-ID patterns. Adds English name and location recognition.",
            ],
            [
                "Hybrid",
                "Regex masks first; Presidio examines the remaining text. Combines both approaches, but cannot restore ordinary words removed by Regex.",
            ],
        ],
        [100, width - 100],
    )
    heading("3. How was it tested?")
    para(
        f"{data['split_sizes']['development']} development cases were kept separate from {data['split_sizes']['heldout']} held-out cases containing {scores['regex']['overall']['gold_entities']} annotated personal-information items. Held-out cases: "
        + "; ".join(
            f"{k.replace('_', ' ').title()} {v}" for k, v in data["heldout_languages"].items()
        )
        + ". Related template variants stayed in one split."
    )
    para(
        "Tests included repeated identifiers, existing placeholders, multiword names, spelling variations and ordinary wellbeing sentences. A detection was correct only if its information type and original text boundaries matched the annotation. Only disposable synthetic cases were used; no participant data were collected."
    )
    story.append(PageBreak())
    heading("4. What were the overall results?")
    para(
        "Precision: how many detected items were correct? Recall: how many annotated items were correctly detected? F1: the balanced score combining precision and recall. Higher is better. F1 is the primary comparison measure here, not a general accuracy or anonymity percentage."
    )
    table(
        ["Tool", "Precision", "Recall", "F1 score", "Correct / annotated items"],
        [
            [
                s.title(),
                *[pct(scores[s]["overall"][k]) for k in ("precision", "recall", "f1")],
                f"{scores[s]['overall']['tp']} / {scores[s]['overall']['gold_entities']}",
            ]
            for s in STRATEGIES
        ],
    )
    heading("5. Why provisionally choose Presidio?")
    para(
        f"Presidio had the highest balanced F1 score ({pct(scores['presidio']['overall']['f1'])}) and the highest precision ({pct(scores['presidio']['overall']['precision'])}). It made {scores['presidio']['overall']['fp']} incorrect detections, compared with {scores['regex']['overall']['fp']} for Regex and {scores['hybrid']['overall']['fp']} for Hybrid. This supports its provisional selection when balancing detection quality and preservation of useful text."
    )
    table(
        [
            "Tool",
            "PII items entirely unmasked",
            "PII items partly masked",
            "Ordinary characters masked unnecessarily",
            "PII characters left unmasked",
        ],
        [
            [
                s.title(),
                *[
                    scores[s]["overall"][k]
                    for k in (
                        "missed_gold_pii",
                        "partial_masking",
                        "unnecessary_masked_characters",
                        "unmasked_gold_characters",
                    )
                ],
            ]
            for s in STRATEGIES
        ],
    )
    para(
        f"The benchmark contained {scores['regex']['overall']['gold_characters']} annotated PII characters. Coverage counts character positions once. A detection miss may still be partly or fully masked, so detection and masking errors are separate measures."
    )
    para(
        f"Presidio unnecessarily masked {scores['presidio']['overall']['unnecessary_masked_characters']} ordinary characters and produced {scores['presidio']['overall']['partial_masking']} partial masks. Regex and Hybrid each produced {scores['regex']['overall']['partial_masking']} partial masks. Preserving ordinary words matters for subsequent wellbeing analysis."
    )
    para(
        "Regex is faster, but its lower F1 and broad self-introduction patterns limit this choice. Hybrid has the highest recall and leaves fewer PII characters unmasked, but has the lowest precision and most unnecessary masking. Its coverage advantage is real; Presidio is preferred here for the more balanced result, not because it wins every privacy measure."
    )
    story.append(PageBreak())
    heading("6. What does the evidence show by language?")
    table(
        ["Language", "Annotated PII items", "Regex F1", "Presidio F1", "Hybrid F1"],
        [
            [
                label.replace("_", " ").title(),
                scores["regex"]["per_language"][label]["gold_entities"],
                *[pct(scores[s]["per_language"][label]["f1"]) for s in STRATEGIES],
            ]
            for label in data["heldout_languages"]
        ],
    )
    heading("7. Which information types need more work?")
    table(
        ["Information type", "Annotated items", "Regex F1", "Presidio F1", "Hybrid F1"],
        [
            [
                label.replace("_", " ").title(),
                scores["regex"]["per_entity"][label]["gold_entities"],
                *[pct(scores[s]["per_entity"][label]["f1"]) for s in STRATEGIES],
            ]
            for label in scores["regex"]["per_entity"]
        ],
    )
    para(
        "Structured identifiers performed strongly in this test. Names and locations were harder, so the overall score cannot establish that all PII was removed. The group sizes above provide denominator context; these small groups are not population estimates."
    )
    heading("8. What are the limitations and next steps?")
    para(
        f"Presidio left {scores['presidio']['overall']['missed_gold_pii']} annotated items entirely unmasked, versus {scores['regex']['overall']['missed_gold_pii']} for Regex and {scores['hybrid']['overall']['missed_gold_pii']} for Hybrid. The configured model is English-only; custom patterns do not establish Sinhala model support. The small synthetic challenge set is not participant validation."
    )
    para(
        "Further validation must cover names and locations across all languages, followed by owner-approved quality/privacy thresholds. Human review remains required and unresolved privacy reviews block release. No method establishes complete anonymity or zero re-identification risk."
    )
    story.append(PageBreak())
    heading("Supporting evidence: speed and measurement provenance")
    table(
        ["Tool", "Cold start (ms)", "Warm median (ms)", "Warm p95 (ms)"],
        [
            [
                s.title(),
                *[f"{scores[s]['runtime'][k]:.2f}" for k in ("cold_ms", "median_ms", "p95_ms")],
            ]
            for s in STRATEGIES
        ],
    )
    repetitions = {scores[s]["runtime"]["repetitions"] for s in STRATEGIES}
    if len(repetitions) != 1:
        raise ValueError("Inconsistent recorded repetition counts")
    para(
        "Recorded calls and repetitions: "
        + "; ".join(
            f"{s.title()} {scores[s]['runtime']['calls']} calls / {scores[s]['runtime']['repetitions']} repetitions"
            for s in STRATEGIES
        )
        + ". Cold start includes imports, engine/model construction and the first call in a fresh interpreter, excluding interpreter launch. Warm timings follow warmup; p95 is nearest-rank. One cold sample per tool limits timing conclusions."
    )
    para(
        "Percentages and milliseconds are rounded to two decimals for presentation only. Original metrics, exact timings and provenance are preserved in the embedded, byte-identical results.json. No benchmark was rerun and no results were invented. The detailed comparison.md remains available as supporting evidence."
    )
    for key in (
        "benchmark_id",
        "revision",
        "working_diff_sha256",
        "preprocessing_source_sha256",
        "requirements_sha256",
    ):
        para(f"{key}: {data[key]}", "Code")
    for key in ("python", "platform", "processor"):
        para(f"Recorded {key}: {data['environment'][key]}", "Code")
    para(
        "Recorded versions: "
        + "; ".join(f"{k} {v}" for k, v in data["environment"]["versions"].items()),
        "Code",
    )
    para("Original measurement reproduction command (not run for this report):", "Code")
    para(
        f".\\.venv\\Scripts\\python.exe scripts/run.py preprocessing.benchmark_report --output artifacts/c2-anonymization --repetitions {next(iter(repetitions))}",
        "Code",
    )
    para("Convert the existing results into this selection report:", "Code")
    para(
        ".\\.venv\\Scripts\\python.exe scripts/run.py preprocessing.benchmark_report --pdf-from-results artifacts/c2-anonymization/results.json --selection-summary --output artifacts/c2-anonymization/selection-report",
        "Code",
    )
    para(f"Original JSON SHA256: {hashlib.sha256(raw).hexdigest()}", "Code")
    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=36,
        rightMargin=36,
        topMargin=30,
        bottomMargin=40,
        title="Anonymization tool selection evidence",
        author="J26-SE-338 | Component 2",
    ).build(story, canvasmaker=_NumberedCanvas)
    writer = PdfWriter(clone_from=BytesIO(buffer.getvalue()))
    writer.add_attachment("results.json", raw)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        writer.write(output)
    return destination
