"""Export recorded aggregate evidence; never import or execute anonymizers."""

import hashlib
import json
import math
import re
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

STRATEGIES = ("regex", "presidio", "hybrid")
COUNTS = (
    "gold_entities",
    "predicted_entities",
    "tp",
    "fp",
    "fn",
    "missed_gold_pii",
    "partial_masking",
    "unmasked_gold_characters",
    "gold_characters",
    "unnecessary_masked_characters",
    "masked_characters",
)
RATES = ("precision", "recall", "f1")


def _keys(value, expected, context):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise ValueError(f"Invalid aggregate results structure: {context}")


def validate_results(data):
    """Strict aggregate field allowlist; reject fixture/span fields and malformed metrics."""
    _keys(
        data,
        (
            "methodology",
            "benchmark_id",
            "split_sizes",
            "heldout_languages",
            "environment",
            "revision",
            "working_diff_sha256",
            "preprocessing_source_sha256",
            "requirements_sha256",
            "strategies",
        ),
        "root",
    )
    _keys(
        data["methodology"],
        (
            "evaluation_scope",
            "metric_basis",
            "offsets",
            "zero_denominator_policy",
            "masking_coverage",
            "model_languages",
            "selection_policy",
        ),
        "methodology",
    )
    _keys(data["environment"], ("python", "platform", "processor", "versions"), "environment")
    _keys(
        data["environment"]["versions"],
        ("presidio-analyzer", "presidio-anonymizer", "spacy", "en-core-web-sm", "tldextract"),
        "versions",
    )
    _keys(data["split_sizes"], ("development", "heldout"), "splits")
    languages = ("english", "sinhala", "romanized", "code_mixed")
    entities = ("EMAIL", "PHONE", "STUDENT_ID", "PERSON", "LOCATION")
    families = ("heldout-identifiers", "heldout-names-locations", "heldout-wellbeing-negatives")
    _keys(data["heldout_languages"], languages, "language distribution")
    for section in (data["split_sizes"], data["heldout_languages"]):
        if any(type(value) is not int or value < 0 for value in section.values()):
            raise ValueError("Invalid benchmark case count")
    for key, value in data["methodology"].items():
        if key == "model_languages":
            if value != ["en"]:
                raise ValueError("Unsupported recorded model languages")
        elif not isinstance(value, str):
            raise ValueError("Invalid methodology metadata")
    for key in ("python", "platform", "processor"):
        if not isinstance(data["environment"][key], str):
            raise ValueError("Invalid recorded environment metadata")
    if any(not isinstance(value, str) for value in data["environment"]["versions"].values()):
        raise ValueError("Invalid recorded version metadata")
    _keys(data["strategies"], STRATEGIES, "strategies")
    for key, length in (
        ("revision", 40),
        ("working_diff_sha256", 64),
        ("preprocessing_source_sha256", 64),
        ("requirements_sha256", 64),
    ):
        if not isinstance(data[key], str) or not re.fullmatch(f"[a-f0-9]{{{length}}}", data[key]):
            raise ValueError(f"Invalid measurement provenance: {key}")
    if not re.fullmatch(r"c2-synthetic-v\d+-[a-f0-9]{16}", str(data["benchmark_id"])):
        raise ValueError("Invalid benchmark identifier")
    for result in data["strategies"].values():
        _keys(
            result, ("overall", "per_language", "per_entity", "per_family", "runtime"), "strategy"
        )
        metrics = [result["overall"]]
        for group, labels in (
            ("per_language", languages),
            ("per_entity", entities),
            ("per_family", families),
        ):
            _keys(result[group], labels, group)
            metrics.extend(result[group].values())
        for metric in metrics:
            _keys(metric, (*COUNTS, *RATES, *(("cases",) if "cases" in metric else ())), "metrics")
            for key in COUNTS:
                if type(metric[key]) is not int or metric[key] < 0:
                    raise ValueError("Invalid aggregate count")
            if "cases" in metric and (type(metric["cases"]) is not int or metric["cases"] < 0):
                raise ValueError("Invalid aggregate case count")
            for key in RATES:
                if (
                    type(metric[key]) not in (int, float)
                    or not math.isfinite(metric[key])
                    or not 0 <= metric[key] <= 1
                ):
                    raise ValueError("Invalid aggregate rate")
        runtime = result["runtime"]
        _keys(runtime, ("cold_ms", "median_ms", "p95_ms", "repetitions", "calls"), "runtime")
        for value in runtime.values():
            if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
                raise ValueError("Invalid recorded runtime")
    return data


class _NumberedCanvas(Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.states = []

    def showPage(self):
        self.states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self.states)
        for state in self.states:
            self.__dict__.update(state)
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#516175"))
            self.drawString(36, 20, "C2 | Synthetic evaluation | Non-diagnostic research support")
            self.drawRightString(landscape(A4)[0] - 36, 20, f"Page {self._pageNumber} of {total}")
            Canvas.showPage(self)
        Canvas.save(self)


def export_pdf(source: Path, destination: Path) -> Path:
    """Read JSON once; preserve exact source bytes as an embedded attachment.

    Unknown aggregate fields are refused. Conversion updates no measured artifacts
    and uses recorded provenance, never the current Git revision/environment.
    """
    if source.resolve() == destination.resolve():
        raise ValueError("PDF destination must differ from measured JSON")
    raw = source.read_bytes()

    def reject_duplicates(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate aggregate JSON key")
            result[key] = value
        return result

    data = validate_results(json.loads(raw, object_pairs_hook=reject_duplicates))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Cell", fontName="Helvetica", fontSize=8, leading=11))
    styles.add(ParagraphStyle("Body", fontName="Helvetica", fontSize=10, leading=14, spaceAfter=8))
    styles.add(ParagraphStyle("Hash", fontName="Courier", fontSize=8, leading=11, spaceAfter=6))
    story = []
    width = landscape(A4)[0] - 72

    def paragraph(text, style="Body"):
        story.append(Paragraph(escape(str(text)), styles[style]))

    def heading(text):
        story.append(Paragraph(escape(text), styles["Heading2"]))

    def table(headers, rows, widths=None):
        cells = [
            [Paragraph(escape(str(value)), styles["Cell"]) for value in row]
            for row in [headers, *rows]
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
                    ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.HexColor("#63809a")),
                    ("GRID", (0, 1), (-1, -1), 0.25, colors.HexColor("#d4dce5")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.extend([item, Spacer(1, 12)])

    story.append(Paragraph("C2 anonymization comparison", styles["Title"]))
    paragraph("Research panel report | Conversion of existing measured evidence")
    paragraph(
        "Provisional recommendation: Presidio. Production selection remains pending; Regex remains the current default."
    )
    paragraph(f"Benchmark: {data['benchmark_id']}")
    heading("Objective and evaluated scope")
    paragraph(
        "Compare masking of synthetic names, locations, emails, Sri Lankan mobile numbers and student IDs in non-diagnostic student wellbeing preprocessing. Authorized humans interpret outputs and approve releases. No participant data or detected personal values are included."
    )
    paragraph(
        f"Recorded split sizes: development {data['split_sizes']['development']}; held-out {data['split_sizes']['heldout']}. Language distribution: "
        + "; ".join(f"{k.replace('_', ' ')} {v}" for k, v in data["heldout_languages"].items())
        + ". Related template variants stay in the same split; development cases are excluded from scores."
    )
    heading("Configured strategies and evaluation")
    paragraph(
        "Regex uses ordered structured and contextual patterns, including broad Sinhala self-introduction and capitalized English 'I am' rules. Presidio uses English-only spaCy en_core_web_sm, built-in recognizers and custom mobile/student-ID patterns. Custom patterns do not establish Sinhala model support. Email validation uses the locked bundled suffix snapshot without network refresh. Hybrid applies Regex before Presidio, mapping offsets to the original input. Existing placeholders are protected; overlaps resolve deterministically before masking."
    )
    paragraph(
        "Exact typed half-open Unicode character spans determine micro precision, recall and F1. Character unions measure coverage: missed means no gold characters masked; partial means some but not all; unnecessary means masking outside gold spans. Incorrect entity types can cover PII while failing exact detection. Undefined precision/recall = 1; F1 = 0 when both are zero; empty gold/predictions = 1. Legacy placeholder counts do not verify residual PII."
    )
    heading("Overall exact-span comparison")
    table(
        ["Strategy", "Gold", "Pred.", "TP", "FP", "FN", "Precision", "Recall", "F1"],
        [
            [
                s.title(),
                *[
                    data["strategies"][s]["overall"][k]
                    for k in ("gold_entities", "predicted_entities", "tp", "fp", "fn", *RATES)
                ],
            ]
            for s in STRATEGIES
        ],
        [65, 36, 48, 30, 30, 30, 174, 174, width - 587],
    )
    paragraph(
        "Numeric values are displayed without conversion-time rounding. The byte-identical source results.json is embedded in this PDF, preserving all recorded aggregate fields and provenance."
    )
    for group, title in (
        ("per_language", "Language comparison"),
        ("per_entity", "Entity comparison"),
        ("per_family", "Template-family comparison"),
    ):
        heading(title)
        table(
            [
                "Strategy",
                "Group",
                "Gold",
                "Pred.",
                "TP",
                "FP",
                "FN",
                "Precision",
                "Recall",
                "F1",
            ],
            [
                [
                    s.title(),
                    label.replace("_", " ").replace("heldout-", "").replace("-", " "),
                    *[
                        m[k]
                        for k in ("gold_entities", "predicted_entities", "tp", "fp", "fn", *RATES)
                    ],
                ]
                for s in STRATEGIES
                for label, m in data["strategies"][s][group].items()
            ],
            [55, 110, 30, 40, 25, 25, 25, 145, 145, width - 600],
        )
    heading("Masking errors and coverage")
    paragraph(
        "Exact-span FN is distinct from entirely unmasked PII. Partial masks can reveal fragments; unnecessary masking removes ordinary wellbeing language. Character denominators are included below; overlapping gold characters are counted once."
    )
    error_keys = (
        "missed_gold_pii",
        "partial_masking",
        "unmasked_gold_characters",
        "gold_characters",
        "unnecessary_masked_characters",
        "masked_characters",
    )
    table(
        [
            "Strategy",
            "Missed gold entities",
            "Partially masked entities",
            "Unmasked gold characters",
            "Gold characters",
            "Unnecessary masked characters",
            "Masked characters",
        ],
        [
            [s.title(), *[data["strategies"][s]["overall"][k] for k in error_keys]]
            for s in STRATEGIES
        ],
    )
    for group, title in (
        ("per_language", "Masking errors by language"),
        ("per_entity", "Masking errors by entity"),
    ):
        heading(title)
        table(
            [
                "Strategy",
                "Group",
                "Missed",
                "Partial",
                "Unmasked gold chars",
                "Gold chars",
                "Unnecessary chars",
                "Masked chars",
            ],
            [
                [
                    s.title(),
                    label.replace("_", " ").replace("heldout-", "").replace("-", " "),
                    *[m[k] for k in error_keys],
                ]
                for s in STRATEGIES
                for label, m in data["strategies"][s][group].items()
            ],
        )
    heading("Recorded runtime")
    paragraph(
        "Cold measurements include imports, model/engine construction and the first synthetic call in a fresh interpreter, excluding interpreter launch. Warm measurements time production calls after validation warmup, sequentially in benchmark order. P95 uses nearest-rank. There is one cold sample per candidate. These are the original timings; PDF conversion did not execute or retime any strategy."
    )
    table(
        ["Strategy", "Cold ms", "Warm median ms", "Warm p95 ms", "Calls", "Repetitions"],
        [
            [
                s.title(),
                *[
                    data["strategies"][s]["runtime"][k]
                    for k in ("cold_ms", "median_ms", "p95_ms", "calls", "repetitions")
                ],
            ]
            for s in STRATEGIES
        ],
        [65, 185, 185, 185, 75, width - 695],
    )
    heading("Selection rationale and limitations")
    scores = data["strategies"]
    paragraph(
        f"Presidio is the provisional recommendation for further evaluation. Recorded exact-span F1 is {scores['presidio']['overall']['f1']}, compared with Regex {scores['regex']['overall']['f1']} and Hybrid {scores['hybrid']['overall']['f1']}. This does not authorize a production switch."
    )
    paragraph(
        "Regex is fast and explicit but brittle for multiword names and broad self-introduction patterns. Presidio adds English NER and model startup/runtime cost, with limited Sinhala and Romanized coverage. Hybrid inherits Regex false masking and cannot restore removed wellbeing words. Its coverage benefit must be weighed against unnecessary masking, as shown in the error tables."
    )
    paragraph(
        "Production selection remains pending and Regex remains the current default. This small hand-authored synthetic challenge benchmark is not independent population validation. Remaining misses, false masks, language limitations and timing variability require further independent evaluation and owner review. No method establishes complete anonymity or zero re-identification risk. Approved thresholds and controlled human review remain necessary; unresolved privacy-review cases block release."
    )
    story.append(PageBreak())
    heading("Measurement provenance and reproduction")
    paragraph(
        "The following values describe the original measurement environment and working tree, not the PDF converter's current dependencies or revision. Updating exporter dependencies does not change the recorded measurement requirements hash."
    )
    for key in (
        "benchmark_id",
        "revision",
        "working_diff_sha256",
        "preprocessing_source_sha256",
        "requirements_sha256",
    ):
        paragraph(f"{key}: {data[key]}", "Hash")
    for key in ("python", "platform", "processor"):
        paragraph(f"{key}: {data['environment'][key]}")
    table(
        ["Measured dependency / model", "Recorded version"],
        list(data["environment"]["versions"].items()),
    )
    paragraph("Original measurement reproduction command (not executed by PDF conversion):")
    repetitions = {r["runtime"]["repetitions"] for r in scores.values()}
    if len(repetitions) != 1:
        raise ValueError("Recorded candidates have inconsistent repetition counts")
    paragraph(
        f".\\.venv\\Scripts\\python.exe scripts/run.py preprocessing.benchmark_report --output artifacts/c2-anonymization --repetitions {next(iter(repetitions))}",
        "Hash",
    )
    paragraph("Conversion command:", "Body")
    paragraph(
        ".\\.venv\\Scripts\\python.exe scripts/run.py preprocessing.benchmark_report --pdf-from-results artifacts/c2-anonymization/results.json --output artifacts/c2-anonymization",
        "Hash",
    )
    paragraph(f"Source JSON SHA256: {hashlib.sha256(raw).hexdigest()}", "Hash")
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=40,
        title="C2 anonymization comparison | Research panel",
        author="J26-SE-338 | Component 2",
    )
    document.build(story, canvasmaker=_NumberedCanvas)
    writer = PdfWriter(clone_from=BytesIO(buffer.getvalue()))
    writer.add_attachment("results.json", raw)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        writer.write(output)
    return destination
