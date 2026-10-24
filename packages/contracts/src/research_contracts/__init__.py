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
    idempotency_key: UUID | None = None
    source_reference: Annotated[str, Field(max_length=100)] | None = None


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
    explanation_id: UUID | None = None
    created_at: AwareDatetime | None = None
    is_development: bool = True
    source_reference: str | None = None
    diagnostics: dict[str, int | float | str | bool] = {}


class C4ExplanationSummary(Contract):
    explanation_id: UUID
    created_at: AwareDatetime
    method: Literal["LIME", "SHAP"]
    target_class: str
    predicted_class: str | None = None
    target_class_probability: float | None = None
    is_development: bool = True
    source_reference: str | None = None


class C4ExplanationListResponse(Contract):
    items: list[C4ExplanationSummary]
    total: int
    limit: int
    offset: int


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


class EditOperation(Contract):
    op: Literal["delete", "replace", "insert"]
    index: int
    original: str | None = None
    replacement: str | None = None
    start_offset: int | None = None
    end_offset: int | None = None


class TextSpanLock(Contract):
    start: int
    end: int
    text: str | None = None


class TextSpanDiff(Contract):
    text: str
    type: Literal["unchanged", "deleted", "inserted", "replaced"]
    original_text: str | None = None


class CounterfactualFeedback(Contract):
    feedback_id: UUID | None = None
    candidate_id: str
    reviewer_id: str | None = None
    natural_wording: Literal["Yes", "No", "Unsure"] | None = None
    context_preserved: Literal["Yes", "No", "Unsure"] | None = None
    useful: Literal["Yes", "No", "Unsure"] | None = None
    comment: Annotated[str, Field(max_length=500)] | None = None
    created_at: AwareDatetime | None = None
    updated_at: AwareDatetime | None = None


class CounterfactualFeedbackRequest(Contract):
    candidate_id: Annotated[str, Field(min_length=1, max_length=64)]
    natural_wording: Literal["Yes", "No", "Unsure"] | None = None
    context_preserved: Literal["Yes", "No", "Unsure"] | None = None
    useful: Literal["Yes", "No", "Unsure"] | None = None
    comment: Annotated[str, Field(max_length=500)] | None = None


class CounterfactualCandidate(Contract):
    candidate_id: str | None = None
    candidate_text: str | None = None
    edits: list[EditOperation] = []
    edit_count: int
    predicted_class: str
    probabilities: dict[str, float]
    target_probability: float
    target_probability_delta: float
    diff_spans: list[TextSpanDiff] = []
    minimality_rank: int = 1
    minimality_description: str = (
        "Fewest edits found within this search."
    )
    verified: bool = True
    feedback: CounterfactualFeedback | None = None


class C4CounterfactualRequest(Contract):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    target_class: Literal["Negative", "Neutral", "Positive"]
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None
    idempotency_key: UUID | None = None
    source_reference: Annotated[str, Field(max_length=100)] | None = None
    max_edits: int = 2
    max_candidates: int = 40
    edit_mode: Literal["both", "replace_only", "delete_only"] = "both"
    locked_spans: list[TextSpanLock] = []


class C4CounterfactualResponse(Contract):
    counterfactual_id: UUID | None = None
    created_at: AwareDatetime | None = None
    target_class: str
    original_predicted_class: str | None = None
    original_probabilities: dict[str, float] = {}
    outcome: Literal[
        "SUCCESS",
        "NO_COUNTERFACTUAL_FOUND",
        "ALREADY_TARGET_CLASS",
        "SEARCH_LIMIT_EXCEEDED",
        "TIMEOUT",
        "UNAVAILABLE_MODEL",
    ] = "SUCCESS"
    outcome_message: str
    candidates: list[CounterfactualCandidate] = []
    best_candidate: CounterfactualCandidate | None = None
    search_limits: dict[str, int | float | str] = {}
    model_id: str | None = None
    model_version: str | None = None
    model_revision: str | None = None
    is_development: bool = True
    source_reference: str | None = None
    execution_time_ms: float | None = None
    evaluated_candidate_count: int = 0
    successful_candidate_count: int = 0
    stopping_reason: str | None = None
    request_hash: str | None = None
    supported_languages: list[str] = [
        "English",
        "Sinhala",
        "Romanized Sinhala",
        "Code-mixed",
    ]
    non_diagnostic_notice: str = (
        "Model-behaviour exploration only. Non-diagnostic output for screening support; "
        "requires authorized human interpretation and does not constitute wellbeing or treatment advice."
    )


class C4CounterfactualSummary(Contract):
    counterfactual_id: UUID
    created_at: AwareDatetime
    target_class: str
    original_predicted_class: str | None = None
    outcome: str
    candidate_count: int
    best_edit_count: int | None = None
    is_development: bool = True
    source_reference: str | None = None


class C4CounterfactualListResponse(Contract):
    items: list[C4CounterfactualSummary]
    total: int
    limit: int
    offset: int


class C4ManualEvaluationRequest(Contract):
    original_text: Annotated[str, Field(min_length=1, max_length=2000)]
    edited_text: Annotated[str, Field(min_length=1, max_length=2000)]
    target_class: Literal["Negative", "Neutral", "Positive"]
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None


class C4ManualEvaluationResponse(Contract):
    target_class: str
    original_predicted_class: str
    original_probabilities: dict[str, float] = {}
    edited_predicted_class: str
    edited_probabilities: dict[str, float] = {}
    target_probability_before: float
    target_probability_after: float
    target_probability_delta: float
    is_flip: bool
    flip_status_label: str
    edit_count: int
    edits: list[EditOperation] = []
    diff_spans: list[TextSpanDiff] = []
    model_id: str | None = None
    model_version: str | None = None
    model_revision: str | None = None
    execution_time_ms: float | None = None
    non_diagnostic_notice: str = (
        "Model-behaviour exploration only. Non-diagnostic output for screening support; "
        "requires authorized human interpretation and does not constitute wellbeing or treatment advice."
    )


class C4FaithfulnessOccurrence(Contract):
    occurrence_id: str
    word: str
    start: int
    end: int
    weight: float
    rank: int


class C4FaithfulnessStepResult(Contract):
    step: int
    removed_words: list[str] = []
    removed_occurrence_ids: list[str] = []
    modified_text: str = ""
    remaining_probability: float
    comprehensiveness_drop: float
    keep_remaining_probability: float | None = None
    sufficiency_gap: float | None = None
    random_mean_probability: float | None = None
    random_mean_drop: float | None = None
    random_std_drop: float | None = None
    random_trial_count: int = 0
    difference_from_random: float | None = None


class C4FaithfulnessRequest(Contract):
    explanation_id: UUID
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None
    max_removal_words: int | None = None
    max_removal_pct: float | None = None
    random_trials: int = 5
    seed: int = 42
    idempotency_key: UUID | None = None
    source_reference: Annotated[str, Field(max_length=100)] | None = None


class C4InternalFaithfulnessRequest(Contract):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    explanation_id: UUID
    method: Literal["LIME", "SHAP"]
    explained_class: str
    tokens: list[str] = []
    weights: list[float] = []
    contributions: list[FeatureContribution] = []
    model_revision: str | None = None
    target_class_probability: float | None = None
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None
    max_removal_words: int | None = None
    max_removal_pct: float | None = None
    random_trials: int = 5
    seed: int = 42


class C4FaithfulnessResponse(Contract):
    evaluation_id: UUID | None = None
    created_at: AwareDatetime | None = None
    explanation_id: UUID
    method: Literal["LIME", "SHAP"]
    explained_class: str
    baseline_probability: float
    model_id: str | None = None
    model_version: str | None = None
    model_revision: str | None = None
    outcome: Literal[
        "SUCCESS",
        "PARTIAL",
        "NO_SUPPORTING_WORDS",
        "UNSUPPORTED_ALIGNMENT",
        "INCOMPATIBLE_MODEL",
        "TEXT_MISMATCH",
        "OVERLENGTH_TEXT",
        "TIMEOUT",
        "UNAVAILABLE_MODEL",
        "INFERENCE_FAILED",
    ] = "SUCCESS"
    outcome_message: str
    ranked_words: list[C4FaithfulnessOccurrence] = []
    steps: list[C4FaithfulnessStepResult] = []
    aopc: float | None = None
    final_comprehensiveness_drop: float | None = None
    final_sufficiency_gap: float | None = None
    final_random_mean_drop: float | None = None
    final_difference_from_random: float | None = None
    total_eligible_words: int = 0
    budget_requested: int = 0
    budget_evaluated: int = 0
    completed_steps: int = 0
    completed_trials: int = 0
    total_inferences: int = 0
    execution_time_ms: float | None = None
    seed: int = 42
    stopping_reason: str | None = None
    is_development: bool = True
    source_reference: str | None = None
    saved: bool = False
    non_diagnostic_notice: str = (
        "Model-behaviour evaluation only. Non-diagnostic output for screening support; "
        "requires authorized human interpretation and does not replace professional counselling."
    )


class C4FaithfulnessSummary(Contract):
    evaluation_id: UUID
    explanation_id: UUID
    created_at: AwareDatetime
    method: Literal["LIME", "SHAP"]
    explained_class: str
    baseline_probability: float
    aopc: float | None = None
    outcome: str
    is_development: bool = True
    source_reference: str | None = None


class C4FaithfulnessListResponse(Contract):
    items: list[C4FaithfulnessSummary]
    total: int
    limit: int
    offset: int


class C4StabilityWordConsistency(Contract):
    occurrence_id: str
    word: str = ""
    start: int
    end: int
    mean_weight: float
    std_dev: float | None = None
    top_k_frequency: float
    run_occurrence_count: int


class C4StabilityRunResult(Contract):
    run_index: int
    seed: int | None = None
    is_reference: bool = False
    status: Literal["SUCCESS", "FAILED"] = "SUCCESS"
    error_message: str | None = None
    execution_time_ms: float | None = None
    top_k_overlap: float | None = None
    rank_correlation: float | None = None
    weights: dict[str, float] = {}
    top_k_ids: list[str] = []


class C4StabilityRequest(Contract):
    explanation_id: UUID
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None
    run_count: Annotated[int, Field(ge=2, le=20)] = 5
    top_k: Annotated[int, Field(ge=1, le=50)] = 5
    base_seed: Annotated[int, Field(ge=0, le=2147483647)] = 42
    explainer_evals: Annotated[int, Field(ge=10, le=500)] | None = None
    idempotency_key: UUID | None = None
    source_reference: Annotated[str, Field(max_length=100)] | None = None


class C4InternalStabilityRequest(Contract):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    explanation_id: UUID
    method: Literal["LIME", "SHAP"]
    explained_class: str
    model_revision: str | None = None
    target_class_probability: float | None = None
    run_count: int = 5
    top_k: int = 5
    base_seed: int = 42
    explainer_evals: int | None = None
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None


class C4StabilityResponse(Contract):
    evaluation_id: UUID | None = None
    created_at: AwareDatetime | None = None
    explanation_id: UUID
    method: Literal["LIME", "SHAP"]
    explained_class: str
    baseline_probability: float
    model_id: str | None = None
    model_version: str | None = None
    model_revision: str | None = None
    explainer_version: str | None = None
    outcome: Literal[
        "SUCCESS",
        "PARTIAL",
        "UNSUPPORTED_ALIGNMENT",
        "INCOMPATIBLE_MODEL",
        "TEXT_MISMATCH",
        "OVERLENGTH_TEXT",
        "TIMEOUT",
        "UNAVAILABLE_MODEL",
        "INFERENCE_FAILED",
    ] = "SUCCESS"
    outcome_message: str
    stopping_reason: str | None = None
    runs: list[C4StabilityRunResult] = []
    word_consistency: list[C4StabilityWordConsistency] = []
    mean_top_k_overlap: float | None = None
    mean_rank_correlation: float | None = None
    mean_attribution_std: float | None = None
    requested_runs: int = 5
    completed_runs: int = 0
    effective_k: int = 0
    total_eligible_words: int = 0
    is_deterministic: bool = False
    determinism_notice: str | None = None
    execution_time_ms: float | None = None
    is_development: bool = True
    source_reference: str | None = None
    saved: bool = False
    non_diagnostic_notice: str = (
        "Model-behaviour stability analysis only. Measures repeated-run consistency, "
        "not correctness, faithfulness, or clinical validity. Output supports counsellor "
        "review and does not replace professional counselling."
    )


class C4StabilitySummary(Contract):
    evaluation_id: UUID
    explanation_id: UUID
    created_at: AwareDatetime
    method: Literal["LIME", "SHAP"]
    explained_class: str
    mean_top_k_overlap: float | None = None
    mean_rank_correlation: float | None = None
    mean_attribution_std: float | None = None
    requested_runs: int
    completed_runs: int
    outcome: str
    is_development: bool = True
    source_reference: str | None = None


class C4StabilityListResponse(Contract):
    items: list[C4StabilitySummary]
    total: int
    limit: int
    offset: int


class C4ComparisonMetricSummary(Contract):
    metric: str
    metric_label: str
    definition_version: str = "1.0.0"
    unit: str
    lime_mean: float | None = None
    lime_std: float | None = None
    shap_mean: float | None = None
    shap_std: float | None = None
    paired_difference_mean: float | None = None
    paired_difference_std: float | None = None
    valid_pairs_count: int = 0
    missing_count: int = 0
    incompatible_count: int = 0
    excluded_count: int = 0
    lime_median: float | None = None
    lime_iqr: float | None = None
    shap_median: float | None = None
    shap_iqr: float | None = None
    effective_k: int | None = None
    common_k: int | None = None


class C4PairedEvidenceItem(Contract):
    input_reference: str
    source_hash: str | None = None
    language: Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed", "Unknown"] = "Unknown"
    model_revision: str | None = None
    explained_class: str
    metric: str
    lime_value: float | None = None
    shap_value: float | None = None
    paired_difference: float | None = None
    status: Literal[
        "COMPARABLE",
        "INCOMPATIBLE",
        "MISSING_LIME",
        "MISSING_SHAP",
        "MISSING_BOTH",
        "EVALUATION_FAILED",
        "PROVENANCE_UNAVAILABLE",
    ] = "COMPARABLE"
    reason: str | None = None
    lime_explanation_id: UUID | None = None
    shap_explanation_id: UUID | None = None
    lime_evaluation_id: UUID | None = None
    shap_evaluation_id: UUID | None = None
    lime_created_at: AwareDatetime | None = None
    shap_created_at: AwareDatetime | None = None
    settings_summary: dict[str, str | int | float | bool | None] = {}


class C4ComparisonLanguageGroup(Contract):
    language: Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed", "Unknown"]
    valid_pairs_count: int = 0
    lime_mean: float | None = None
    lime_std: float | None = None
    shap_mean: float | None = None
    shap_std: float | None = None
    paired_difference_mean: float | None = None
    paired_difference_std: float | None = None


class C4CoverageCard(Contract):
    distinct_inputs_in_scope: int = 0
    comparable_pairs: int = 0
    missing_evidence: int = 0
    incompatible_evidence: int = 0


class C4ComparisonEvaluatedResponse(Contract):
    coverage: C4CoverageCard
    selected_metric: str
    metric_summaries: list[C4ComparisonMetricSummary] = []
    language_groups: list[C4ComparisonLanguageGroup] = []
    paired_items: list[C4PairedEvidenceItem] = []
    total_items: int = 0
    limit: int = 20
    offset: int = 0
    selection_rules: str = "Deterministic default: latest successfully completed compatible LIME and SHAP pair within selected configuration."
    non_diagnostic_notice: str = (
        "This page compares saved explanation-evaluation evidence. Consistency and deletion behaviour "
        "do not establish prediction correctness or clinical validity. The system supports counsellor-assisted "
        "screening review and does not replace professional counselling."
    )


class C4ComparisonCandidateRecord(Contract):
    record_id: UUID
    explanation_id: UUID
    method: Literal["LIME", "SHAP"]
    record_type: Literal["FAITHFULNESS", "STABILITY", "EXPLANATION"]
    created_at: AwareDatetime
    is_compatible: bool = True
    incompatibility_reason: str | None = None
    settings: dict[str, str | int | float | bool | None] = {}


class C4ComparisonCurrentRequest(Contract):
    text: Annotated[str, Field(max_length=2000)] | None = None
    source_reference: Annotated[str, Field(max_length=100)] | None = None
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None
    target_class: str | None = None
    common_k: int = 5
    selected_lime_exp_id: UUID | None = None
    selected_shap_exp_id: UUID | None = None
    selected_lime_eval_id: UUID | None = None
    selected_shap_eval_id: UUID | None = None


class C4ComparisonCurrentResponse(Contract):
    input_reference: str
    source_hash: str | None = None
    authorized_source_text: str | None = None
    text_available: bool = False
    language: Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed", "Unknown"] = "Unknown"
    model_revision: str | None = None
    explained_class: str
    selected_lime_explanation_id: UUID | None = None
    selected_shap_explanation_id: UUID | None = None
    metrics: list[C4ComparisonMetricSummary] = []
    evidence_items: list[C4PairedEvidenceItem] = []
    available_lime_records: list[C4ComparisonCandidateRecord] = []
    available_shap_records: list[C4ComparisonCandidateRecord] = []
    selection_rules: str = "Deterministic default: latest successfully completed compatible LIME and SHAP pair for current input."
    non_diagnostic_notice: str = (
        "This page compares saved explanation-evaluation evidence. Consistency and deletion behaviour "
        "do not establish prediction correctness or clinical validity. The system supports counsellor-assisted "
        "screening review and does not replace professional counselling."
    )







