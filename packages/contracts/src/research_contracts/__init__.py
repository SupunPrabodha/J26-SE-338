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
    preprocessing: PreprocessResponse | None = None


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


class C4EncoderCheckRequest(Contract):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None


class C4EncoderCheckResponse(Contract):
    model_id: Literal["FacebookAI/xlm-roberta-base"] = "FacebookAI/xlm-roberta-base"
    status_message: Literal[
        "Base encoder connected — wellbeing classification unavailable."
    ] = "Base encoder connected — wellbeing classification unavailable."
    encoder_executed: Literal[True] = True
    token_count: int
    truncated: bool
    embedding_shape: list[int]
    hidden_dimension: int = 768


class FeatureContribution(Contract):
    token: str
    weight: float
    direction: Literal["supports", "opposes"]
    abs_weight: float


class C4ExplanationRequest(Contract):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    method: Literal["LIME", "SHAP"]
    target_class: str | None = None
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None


class C4ExplanationResponse(Contract):
    method: Literal["LIME", "SHAP"]
    status: Literal["READY", "AWAITING_CLASSIFIER_CONNECTION", "UNAVAILABLE"] = "READY"
    status_message: str
    model_id: str | None = None
    model_version: str | None = None
    model_revision: str | None = None
    predicted_class: str | None = None
    probabilities: dict[str, float] = {}
    token_count: int | None = None
    truncated: bool | None = None
    target_class: str | None = None
    target_class_probability: float | None = None
    base_value: float | None = None
    output_value: float | None = None
    contributions: list[FeatureContribution] = []
    tokens: list[str] = []
    weights: list[float] = []
    computation_bounds: dict[str, int] = {}
    reconstructed_output: float | None = None
    additivity_residual: float | None = None
    additivity_within_tolerance: bool | None = None
    additivity_discrepancy_message: str | None = None


class C4PredictionRequest(Contract):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None


class C4PredictionResponse(Contract):
    model_id: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
    model_version: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
    model_revision: str | None = None
    predicted_sentiment: Literal["Negative", "Neutral", "Positive"]
    confidence: float
    probabilities: dict[str, float]
    token_count: int
    truncated: bool
    max_sequence_length: int = 512
    status: Literal["READY", "FAILED"] = "READY"
    status_message: str = "Prediction completed successfully."


