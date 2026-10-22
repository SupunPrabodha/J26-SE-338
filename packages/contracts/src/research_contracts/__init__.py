"""Authoritative v1 wire contracts. Generated artifacts must never be edited directly."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

VERSION = "1.0.0"
PURPOSE = "synthetic-wellbeing-screening"
FIXTURES = {
    "english": "SYNTHETIC: My practice timetable feels busy this week.",
    "sinhala": "SYNTHETIC: මේ සතියේ මගේ පුහුණු කාලසටහන කාර්යබහුලයි.",
    "romanized": "SYNTHETIC: Me sathiye mage practice kalasatahana busy.",
    "mixed": "SYNTHETIC: මේ සතියේ practice timetable එක busy.",
}


def now() -> datetime:
    return datetime.now(UTC)


class ConsentState(StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    WITHDRAWN = "WITHDRAWN"
    REJECTED = "REJECTED"
    INVALID = "INVALID"


class WorkflowState(StrEnum):
    RECEIVED = "RECEIVED"
    CONSENT_VERIFIED = "CONSENT_VERIFIED"
    PREPROCESSING = "PREPROCESSING"
    INFERENCE = "INFERENCE"
    EXPLANATION = "EXPLANATION"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    WITHDRAWAL_REQUESTED = "WITHDRAWAL_REQUESTED"
    WITHDRAWN = "WITHDRAWN"


class Role(StrEnum):
    STUDENT = "STUDENT"
    COUNSELLOR = "COUNSELLOR"
    ADMIN = "ADMIN"
    RESEARCHER = "RESEARCHER"
    SERVICE = "SERVICE"


class ErrorCode(StrEnum):
    AUTH_REQUIRED = "AUTH_REQUIRED"
    AUTH_INVALID = "AUTH_INVALID"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONSENT_REQUIRED = "CONSENT_REQUIRED"
    CONSENT_INVALID = "CONSENT_INVALID"
    CONTRACT_INVALID = "CONTRACT_INVALID"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    DEPENDENCY_UNAVAILABLE = "DEPENDENCY_UNAVAILABLE"
    DOWNSTREAM_FAILED = "DOWNSTREAM_FAILED"
    DOWNSTREAM_TIMEOUT = "DOWNSTREAM_TIMEOUT"
    RETRY_EXHAUSTED = "RETRY_EXHAUSTED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_default=True)
    schema_version: Literal["1.0.0"] = VERSION
    synthetic: Literal[True] = True
    development_only: Literal[True] = True

    @field_validator("*", mode="after")
    @classmethod
    def utc_dates(cls, value):
        if isinstance(value, datetime):
            return value.astimezone(UTC)
        return value


class ConsentDecision(Contract):
    consent_status: Literal[ConsentState.ACTIVE, ConsentState.REJECTED]
    consent_version: Literal["dev-notice-1"] = "dev-notice-1"
    purpose: Literal["synthetic-wellbeing-screening"] = PURPOSE


class ConsentRecord(Contract):
    consent_id: UUID
    consent_status: ConsentState
    consent_version: str
    purpose: str
    created_at: AwareDatetime
    expires_at: AwareDatetime


class SubmissionSession(Contract):
    session_id: UUID
    role: Role
    expires_at: AwareDatetime


class WorkflowRequest(Contract):
    consent_id: UUID
    idempotency_key: UUID
    fixture_id: Literal["english", "sinhala", "romanized", "mixed"]
    text: Annotated[str, Field(min_length=1, max_length=1000)]

    @field_validator("text")
    @classmethod
    def fixture_only(cls, value):
        if value not in FIXTURES.values():
            raise ValueError("Only built-in synthetic fixtures are accepted")
        return value


class PseudonymousCase(Contract):
    case_id: UUID
    correlation_id: UUID
    processing_status: WorkflowState
    created_at: AwareDatetime
    updated_at: AwareDatetime
    error_code: ErrorCode | None = None


class WorkflowExecution(PseudonymousCase):
    idempotency_key: UUID
    attempts: Annotated[int, Field(ge=0, le=3)] = 0


class ConsentLifecycle(Contract):
    consent: ConsentRecord
    case: PseudonymousCase | None = None
    explicitly_withdrawn_at: AwareDatetime | None = None
    disposal_reason: Literal["RETENTION", "OWNER_WITHDRAWAL", "LEGACY_DISPOSAL"] | None = None


class ServiceContext(Contract):
    case_id: UUID
    correlation_id: UUID
    idempotency_key: UUID
    consent_status: Literal[ConsentState.ACTIVE] = ConsentState.ACTIVE
    consent_version: Literal["dev-notice-1"] = "dev-notice-1"
    purpose: Literal["synthetic-wellbeing-screening"] = PURPOSE


class PreprocessRequest(ServiceContext):
    text: Annotated[str, Field(min_length=1, max_length=1000)]


class PreprocessResponse(ServiceContext):
    service_name: Literal["preprocessing"] = "preprocessing"
    service_version: Literal["0.1.0"] = "0.1.0"
    pipeline_version: Literal["mock-1"] = "mock-1"
    dataset_version: Literal["synthetic-fixtures-1"] = "synthetic-fixtures-1"
    anonymized_text: str
    normalized_text: str
    language: Literal["en", "si", "romanized-si", "mixed", "uncertain"]
    tokens: list[str]
    token_offsets: list[tuple[int, int]]
    transformations: list[str]


class InferenceRequest(ServiceContext):
    preprocessing: PreprocessResponse


class InferenceResponse(ServiceContext):
    service_name: Literal["nlp"] = "nlp"
    service_version: Literal["0.1.0"] = "0.1.0"
    model_version: Literal["mock-1"] = "mock-1"
    dataset_version: Literal["synthetic-fixtures-1"] = "synthetic-fixtures-1"
    wellbeing_indicator: Literal["synthetic-academic-pressure"] = "synthetic-academic-pressure"
    emotional_tone: Literal["synthetic-neutral"] = "synthetic-neutral"
    stress_language_signals: list[Literal["synthetic-busy-timetable"]]
    confidence: Annotated[float, Field(ge=0, le=1)]
    calibrated: Literal[False] = False
    review_priority: Literal["HUMAN_REVIEW_REQUIRED"] = "HUMAN_REVIEW_REQUIRED"


class ExplanationRequest(ServiceContext):
    preprocessing: PreprocessResponse
    inference: InferenceResponse


class ExplanationResponse(ServiceContext):
    service_name: Literal["xai"] = "xai"
    service_version: Literal["0.1.0"] = "0.1.0"
    explainer_version: Literal["mock-1"] = "mock-1"
    method: Literal["MOCK_FIXED_FIXTURE"] = "MOCK_FIXED_FIXTURE"
    evidence: list[str]
    reliability_status: Literal["NOT_EVALUATED"] = "NOT_EVALUATED"
    faithfulness: None = None
    stability: None = None
    counterfactual: None = None


class ReviewTask(Contract):
    task_id: UUID
    case: PseudonymousCase
    inference: InferenceResponse
    explanation: ExplanationResponse
    human_review_required: Literal[True] = True


class HumanReviewAction(Contract):
    action: Literal["START_REVIEW", "COMPLETE_REVIEW"]
    idempotency_key: UUID


class WithdrawalRequest(Contract):
    idempotency_key: UUID


class RetentionAction(Contract):
    action_id: UUID
    case_id: UUID
    action: Literal["DELETE_DERIVED_EVIDENCE", "EXPIRE_ACCESS"]
    status: Literal["PENDING", "COMPLETED", "FAILED"]
    created_at: AwareDatetime


class AuditEvent(Contract):
    event_id: UUID = Field(default_factory=uuid4)
    case_id: UUID | None = None
    correlation_id: UUID
    event_type: Literal[
        "AUTH_LOGIN",
        "AUTH_FAILURE",
        "AUTH_LOGOUT",
        "CONSENT_RECORDED",
        "WORKFLOW_TRANSITION",
        "HUMAN_REVIEW",
        "WITHDRAWAL",
        "RETENTION",
        "ASSIGNMENT",
    ]
    status: str
    created_at: AwareDatetime = Field(default_factory=now)
    service_name: Literal["orchestrator"] = "orchestrator"
    service_version: Literal["0.1.0"] = "0.1.0"


class LifecycleAuditEvent(AuditEvent):
    event_type: Literal[
        "AUTH_LOGIN",
        "AUTH_FAILURE",
        "AUTH_LOGOUT",
        "AUTH_REFRESH",
        "SESSION_REVOKED",
        "CONSENT_RECORDED",
        "CONSENT_EXPIRED",
        "OPERATION_BLOCKED",
        "SUBMISSION",
        "SUBMISSION_REPLAY",
        "WORKFLOW_TRANSITION",
        "JOB_RETRY",
        "JOB_TERMINAL",
        "JOB_CLAIM",
        "HUMAN_REVIEW",
        "WITHDRAWAL",
        "RETENTION",
        "ASSIGNMENT",
    ]
    policy_expires_at: AwareDatetime | None = None
    trace_id: UUID | None = None


class ServiceProvenance(Contract):
    correlation_id: UUID
    preprocessing_service_version: Literal["0.1.0"]
    pipeline_version: Literal["mock-1"]
    preprocessing_dataset_version: Literal["synthetic-fixtures-1"]
    nlp_service_version: Literal["0.1.0"]
    model_version: Literal["mock-1"]
    model_dataset_version: Literal["synthetic-fixtures-1"]
    xai_service_version: Literal["0.1.0"]
    explainer_version: Literal["mock-1"]


class ServiceError(Contract):
    error_code: ErrorCode
    correlation_id: UUID
    message: Literal["Request could not be completed safely."] = (
        "Request could not be completed safely."
    )


class HealthResponse(Contract):
    service_name: str
    status: Literal["ok", "unavailable"]


class VersionResponse(Contract):
    service_name: str
    service_version: Literal["0.1.0"] = "0.1.0"
    mode: Literal["MOCK_SYNTHETIC_DEVELOPMENT_ONLY", "SYNTHETIC_DEVELOPMENT_ONLY"]


class LoginRequest(Contract):
    username: Annotated[str, Field(min_length=1, max_length=100)]
    password: Annotated[str, Field(min_length=1, max_length=256)]


class AssignmentRequest(Contract):
    counsellor_id: UUID


class AccountResponse(Contract):
    account_id: UUID
    role: Role


class FixturesResponse(Contract):
    fixtures: dict[str, str]


DemoScenarioId = Literal[
    "english-person",
    "sinhala-person",
    "romanized-person",
    "code-mixed-person",
    "english-ordinary",
    "english",
    "sinhala",
    "romanized",
    "code-mixed",
    "short",
    "empty",
    "placeholder-only",
    "duplicate",
    "masking-collision",
    "empty-batch",
]
DemoStrategy = Literal["regex", "presidio", "hybrid"]


class C2DemoRequest(BaseModel):
    """Browser input contains selectors only; no contract flags or text."""

    model_config = ConfigDict(extra="forbid", strict=True)
    scenario_id: DemoScenarioId
    strategy: DemoStrategy = "regex"


class C2DemoScenario(Contract):
    scenario_id: DemoScenarioId
    label: str
    language_label: Literal["english", "sinhala", "romanized-si", "code-mixed", "not-applicable"]
    record_count: int = Field(ge=0)


class C2DemoCatalogue(Contract):
    scenarios: list[C2DemoScenario]
    strategies: list[DemoStrategy]
    default_strategy: Literal["regex"] = "regex"
    language_labels_are_fixture_metadata: Literal[True] = True


class C2DemoLanguageIdentification(Contract):
    """Provisional deterministic evidence, not anonymizer configuration."""

    language: Literal["sinhala", "english", "romanized-si", "code-mixed", "uncertain", "unknown"]
    status: Literal["provisional", "uncertain", "unknown"]
    reason: Literal[
        "no_language_letters_after_masking",
        "sinhala_script_evidence_only",
        "unsupported_script_evidence",
        "sinhala_script_and_english_markers",
        "mixed_script_without_supported_lexical_evidence",
        "english_and_romanized_markers",
        "multiple_romanized_markers",
        "multiple_english_markers",
        "insufficient_or_ambiguous_latin_evidence",
        "explicit_romanized_name_introduction",
        "sinhala_language_with_romanized_mixed_script_evidence",
    ]
    method: Literal["c2-rule-language-v1", "c2-rule-language-v1.1", "c2-rule-language-v1.2"] = (
        "c2-rule-language-v1.1"
    )
    uncertain: bool


class C2DemoRecord(Contract):
    record_id: str
    original_text: str
    anonymized_text: str
    transformations: list[str]
    quality_status: Literal["PASS", "REVIEW", "REJECT"]
    quality_issues: list[str]
    requires_privacy_review: bool
    language_identification: C2DemoLanguageIdentification | None = None
    normalized_text: str | None = None
    tokens: list[str] | None = None
    token_offsets: (
        list[Annotated[list[Annotated[int, Field(ge=0)]], Field(min_length=2, max_length=2)]] | None
    ) = Field(
        default=None,
        description="Zero-based [start, end) Unicode code points in normalized_text; not UTF-16 units.",
    )
    normalization_method: Literal["c2-nfc-whitespace-v1"] | None = None
    tokenization_method: Literal["c2-grapheme-words-v1"] | None = None
    token_offset_unit: Literal["unicode_code_points"] | None = None


class C2DemoQualityPolicy(Contract):
    short_text_review_below: int = Field(ge=1)
    comparison_case_insensitive: bool


class C2DemoQualitySummary(Contract):
    total_records: int = Field(ge=0)
    status_counts: dict[Literal["PASS", "REVIEW", "REJECT"], int]
    issue_counts: dict[str, int]
    data_quality_gate: Literal["PASSED", "FAILED"]
    blocking_reasons: list[str]
    policy: C2DemoQualityPolicy
    policy_status: Literal["development_only_not_research_approved"]
    release_ready_meaning: str
    duplicate_text_meaning: str
    privacy_note: str


class C2DemoPrivacySummary(Contract):
    pipeline_stage: Literal["release_privacy_gate"]
    total_records: int = Field(ge=0)
    status: Literal["PASSED", "FAILED"]
    issues: list[str]
    issue_counts: dict[str, int]
    privacy_note: str
    limitation: str


class C2DemoResponse(Contract):
    scenario: C2DemoScenario
    strategy: DemoStrategy
    records: list[C2DemoRecord]
    quality_summary: C2DemoQualitySummary
    privacy_summary: C2DemoPrivacySummary
    release_ready: bool
    blocking_reasons: list[str]
    human_release_required: Literal[True] = True
    independent_research_validation: Literal[False] = False
    release_ready_meaning: Literal[
        "Automated prerequisites only; human release approval remains required."
    ] = "Automated prerequisites only; human release approval remains required."


class C2CustomDemoRequest(BaseModel):
    """Ephemeral input; optional legacy hint never configures detection."""

    model_config = ConfigDict(extra="forbid", strict=True)
    text: Annotated[str, Field(max_length=1000)]
    language_hint: Literal["sinhala", "english", "romanized-si", "code-mixed", "unsure"] = "unsure"
    strategy: Literal["presidio"] = "presidio"


class C2CustomDemoResponse(Contract):
    language_hint: Literal["sinhala", "english", "romanized-si", "code-mixed", "unsure"]
    strategy: Literal["presidio"] = "presidio"
    records: list[C2DemoRecord]
    quality_summary: C2DemoQualitySummary
    privacy_summary: C2DemoPrivacySummary
    release_ready: bool
    blocking_reasons: list[str]
    human_release_required: Literal[True] = True
    independent_research_validation: Literal[False] = False


class C2AnnotationLabels(Contract):
    """Single-label provisional demo dimensions; null means unfinished, never neutral."""

    model_config = ConfigDict(extra="forbid", strict=True)
    language: (
        Literal["sinhala", "english", "romanized-si", "code-mixed", "other", "uncertain"] | None
    ) = None
    code_mixing: (
        Literal["none", "insertion", "intra-sentential", "inter-sentential", "uncertain"] | None
    ) = None
    emotion: (
        Literal["neutral", "sadness", "worry-or-fear", "anger", "joy", "mixed", "uncertain"] | None
    ) = None
    wellbeing: (
        Literal[
            "academic-pressure",
            "sleep-or-energy",
            "concentration-or-motivation",
            "social-connection",
            "coping-or-support",
            "no-clear-indicator",
            "uncertain",
        ]
        | None
    ) = None


class C2AnnotationSaveRequest(Contract):
    model_config = ConfigDict(extra="forbid", strict=True)
    record_version: str
    pipeline_version: str
    annotation_schema_version: Literal["c2-dataset-annotation-v1"]
    vocabulary_version: Literal["c2-provisional-vocabulary-v1"]
    expected_revision: Annotated[int, Field(ge=0)]
    status: Literal["DRAFT", "FINAL"]
    labels: C2AnnotationLabels


class C2AnnotationRevision(Contract):
    revision: int
    status: Literal["DRAFT", "FINAL"]
    labels: C2AnnotationLabels
    saved_at: AwareDatetime


class C2AnnotationItem(Contract):
    record_id: str
    record_version: str
    pipeline_version: str
    annotation_schema_version: Literal["c2-dataset-annotation-v1"]
    vocabulary_version: Literal["c2-provisional-vocabulary-v1"]
    preprocessing: C2DemoResponse | C2CustomDemoResponse


class C2AnnotationQueue(Contract):
    items: list[C2AnnotationItem]
    vocabulary: dict[str, list[str]]
    vocabulary_status: Literal["PROVISIONAL_DEMO_ONLY_NOT_EXPERT_APPROVED"] = (
        "PROVISIONAL_DEMO_ONLY_NOT_EXPERT_APPROVED"
    )
    required_annotators: Literal[2] = 2


class C2AnnotationPrepareRequest(Contract):
    """Initialize only fixed server-owned examples; arbitrary input is forbidden."""


class C2AnnotationDetail(Contract):
    item: C2AnnotationItem
    own_history: list[C2AnnotationRevision]
    finalized_count: Annotated[int, Field(ge=0, le=2)]
    annotation_status: Literal["PENDING", "DRAFT", "SUBMITTED", "PAIR_FINALIZED"]
    # No account IDs, usernames or peer drafts. Peer final labels are blind until both finish.
    peer_final: C2AnnotationRevision | None = None
    can_submit: bool
    agreement_status: Literal["NOT_EVALUATED"] = "NOT_EVALUATED"
    adjudication_status: Literal["PENDING"] = "PENDING"
    human_release_required: Literal[True] = True


class C2AnnotationAnswer(Contract):
    question_id: str
    question_text: str
    source_record_id: str
    required: bool
    state: Literal["AVAILABLE", "WITHHELD", "OPTIONAL_UNANSWERED", "MISSING_REQUIRED"]
    blocking_reasons: list[str]
    annotation: C2AnnotationDetail | None = None


class C2AnnotationSubmission(Contract):
    submission_id: str
    submission_version: str
    source_dataset_id: str
    source_file_sha256: str
    required_answers: int
    available_answers: int
    finalized_answers: int
    blocked_answers: int
    complete: bool
    answers: list[C2AnnotationAnswer]
    agreement_status: Literal["NOT_EVALUATED"] = "NOT_EVALUATED"
    adjudication_status: Literal["PENDING"] = "PENDING"
    human_release_required: Literal[True] = True


class C2AnnotationSubmissionQueue(Contract):
    submissions: list[C2AnnotationSubmission]
    vocabulary: dict[str, list[str]]
    vocabulary_status: Literal["PROVISIONAL_DEMO_ONLY_NOT_EXPERT_APPROVED"] = (
        "PROVISIONAL_DEMO_ONLY_NOT_EXPERT_APPROVED"
    )
