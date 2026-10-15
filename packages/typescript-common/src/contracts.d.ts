// GENERATED from authoritative Python contracts via JSON Schema. Do not edit.

export type Contracts =
  | AccountResponse
  | AssignmentRequest
  | AuditEvent
  | C2CustomDemoRequest
  | C2CustomDemoResponse
  | C2DemoCatalogue
  | C2DemoLanguageIdentification
  | C2DemoPrivacySummary
  | C2DemoQualityPolicy
  | C2DemoQualitySummary
  | C2DemoRecord
  | C2DemoRequest
  | C2DemoResponse
  | C2DemoScenario
  | ConsentDecision
  | ConsentLifecycle
  | ConsentRecord
  | ExplanationRequest
  | ExplanationResponse
  | FixturesResponse
  | HealthResponse
  | HumanReviewAction
  | InferenceRequest
  | InferenceResponse
  | LifecycleAuditEvent
  | LoginRequest
  | PreprocessRequest
  | PreprocessResponse
  | PseudonymousCase
  | RetentionAction
  | ReviewTask
  | ServiceContext
  | ServiceError
  | ServiceProvenance
  | SubmissionSession
  | VersionResponse
  | WithdrawalRequest
  | WorkflowExecution
  | WorkflowRequest;
export type AccountId = string;
export type DevelopmentOnly = true;
export type Role = "STUDENT" | "COUNSELLOR" | "ADMIN" | "RESEARCHER" | "SERVICE";
export type SchemaVersion = "1.0.0";
export type Synthetic = true;
export type CounsellorId = string;
export type DevelopmentOnly1 = true;
export type SchemaVersion1 = "1.0.0";
export type Synthetic1 = true;
export type CaseId = string | null;
export type CorrelationId = string;
export type CreatedAt = string;
export type DevelopmentOnly2 = true;
export type EventId = string;
export type EventType =
  | "AUTH_LOGIN"
  | "AUTH_FAILURE"
  | "AUTH_LOGOUT"
  | "CONSENT_RECORDED"
  | "WORKFLOW_TRANSITION"
  | "HUMAN_REVIEW"
  | "WITHDRAWAL"
  | "RETENTION"
  | "ASSIGNMENT";
export type SchemaVersion2 = "1.0.0";
export type ServiceName = "orchestrator";
export type ServiceVersion = "0.1.0";
export type Status = string;
export type Synthetic2 = true;
export type LanguageHint = "sinhala" | "english" | "romanized-si" | "code-mixed" | "unsure";
export type Strategy = "presidio";
export type Text = string;
export type BlockingReasons = string[];
export type DevelopmentOnly3 = true;
export type HumanReleaseRequired = true;
export type IndependentResearchValidation = false;
export type LanguageHint1 = "sinhala" | "english" | "romanized-si" | "code-mixed" | "unsure";
export type DevelopmentOnly4 = true;
export type Issues = string[];
export type Limitation = string;
export type PipelineStage = "release_privacy_gate";
export type PrivacyNote = string;
export type SchemaVersion3 = "1.0.0";
export type Status1 = "PASSED" | "FAILED";
export type Synthetic3 = true;
export type TotalRecords = number;
export type BlockingReasons1 = string[];
export type DataQualityGate = "PASSED" | "FAILED";
export type DevelopmentOnly5 = true;
export type DuplicateTextMeaning = string;
export type ComparisonCaseInsensitive = boolean;
export type DevelopmentOnly6 = true;
export type SchemaVersion4 = "1.0.0";
export type ShortTextReviewBelow = number;
export type Synthetic4 = true;
export type PolicyStatus = "development_only_not_research_approved";
export type PrivacyNote1 = string;
export type ReleaseReadyMeaning = string;
export type SchemaVersion5 = "1.0.0";
export type Synthetic5 = true;
export type TotalRecords1 = number;
export type AnonymizedText = string;
export type DevelopmentOnly7 = true;
export type DevelopmentOnly8 = true;
export type Language = "sinhala" | "english" | "romanized-si" | "code-mixed" | "uncertain" | "unknown";
export type Method = "c2-rule-language-v1" | "c2-rule-language-v1.1" | "c2-rule-language-v1.2";
export type Reason =
  | "no_language_letters_after_masking"
  | "sinhala_script_evidence_only"
  | "unsupported_script_evidence"
  | "sinhala_script_and_english_markers"
  | "mixed_script_without_supported_lexical_evidence"
  | "english_and_romanized_markers"
  | "multiple_romanized_markers"
  | "multiple_english_markers"
  | "insufficient_or_ambiguous_latin_evidence"
  | "explicit_romanized_name_introduction"
  | "sinhala_language_with_romanized_mixed_script_evidence";
export type SchemaVersion6 = "1.0.0";
export type Status2 = "provisional" | "uncertain" | "unknown";
export type Synthetic6 = true;
export type Uncertain = boolean;
export type NormalizationMethod = "c2-nfc-whitespace-v1" | null;
export type NormalizedText = string | null;
export type OriginalText = string;
export type QualityIssues = string[];
export type QualityStatus = "PASS" | "REVIEW" | "REJECT";
export type RecordId = string;
export type RequiresPrivacyReview = boolean;
export type SchemaVersion7 = "1.0.0";
export type Synthetic7 = true;
export type TokenOffsetUnit = "unicode_code_points" | null;
/**
 * Zero-based [start, end) Unicode code points in normalized_text; not UTF-16 units.
 */
export type TokenOffsets = [number, number][] | null;
export type TokenizationMethod = "c2-grapheme-words-v1" | null;
export type Tokens = string[] | null;
export type Transformations = string[];
export type Records = C2DemoRecord[];
export type ReleaseReady = boolean;
export type SchemaVersion8 = "1.0.0";
export type Strategy1 = "presidio";
export type Synthetic8 = true;
export type DefaultStrategy = "regex";
export type DevelopmentOnly9 = true;
export type LanguageLabelsAreFixtureMetadata = true;
export type DevelopmentOnly10 = true;
export type Label = string;
export type LanguageLabel = "english" | "sinhala" | "romanized-si" | "code-mixed" | "not-applicable";
export type RecordCount = number;
export type ScenarioId =
  | "english-person"
  | "sinhala-person"
  | "romanized-person"
  | "code-mixed-person"
  | "english-ordinary"
  | "english"
  | "sinhala"
  | "romanized"
  | "code-mixed"
  | "short"
  | "empty"
  | "placeholder-only"
  | "duplicate"
  | "masking-collision"
  | "empty-batch";
export type SchemaVersion9 = "1.0.0";
export type Synthetic9 = true;
export type Scenarios = C2DemoScenario[];
export type SchemaVersion10 = "1.0.0";
export type Strategies = ("regex" | "presidio" | "hybrid")[];
export type Synthetic10 = true;
export type ScenarioId1 =
  | "english-person"
  | "sinhala-person"
  | "romanized-person"
  | "code-mixed-person"
  | "english-ordinary"
  | "english"
  | "sinhala"
  | "romanized"
  | "code-mixed"
  | "short"
  | "empty"
  | "placeholder-only"
  | "duplicate"
  | "masking-collision"
  | "empty-batch";
export type Strategy2 = "regex" | "presidio" | "hybrid";
export type BlockingReasons2 = string[];
export type DevelopmentOnly11 = true;
export type HumanReleaseRequired1 = true;
export type IndependentResearchValidation1 = false;
export type Records1 = C2DemoRecord[];
export type ReleaseReady1 = boolean;
export type ReleaseReadyMeaning1 = "Automated prerequisites only; human release approval remains required.";
export type SchemaVersion11 = "1.0.0";
export type Strategy3 = "regex" | "presidio" | "hybrid";
export type Synthetic11 = true;
export type ConsentStatus = "ACTIVE" | "REJECTED";
export type ConsentVersion = "dev-notice-1";
export type DevelopmentOnly12 = true;
export type Purpose = "synthetic-wellbeing-screening";
export type SchemaVersion12 = "1.0.0";
export type Synthetic12 = true;
export type CaseId1 = string;
export type CorrelationId1 = string;
export type CreatedAt1 = string;
export type DevelopmentOnly13 = true;
export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONSENT_REQUIRED"
  | "CONSENT_INVALID"
  | "CONTRACT_INVALID"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "DEPENDENCY_UNAVAILABLE"
  | "DOWNSTREAM_FAILED"
  | "DOWNSTREAM_TIMEOUT"
  | "RETRY_EXHAUSTED"
  | "INTERNAL_ERROR";
export type WorkflowState =
  | "RECEIVED"
  | "CONSENT_VERIFIED"
  | "PREPROCESSING"
  | "INFERENCE"
  | "EXPLANATION"
  | "READY_FOR_REVIEW"
  | "UNDER_REVIEW"
  | "COMPLETED"
  | "FAILED"
  | "WITHDRAWAL_REQUESTED"
  | "WITHDRAWN";
export type SchemaVersion13 = "1.0.0";
export type Synthetic13 = true;
export type UpdatedAt = string;
export type ConsentId = string;
export type ConsentState = "PENDING" | "ACTIVE" | "EXPIRED" | "WITHDRAWN" | "REJECTED" | "INVALID";
export type ConsentVersion1 = string;
export type CreatedAt2 = string;
export type DevelopmentOnly14 = true;
export type ExpiresAt = string;
export type Purpose1 = string;
export type SchemaVersion14 = "1.0.0";
export type Synthetic14 = true;
export type DevelopmentOnly15 = true;
export type DisposalReason = ("RETENTION" | "OWNER_WITHDRAWAL" | "LEGACY_DISPOSAL") | null;
export type ExplicitlyWithdrawnAt = string | null;
export type SchemaVersion15 = "1.0.0";
export type Synthetic15 = true;
export type CaseId2 = string;
export type ConsentStatus1 = "ACTIVE";
export type ConsentVersion2 = "dev-notice-1";
export type CorrelationId2 = string;
export type DevelopmentOnly16 = true;
export type IdempotencyKey = string;
export type Calibrated = false;
export type CaseId3 = string;
export type Confidence = number;
export type ConsentStatus2 = "ACTIVE";
export type ConsentVersion3 = "dev-notice-1";
export type CorrelationId3 = string;
export type DatasetVersion = "synthetic-fixtures-1";
export type DevelopmentOnly17 = true;
export type EmotionalTone = "synthetic-neutral";
export type IdempotencyKey1 = string;
export type ModelVersion = "mock-1";
export type Purpose2 = "synthetic-wellbeing-screening";
export type ReviewPriority = "HUMAN_REVIEW_REQUIRED";
export type SchemaVersion16 = "1.0.0";
export type ServiceName1 = "nlp";
export type ServiceVersion1 = "0.1.0";
export type StressLanguageSignals = "synthetic-busy-timetable"[];
export type Synthetic16 = true;
export type WellbeingIndicator = "synthetic-academic-pressure";
export type AnonymizedText1 = string;
export type CaseId4 = string;
export type ConsentStatus3 = "ACTIVE";
export type ConsentVersion4 = "dev-notice-1";
export type CorrelationId4 = string;
export type DatasetVersion1 = "synthetic-fixtures-1";
export type DevelopmentOnly18 = true;
export type IdempotencyKey2 = string;
export type Language1 = "en" | "si" | "romanized-si" | "mixed" | "uncertain";
export type NormalizedText1 = string;
export type PipelineVersion = "mock-1";
export type Purpose3 = "synthetic-wellbeing-screening";
export type SchemaVersion17 = "1.0.0";
export type ServiceName2 = "preprocessing";
export type ServiceVersion2 = "0.1.0";
export type Synthetic17 = true;
export type TokenOffsets1 = [unknown, unknown][];
export type Tokens1 = string[];
export type Transformations1 = string[];
export type Purpose4 = "synthetic-wellbeing-screening";
export type SchemaVersion18 = "1.0.0";
export type Synthetic18 = true;
export type CaseId5 = string;
export type ConsentStatus4 = "ACTIVE";
export type ConsentVersion5 = "dev-notice-1";
export type CorrelationId5 = string;
export type Counterfactual = null;
export type DevelopmentOnly19 = true;
export type Evidence = string[];
export type ExplainerVersion = "mock-1";
export type Faithfulness = null;
export type IdempotencyKey3 = string;
export type Method1 = "MOCK_FIXED_FIXTURE";
export type Purpose5 = "synthetic-wellbeing-screening";
export type ReliabilityStatus = "NOT_EVALUATED";
export type SchemaVersion19 = "1.0.0";
export type ServiceName3 = "xai";
export type ServiceVersion3 = "0.1.0";
export type Stability = null;
export type Synthetic19 = true;
export type DevelopmentOnly20 = true;
export type SchemaVersion20 = "1.0.0";
export type Synthetic20 = true;
export type DevelopmentOnly21 = true;
export type SchemaVersion21 = "1.0.0";
export type ServiceName4 = string;
export type Status3 = "ok" | "unavailable";
export type Synthetic21 = true;
export type Action = "START_REVIEW" | "COMPLETE_REVIEW";
export type DevelopmentOnly22 = true;
export type IdempotencyKey4 = string;
export type SchemaVersion22 = "1.0.0";
export type Synthetic22 = true;
export type CaseId6 = string;
export type ConsentStatus5 = "ACTIVE";
export type ConsentVersion6 = "dev-notice-1";
export type CorrelationId6 = string;
export type DevelopmentOnly23 = true;
export type IdempotencyKey5 = string;
export type Purpose6 = "synthetic-wellbeing-screening";
export type SchemaVersion23 = "1.0.0";
export type Synthetic23 = true;
export type CaseId7 = string | null;
export type CorrelationId7 = string;
export type CreatedAt3 = string;
export type DevelopmentOnly24 = true;
export type EventId1 = string;
export type EventType1 =
  | "AUTH_LOGIN"
  | "AUTH_FAILURE"
  | "AUTH_LOGOUT"
  | "AUTH_REFRESH"
  | "SESSION_REVOKED"
  | "CONSENT_RECORDED"
  | "CONSENT_EXPIRED"
  | "OPERATION_BLOCKED"
  | "SUBMISSION"
  | "SUBMISSION_REPLAY"
  | "WORKFLOW_TRANSITION"
  | "JOB_RETRY"
  | "JOB_TERMINAL"
  | "JOB_CLAIM"
  | "HUMAN_REVIEW"
  | "WITHDRAWAL"
  | "RETENTION"
  | "ASSIGNMENT";
export type PolicyExpiresAt = string | null;
export type SchemaVersion24 = "1.0.0";
export type ServiceName5 = "orchestrator";
export type ServiceVersion4 = "0.1.0";
export type Status4 = string;
export type Synthetic24 = true;
export type TraceId = string | null;
export type DevelopmentOnly25 = true;
export type Password = string;
export type SchemaVersion25 = "1.0.0";
export type Synthetic25 = true;
export type Username = string;
export type CaseId8 = string;
export type ConsentStatus6 = "ACTIVE";
export type ConsentVersion7 = "dev-notice-1";
export type CorrelationId8 = string;
export type DevelopmentOnly26 = true;
export type IdempotencyKey6 = string;
export type Purpose7 = "synthetic-wellbeing-screening";
export type SchemaVersion26 = "1.0.0";
export type Synthetic26 = true;
export type Text1 = string;
export type Action1 = "DELETE_DERIVED_EVIDENCE" | "EXPIRE_ACCESS";
export type ActionId = string;
export type CaseId9 = string;
export type CreatedAt4 = string;
export type DevelopmentOnly27 = true;
export type SchemaVersion27 = "1.0.0";
export type Status5 = "PENDING" | "COMPLETED" | "FAILED";
export type Synthetic27 = true;
export type DevelopmentOnly28 = true;
export type HumanReviewRequired = true;
export type SchemaVersion28 = "1.0.0";
export type Synthetic28 = true;
export type TaskId = string;
export type CaseId10 = string;
export type ConsentStatus7 = "ACTIVE";
export type ConsentVersion8 = "dev-notice-1";
export type CorrelationId9 = string;
export type DevelopmentOnly29 = true;
export type IdempotencyKey7 = string;
export type Purpose8 = "synthetic-wellbeing-screening";
export type SchemaVersion29 = "1.0.0";
export type Synthetic29 = true;
export type CorrelationId10 = string;
export type DevelopmentOnly30 = true;
export type Message = "Request could not be completed safely.";
export type SchemaVersion30 = "1.0.0";
export type Synthetic30 = true;
export type CorrelationId11 = string;
export type DevelopmentOnly31 = true;
export type ExplainerVersion1 = "mock-1";
export type ModelDatasetVersion = "synthetic-fixtures-1";
export type ModelVersion1 = "mock-1";
export type NlpServiceVersion = "0.1.0";
export type PipelineVersion1 = "mock-1";
export type PreprocessingDatasetVersion = "synthetic-fixtures-1";
export type PreprocessingServiceVersion = "0.1.0";
export type SchemaVersion31 = "1.0.0";
export type Synthetic31 = true;
export type XaiServiceVersion = "0.1.0";
export type DevelopmentOnly32 = true;
export type ExpiresAt1 = string;
export type SchemaVersion32 = "1.0.0";
export type SessionId = string;
export type Synthetic32 = true;
export type DevelopmentOnly33 = true;
export type Mode = "MOCK_SYNTHETIC_DEVELOPMENT_ONLY" | "SYNTHETIC_DEVELOPMENT_ONLY";
export type SchemaVersion33 = "1.0.0";
export type ServiceName6 = string;
export type ServiceVersion5 = "0.1.0";
export type Synthetic33 = true;
export type DevelopmentOnly34 = true;
export type IdempotencyKey8 = string;
export type SchemaVersion34 = "1.0.0";
export type Synthetic34 = true;
export type Attempts = number;
export type CaseId11 = string;
export type CorrelationId12 = string;
export type CreatedAt5 = string;
export type DevelopmentOnly35 = true;
export type IdempotencyKey9 = string;
export type SchemaVersion35 = "1.0.0";
export type Synthetic35 = true;
export type UpdatedAt1 = string;
export type ConsentId1 = string;
export type DevelopmentOnly36 = true;
export type FixtureId = "english" | "sinhala" | "romanized" | "mixed";
export type IdempotencyKey10 = string;
export type SchemaVersion36 = "1.0.0";
export type Synthetic36 = true;
export type Text2 = string;

export interface AccountResponse {
  account_id: AccountId;
  development_only?: DevelopmentOnly;
  role: Role;
  schema_version?: SchemaVersion;
  synthetic?: Synthetic;
}
export interface AssignmentRequest {
  counsellor_id: CounsellorId;
  development_only?: DevelopmentOnly1;
  schema_version?: SchemaVersion1;
  synthetic?: Synthetic1;
}
export interface AuditEvent {
  case_id?: CaseId;
  correlation_id: CorrelationId;
  created_at?: CreatedAt;
  development_only?: DevelopmentOnly2;
  event_id?: EventId;
  event_type: EventType;
  schema_version?: SchemaVersion2;
  service_name?: ServiceName;
  service_version?: ServiceVersion;
  status: Status;
  synthetic?: Synthetic2;
}
/**
 * Ephemeral input; optional legacy hint never configures detection.
 */
export interface C2CustomDemoRequest {
  language_hint?: LanguageHint;
  strategy?: Strategy;
  text: Text;
}
export interface C2CustomDemoResponse {
  blocking_reasons: BlockingReasons;
  development_only?: DevelopmentOnly3;
  human_release_required?: HumanReleaseRequired;
  independent_research_validation?: IndependentResearchValidation;
  language_hint: LanguageHint1;
  privacy_summary: C2DemoPrivacySummary;
  quality_summary: C2DemoQualitySummary;
  records: Records;
  release_ready: ReleaseReady;
  schema_version?: SchemaVersion8;
  strategy?: Strategy1;
  synthetic?: Synthetic8;
}
export interface C2DemoPrivacySummary {
  development_only?: DevelopmentOnly4;
  issue_counts: IssueCounts;
  issues: Issues;
  limitation: Limitation;
  pipeline_stage: PipelineStage;
  privacy_note: PrivacyNote;
  schema_version?: SchemaVersion3;
  status: Status1;
  synthetic?: Synthetic3;
  total_records: TotalRecords;
}
export interface IssueCounts {
  [k: string]: number;
}
export interface C2DemoQualitySummary {
  blocking_reasons: BlockingReasons1;
  data_quality_gate: DataQualityGate;
  development_only?: DevelopmentOnly5;
  duplicate_text_meaning: DuplicateTextMeaning;
  issue_counts: IssueCounts1;
  policy: C2DemoQualityPolicy;
  policy_status: PolicyStatus;
  privacy_note: PrivacyNote1;
  release_ready_meaning: ReleaseReadyMeaning;
  schema_version?: SchemaVersion5;
  status_counts: StatusCounts;
  synthetic?: Synthetic5;
  total_records: TotalRecords1;
}
export interface IssueCounts1 {
  [k: string]: number;
}
export interface C2DemoQualityPolicy {
  comparison_case_insensitive: ComparisonCaseInsensitive;
  development_only?: DevelopmentOnly6;
  schema_version?: SchemaVersion4;
  short_text_review_below: ShortTextReviewBelow;
  synthetic?: Synthetic4;
}
export interface StatusCounts {
  [k: string]: number;
}
export interface C2DemoRecord {
  anonymized_text: AnonymizedText;
  development_only?: DevelopmentOnly7;
  language_identification?: C2DemoLanguageIdentification | null;
  normalization_method?: NormalizationMethod;
  normalized_text?: NormalizedText;
  original_text: OriginalText;
  quality_issues: QualityIssues;
  quality_status: QualityStatus;
  record_id: RecordId;
  requires_privacy_review: RequiresPrivacyReview;
  schema_version?: SchemaVersion7;
  synthetic?: Synthetic7;
  token_offset_unit?: TokenOffsetUnit;
  token_offsets?: TokenOffsets;
  tokenization_method?: TokenizationMethod;
  tokens?: Tokens;
  transformations: Transformations;
}
/**
 * Provisional deterministic evidence, not anonymizer configuration.
 */
export interface C2DemoLanguageIdentification {
  development_only?: DevelopmentOnly8;
  language: Language;
  method?: Method;
  reason: Reason;
  schema_version?: SchemaVersion6;
  status: Status2;
  synthetic?: Synthetic6;
  uncertain: Uncertain;
}
export interface C2DemoCatalogue {
  default_strategy?: DefaultStrategy;
  development_only?: DevelopmentOnly9;
  language_labels_are_fixture_metadata?: LanguageLabelsAreFixtureMetadata;
  scenarios: Scenarios;
  schema_version?: SchemaVersion10;
  strategies: Strategies;
  synthetic?: Synthetic10;
}
export interface C2DemoScenario {
  development_only?: DevelopmentOnly10;
  label: Label;
  language_label: LanguageLabel;
  record_count: RecordCount;
  scenario_id: ScenarioId;
  schema_version?: SchemaVersion9;
  synthetic?: Synthetic9;
}
/**
 * Browser input contains selectors only; no contract flags or text.
 */
export interface C2DemoRequest {
  scenario_id: ScenarioId1;
  strategy?: Strategy2;
}
export interface C2DemoResponse {
  blocking_reasons: BlockingReasons2;
  development_only?: DevelopmentOnly11;
  human_release_required?: HumanReleaseRequired1;
  independent_research_validation?: IndependentResearchValidation1;
  privacy_summary: C2DemoPrivacySummary;
  quality_summary: C2DemoQualitySummary;
  records: Records1;
  release_ready: ReleaseReady1;
  release_ready_meaning?: ReleaseReadyMeaning1;
  scenario: C2DemoScenario;
  schema_version?: SchemaVersion11;
  strategy: Strategy3;
  synthetic?: Synthetic11;
}
export interface ConsentDecision {
  consent_status: ConsentStatus;
  consent_version?: ConsentVersion;
  development_only?: DevelopmentOnly12;
  purpose?: Purpose;
  schema_version?: SchemaVersion12;
  synthetic?: Synthetic12;
}
export interface ConsentLifecycle {
  case?: PseudonymousCase | null;
  consent: ConsentRecord;
  development_only?: DevelopmentOnly15;
  disposal_reason?: DisposalReason;
  explicitly_withdrawn_at?: ExplicitlyWithdrawnAt;
  schema_version?: SchemaVersion15;
  synthetic?: Synthetic15;
}
export interface PseudonymousCase {
  case_id: CaseId1;
  correlation_id: CorrelationId1;
  created_at: CreatedAt1;
  development_only?: DevelopmentOnly13;
  error_code?: ErrorCode | null;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion13;
  synthetic?: Synthetic13;
  updated_at: UpdatedAt;
}
export interface ConsentRecord {
  consent_id: ConsentId;
  consent_status: ConsentState;
  consent_version: ConsentVersion1;
  created_at: CreatedAt2;
  development_only?: DevelopmentOnly14;
  expires_at: ExpiresAt;
  purpose: Purpose1;
  schema_version?: SchemaVersion14;
  synthetic?: Synthetic14;
}
export interface ExplanationRequest {
  case_id: CaseId2;
  consent_status?: ConsentStatus1;
  consent_version?: ConsentVersion2;
  correlation_id: CorrelationId2;
  development_only?: DevelopmentOnly16;
  idempotency_key: IdempotencyKey;
  inference: InferenceResponse;
  preprocessing: PreprocessResponse;
  purpose?: Purpose4;
  schema_version?: SchemaVersion18;
  synthetic?: Synthetic18;
}
export interface InferenceResponse {
  calibrated?: Calibrated;
  case_id: CaseId3;
  confidence: Confidence;
  consent_status?: ConsentStatus2;
  consent_version?: ConsentVersion3;
  correlation_id: CorrelationId3;
  dataset_version?: DatasetVersion;
  development_only?: DevelopmentOnly17;
  emotional_tone?: EmotionalTone;
  idempotency_key: IdempotencyKey1;
  model_version?: ModelVersion;
  purpose?: Purpose2;
  review_priority?: ReviewPriority;
  schema_version?: SchemaVersion16;
  service_name?: ServiceName1;
  service_version?: ServiceVersion1;
  stress_language_signals: StressLanguageSignals;
  synthetic?: Synthetic16;
  wellbeing_indicator?: WellbeingIndicator;
}
export interface PreprocessResponse {
  anonymized_text: AnonymizedText1;
  case_id: CaseId4;
  consent_status?: ConsentStatus3;
  consent_version?: ConsentVersion4;
  correlation_id: CorrelationId4;
  dataset_version?: DatasetVersion1;
  development_only?: DevelopmentOnly18;
  idempotency_key: IdempotencyKey2;
  language: Language1;
  normalized_text: NormalizedText1;
  pipeline_version?: PipelineVersion;
  purpose?: Purpose3;
  schema_version?: SchemaVersion17;
  service_name?: ServiceName2;
  service_version?: ServiceVersion2;
  synthetic?: Synthetic17;
  token_offsets: TokenOffsets1;
  tokens: Tokens1;
  transformations: Transformations1;
}
export interface ExplanationResponse {
  case_id: CaseId5;
  consent_status?: ConsentStatus4;
  consent_version?: ConsentVersion5;
  correlation_id: CorrelationId5;
  counterfactual?: Counterfactual;
  development_only?: DevelopmentOnly19;
  evidence: Evidence;
  explainer_version?: ExplainerVersion;
  faithfulness?: Faithfulness;
  idempotency_key: IdempotencyKey3;
  method?: Method1;
  purpose?: Purpose5;
  reliability_status?: ReliabilityStatus;
  schema_version?: SchemaVersion19;
  service_name?: ServiceName3;
  service_version?: ServiceVersion3;
  stability?: Stability;
  synthetic?: Synthetic19;
}
export interface FixturesResponse {
  development_only?: DevelopmentOnly20;
  fixtures: Fixtures;
  schema_version?: SchemaVersion20;
  synthetic?: Synthetic20;
}
export interface Fixtures {
  [k: string]: string;
}
export interface HealthResponse {
  development_only?: DevelopmentOnly21;
  schema_version?: SchemaVersion21;
  service_name: ServiceName4;
  status: Status3;
  synthetic?: Synthetic21;
}
export interface HumanReviewAction {
  action: Action;
  development_only?: DevelopmentOnly22;
  idempotency_key: IdempotencyKey4;
  schema_version?: SchemaVersion22;
  synthetic?: Synthetic22;
}
export interface InferenceRequest {
  case_id: CaseId6;
  consent_status?: ConsentStatus5;
  consent_version?: ConsentVersion6;
  correlation_id: CorrelationId6;
  development_only?: DevelopmentOnly23;
  idempotency_key: IdempotencyKey5;
  preprocessing: PreprocessResponse;
  purpose?: Purpose6;
  schema_version?: SchemaVersion23;
  synthetic?: Synthetic23;
}
export interface LifecycleAuditEvent {
  case_id?: CaseId7;
  correlation_id: CorrelationId7;
  created_at?: CreatedAt3;
  development_only?: DevelopmentOnly24;
  event_id?: EventId1;
  event_type: EventType1;
  policy_expires_at?: PolicyExpiresAt;
  schema_version?: SchemaVersion24;
  service_name?: ServiceName5;
  service_version?: ServiceVersion4;
  status: Status4;
  synthetic?: Synthetic24;
  trace_id?: TraceId;
}
export interface LoginRequest {
  development_only?: DevelopmentOnly25;
  password: Password;
  schema_version?: SchemaVersion25;
  synthetic?: Synthetic25;
  username: Username;
}
export interface PreprocessRequest {
  case_id: CaseId8;
  consent_status?: ConsentStatus6;
  consent_version?: ConsentVersion7;
  correlation_id: CorrelationId8;
  development_only?: DevelopmentOnly26;
  idempotency_key: IdempotencyKey6;
  purpose?: Purpose7;
  schema_version?: SchemaVersion26;
  synthetic?: Synthetic26;
  text: Text1;
}
export interface RetentionAction {
  action: Action1;
  action_id: ActionId;
  case_id: CaseId9;
  created_at: CreatedAt4;
  development_only?: DevelopmentOnly27;
  schema_version?: SchemaVersion27;
  status: Status5;
  synthetic?: Synthetic27;
}
export interface ReviewTask {
  case: PseudonymousCase;
  development_only?: DevelopmentOnly28;
  explanation: ExplanationResponse;
  human_review_required?: HumanReviewRequired;
  inference: InferenceResponse;
  schema_version?: SchemaVersion28;
  synthetic?: Synthetic28;
  task_id: TaskId;
}
export interface ServiceContext {
  case_id: CaseId10;
  consent_status?: ConsentStatus7;
  consent_version?: ConsentVersion8;
  correlation_id: CorrelationId9;
  development_only?: DevelopmentOnly29;
  idempotency_key: IdempotencyKey7;
  purpose?: Purpose8;
  schema_version?: SchemaVersion29;
  synthetic?: Synthetic29;
}
export interface ServiceError {
  correlation_id: CorrelationId10;
  development_only?: DevelopmentOnly30;
  error_code: ErrorCode;
  message?: Message;
  schema_version?: SchemaVersion30;
  synthetic?: Synthetic30;
}
export interface ServiceProvenance {
  correlation_id: CorrelationId11;
  development_only?: DevelopmentOnly31;
  explainer_version: ExplainerVersion1;
  model_dataset_version: ModelDatasetVersion;
  model_version: ModelVersion1;
  nlp_service_version: NlpServiceVersion;
  pipeline_version: PipelineVersion1;
  preprocessing_dataset_version: PreprocessingDatasetVersion;
  preprocessing_service_version: PreprocessingServiceVersion;
  schema_version?: SchemaVersion31;
  synthetic?: Synthetic31;
  xai_service_version: XaiServiceVersion;
}
export interface SubmissionSession {
  development_only?: DevelopmentOnly32;
  expires_at: ExpiresAt1;
  role: Role;
  schema_version?: SchemaVersion32;
  session_id: SessionId;
  synthetic?: Synthetic32;
}
export interface VersionResponse {
  development_only?: DevelopmentOnly33;
  mode: Mode;
  schema_version?: SchemaVersion33;
  service_name: ServiceName6;
  service_version?: ServiceVersion5;
  synthetic?: Synthetic33;
}
export interface WithdrawalRequest {
  development_only?: DevelopmentOnly34;
  idempotency_key: IdempotencyKey8;
  schema_version?: SchemaVersion34;
  synthetic?: Synthetic34;
}
export interface WorkflowExecution {
  attempts?: Attempts;
  case_id: CaseId11;
  correlation_id: CorrelationId12;
  created_at: CreatedAt5;
  development_only?: DevelopmentOnly35;
  error_code?: ErrorCode | null;
  idempotency_key: IdempotencyKey9;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion35;
  synthetic?: Synthetic35;
  updated_at: UpdatedAt1;
}
export interface WorkflowRequest {
  consent_id: ConsentId1;
  development_only?: DevelopmentOnly36;
  fixture_id: FixtureId;
  idempotency_key: IdempotencyKey10;
  schema_version?: SchemaVersion36;
  synthetic?: Synthetic36;
  text: Text2;
}
