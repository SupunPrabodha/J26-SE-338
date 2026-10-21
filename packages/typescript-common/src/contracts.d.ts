// GENERATED from authoritative Python contracts via JSON Schema. Do not edit.

export type Contracts =
  | AccountResponse
  | AssignmentRequest
  | AuditEvent
  | C4CounterfactualListResponse
  | C4CounterfactualRequest
  | C4CounterfactualResponse
  | C4CounterfactualSummary
  | C4EncoderCheckRequest
  | C4EncoderCheckResponse
  | C4ExplanationListResponse
  | C4ExplanationRequest
  | C4ExplanationResponse
  | C4ExplanationSummary
  | C4PredictionRequest
  | C4PredictionResponse
  | ConsentDecision
  | ConsentLifecycle
  | ConsentRecord
  | CounterfactualCandidate
  | EditOperation
  | ExplanationRequest
  | ExplanationResponse
  | FeatureContribution
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
  | TextSpanDiff
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
export type DevelopmentOnly3 = true;
export type BestEditCount = number | null;
export type CandidateCount = number;
export type CounterfactualId = string;
export type CreatedAt1 = string;
export type DevelopmentOnly4 = true;
export type IsDevelopment = boolean;
export type OriginalPredictedClass = string | null;
export type Outcome = string;
export type SchemaVersion3 = "1.0.0";
export type SourceReference = string | null;
export type Synthetic3 = true;
export type TargetClass = string;
export type Items = C4CounterfactualSummary[];
export type Limit = number;
export type Offset = number;
export type SchemaVersion4 = "1.0.0";
export type Synthetic4 = true;
export type Total = number;
export type DevelopmentOnly5 = true;
export type IdempotencyKey = string | null;
export type Language = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type MaxCandidates = number;
export type MaxEdits = number;
export type SchemaVersion5 = "1.0.0";
export type SourceReference1 = string | null;
export type Synthetic5 = true;
export type TargetClass1 = "Negative" | "Neutral" | "Positive";
export type Text = string;
export type CandidateText = string | null;
export type DevelopmentOnly6 = true;
export type DevelopmentOnly7 = true;
export type OriginalText = string | null;
export type SchemaVersion6 = "1.0.0";
export type Synthetic6 = true;
export type Text1 = string;
export type Type = "unchanged" | "deleted" | "inserted" | "replaced";
export type DiffSpans = TextSpanDiff[];
export type EditCount = number;
export type DevelopmentOnly8 = true;
export type Index = number;
export type Op = "delete" | "replace" | "insert";
export type Original = string | null;
export type Replacement = string | null;
export type SchemaVersion7 = "1.0.0";
export type Synthetic7 = true;
export type Edits = EditOperation[];
export type MinimalityDescription = string;
export type MinimalityRank = number;
export type PredictedClass = string;
export type SchemaVersion8 = "1.0.0";
export type Synthetic8 = true;
export type TargetProbability = number;
export type TargetProbabilityDelta = number;
export type Verified = boolean;
export type Candidates = CounterfactualCandidate[];
export type CounterfactualId1 = string | null;
export type CreatedAt2 = string | null;
export type DevelopmentOnly9 = true;
export type ExecutionTimeMs = number | null;
export type IsDevelopment1 = boolean;
export type ModelId = string | null;
export type ModelRevision = string | null;
export type ModelVersion = string | null;
export type NonDiagnosticNotice = string;
export type OriginalPredictedClass1 = string | null;
export type Outcome1 =
  | "SUCCESS"
  | "NO_COUNTERFACTUAL_FOUND"
  | "ALREADY_TARGET_CLASS"
  | "SEARCH_LIMIT_EXCEEDED"
  | "TIMEOUT"
  | "UNAVAILABLE_MODEL";
export type OutcomeMessage = string;
export type SchemaVersion9 = "1.0.0";
export type SourceReference2 = string | null;
export type SupportedLanguages = string[];
export type Synthetic9 = true;
export type TargetClass2 = string;
export type DevelopmentOnly10 = true;
export type Language1 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type SchemaVersion10 = "1.0.0";
export type Synthetic10 = true;
export type Text2 = string;
export type DevelopmentOnly11 = true;
export type EmbeddingShape = number[];
export type EncoderExecuted = true;
export type HiddenDimension = number;
export type ModelId1 = "FacebookAI/xlm-roberta-base";
export type SchemaVersion11 = "1.0.0";
export type StatusMessage = "Base encoder connected — wellbeing classification unavailable.";
export type Synthetic11 = true;
export type TokenCount = number;
export type Truncated = boolean;
export type DevelopmentOnly12 = true;
export type CreatedAt3 = string;
export type DevelopmentOnly13 = true;
export type ExplanationId = string;
export type IsDevelopment2 = boolean;
export type Method = "LIME" | "SHAP";
export type PredictedClass1 = string | null;
export type SchemaVersion12 = "1.0.0";
export type SourceReference3 = string | null;
export type Synthetic12 = true;
export type TargetClass3 = string;
export type TargetClassProbability = number | null;
export type Items1 = C4ExplanationSummary[];
export type Limit1 = number;
export type Offset1 = number;
export type SchemaVersion13 = "1.0.0";
export type Synthetic13 = true;
export type Total1 = number;
export type DevelopmentOnly14 = true;
export type IdempotencyKey1 = string | null;
export type Language2 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type Method1 = "LIME" | "SHAP";
export type SchemaVersion14 = "1.0.0";
export type SourceReference4 = string | null;
export type Synthetic14 = true;
export type TargetClass4 = string | null;
export type Text3 = string;
export type AdditivityDiscrepancyMessage = string | null;
export type AdditivityResidual = number | null;
export type AdditivityWithinTolerance = boolean | null;
export type BaseValue = number | null;
export type AbsWeight = number;
export type DevelopmentOnly15 = true;
export type Direction = "supports" | "opposes";
export type SchemaVersion15 = "1.0.0";
export type Synthetic15 = true;
export type Token = string;
export type Weight = number;
export type Contributions = FeatureContribution[];
export type CreatedAt4 = string | null;
export type DevelopmentOnly16 = true;
export type ExplanationId1 = string | null;
export type IsDevelopment3 = boolean;
export type Method2 = "LIME" | "SHAP";
export type ModelId2 = string | null;
export type ModelRevision1 = string | null;
export type ModelVersion1 = string | null;
export type OutputValue = number | null;
export type PredictedClass2 = string | null;
export type ReconstructedOutput = number | null;
export type SchemaVersion16 = "1.0.0";
export type SourceReference5 = string | null;
export type Status1 = "READY" | "AWAITING_CLASSIFIER_CONNECTION" | "UNAVAILABLE";
export type StatusMessage1 = string;
export type Synthetic16 = true;
export type TargetClass5 = string | null;
export type TargetClassProbability1 = number | null;
export type TokenCount1 = number | null;
export type Tokens = string[];
export type Truncated1 = boolean | null;
export type Weights = number[];
export type DevelopmentOnly17 = true;
export type Language3 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type SchemaVersion17 = "1.0.0";
export type Synthetic17 = true;
export type Text4 = string;
export type Confidence = number;
export type DevelopmentOnly18 = true;
export type MaxSequenceLength = number;
export type ModelId3 = string;
export type ModelRevision2 = string | null;
export type ModelVersion2 = string;
export type PredictedSentiment = "Negative" | "Neutral" | "Positive";
export type SchemaVersion18 = "1.0.0";
export type Status2 = "READY" | "FAILED";
export type StatusMessage2 = string;
export type Synthetic18 = true;
export type TokenCount2 = number;
export type Truncated2 = boolean;
export type ConsentStatus = "ACTIVE" | "REJECTED";
export type ConsentVersion = "dev-notice-1";
export type DevelopmentOnly19 = true;
export type Purpose = "synthetic-wellbeing-screening";
export type SchemaVersion19 = "1.0.0";
export type Synthetic19 = true;
export type CaseId1 = string;
export type CorrelationId1 = string;
export type CreatedAt5 = string;
export type DevelopmentOnly20 = true;
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
export type SchemaVersion20 = "1.0.0";
export type Synthetic20 = true;
export type UpdatedAt = string;
export type ConsentId = string;
export type ConsentState = "PENDING" | "ACTIVE" | "EXPIRED" | "WITHDRAWN" | "REJECTED" | "INVALID";
export type ConsentVersion1 = string;
export type CreatedAt6 = string;
export type DevelopmentOnly21 = true;
export type ExpiresAt = string;
export type Purpose1 = string;
export type SchemaVersion21 = "1.0.0";
export type Synthetic21 = true;
export type DevelopmentOnly22 = true;
export type DisposalReason = ("RETENTION" | "OWNER_WITHDRAWAL" | "LEGACY_DISPOSAL") | null;
export type ExplicitlyWithdrawnAt = string | null;
export type SchemaVersion22 = "1.0.0";
export type Synthetic22 = true;
export type CaseId2 = string;
export type ConsentStatus1 = "ACTIVE";
export type ConsentVersion2 = "dev-notice-1";
export type CorrelationId2 = string;
export type DevelopmentOnly23 = true;
export type IdempotencyKey2 = string;
export type Calibrated = false;
export type CaseId3 = string;
export type Confidence1 = number;
export type ConsentStatus2 = "ACTIVE";
export type ConsentVersion3 = "dev-notice-1";
export type CorrelationId3 = string;
export type DatasetVersion = "synthetic-fixtures-1";
export type DevelopmentOnly24 = true;
export type EmotionalTone = "synthetic-neutral";
export type IdempotencyKey3 = string;
export type ModelVersion3 = "mock-1";
export type Purpose2 = "synthetic-wellbeing-screening";
export type ReviewPriority = "HUMAN_REVIEW_REQUIRED";
export type SchemaVersion23 = "1.0.0";
export type ServiceName1 = "nlp";
export type ServiceVersion1 = "0.1.0";
export type StressLanguageSignals = "synthetic-busy-timetable"[];
export type Synthetic23 = true;
export type WellbeingIndicator = "synthetic-academic-pressure";
export type AnonymizedText = string;
export type CaseId4 = string;
export type ConsentStatus3 = "ACTIVE";
export type ConsentVersion4 = "dev-notice-1";
export type CorrelationId4 = string;
export type DatasetVersion1 = "synthetic-fixtures-1";
export type DevelopmentOnly25 = true;
export type IdempotencyKey4 = string;
export type Language4 = "en" | "si" | "romanized-si" | "mixed" | "uncertain";
export type NormalizedText = string;
export type PipelineVersion = "mock-1";
export type Purpose3 = "synthetic-wellbeing-screening";
export type SchemaVersion24 = "1.0.0";
export type ServiceName2 = "preprocessing";
export type ServiceVersion2 = "0.1.0";
export type Synthetic24 = true;
export type TokenOffsets = [unknown, unknown][];
export type Tokens1 = string[];
export type Transformations = string[];
export type Purpose4 = "synthetic-wellbeing-screening";
export type SchemaVersion25 = "1.0.0";
export type Synthetic25 = true;
export type CaseId5 = string;
export type ConsentStatus4 = "ACTIVE";
export type ConsentVersion5 = "dev-notice-1";
export type CorrelationId5 = string;
export type Counterfactual = null;
export type DevelopmentOnly26 = true;
export type Evidence = string[];
export type ExplainerVersion = "mock-1";
export type Faithfulness = null;
export type IdempotencyKey5 = string;
export type Method3 = "MOCK_FIXED_FIXTURE";
export type Purpose5 = "synthetic-wellbeing-screening";
export type ReliabilityStatus = "NOT_EVALUATED";
export type SchemaVersion26 = "1.0.0";
export type ServiceName3 = "xai";
export type ServiceVersion3 = "0.1.0";
export type Stability = null;
export type Synthetic26 = true;
export type DevelopmentOnly27 = true;
export type SchemaVersion27 = "1.0.0";
export type Synthetic27 = true;
export type DevelopmentOnly28 = true;
export type SchemaVersion28 = "1.0.0";
export type ServiceName4 = string;
export type Status3 = "ok" | "unavailable";
export type Synthetic28 = true;
export type Action = "START_REVIEW" | "COMPLETE_REVIEW";
export type DevelopmentOnly29 = true;
export type IdempotencyKey6 = string;
export type SchemaVersion29 = "1.0.0";
export type Synthetic29 = true;
export type CaseId6 = string;
export type ConsentStatus5 = "ACTIVE";
export type ConsentVersion6 = "dev-notice-1";
export type CorrelationId6 = string;
export type DevelopmentOnly30 = true;
export type IdempotencyKey7 = string;
export type Purpose6 = "synthetic-wellbeing-screening";
export type SchemaVersion30 = "1.0.0";
export type Synthetic30 = true;
export type CaseId7 = string | null;
export type CorrelationId7 = string;
export type CreatedAt7 = string;
export type DevelopmentOnly31 = true;
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
export type SchemaVersion31 = "1.0.0";
export type ServiceName5 = "orchestrator";
export type ServiceVersion4 = "0.1.0";
export type Status4 = string;
export type Synthetic31 = true;
export type TraceId = string | null;
export type DevelopmentOnly32 = true;
export type Password = string;
export type SchemaVersion32 = "1.0.0";
export type Synthetic32 = true;
export type Username = string;
export type CaseId8 = string;
export type ConsentStatus6 = "ACTIVE";
export type ConsentVersion7 = "dev-notice-1";
export type CorrelationId8 = string;
export type DevelopmentOnly33 = true;
export type IdempotencyKey8 = string;
export type Purpose7 = "synthetic-wellbeing-screening";
export type SchemaVersion33 = "1.0.0";
export type Synthetic33 = true;
export type Text5 = string;
export type Action1 = "DELETE_DERIVED_EVIDENCE" | "EXPIRE_ACCESS";
export type ActionId = string;
export type CaseId9 = string;
export type CreatedAt8 = string;
export type DevelopmentOnly34 = true;
export type SchemaVersion34 = "1.0.0";
export type Status5 = "PENDING" | "COMPLETED" | "FAILED";
export type Synthetic34 = true;
export type DevelopmentOnly35 = true;
export type HumanReviewRequired = true;
export type SchemaVersion35 = "1.0.0";
export type Synthetic35 = true;
export type TaskId = string;
export type CaseId10 = string;
export type ConsentStatus7 = "ACTIVE";
export type ConsentVersion8 = "dev-notice-1";
export type CorrelationId9 = string;
export type DevelopmentOnly36 = true;
export type IdempotencyKey9 = string;
export type Purpose8 = "synthetic-wellbeing-screening";
export type SchemaVersion36 = "1.0.0";
export type Synthetic36 = true;
export type CorrelationId10 = string;
export type DevelopmentOnly37 = true;
export type Message = "Request could not be completed safely.";
export type SchemaVersion37 = "1.0.0";
export type Synthetic37 = true;
export type CorrelationId11 = string;
export type DevelopmentOnly38 = true;
export type ExplainerVersion1 = "mock-1";
export type ModelDatasetVersion = "synthetic-fixtures-1";
export type ModelVersion4 = "mock-1";
export type NlpServiceVersion = "0.1.0";
export type PipelineVersion1 = "mock-1";
export type PreprocessingDatasetVersion = "synthetic-fixtures-1";
export type PreprocessingServiceVersion = "0.1.0";
export type SchemaVersion38 = "1.0.0";
export type Synthetic38 = true;
export type XaiServiceVersion = "0.1.0";
export type DevelopmentOnly39 = true;
export type ExpiresAt1 = string;
export type SchemaVersion39 = "1.0.0";
export type SessionId = string;
export type Synthetic39 = true;
export type DevelopmentOnly40 = true;
export type Mode = "MOCK_SYNTHETIC_DEVELOPMENT_ONLY" | "SYNTHETIC_DEVELOPMENT_ONLY";
export type SchemaVersion40 = "1.0.0";
export type ServiceName6 = string;
export type ServiceVersion5 = "0.1.0";
export type Synthetic40 = true;
export type DevelopmentOnly41 = true;
export type IdempotencyKey10 = string;
export type SchemaVersion41 = "1.0.0";
export type Synthetic41 = true;
export type Attempts = number;
export type CaseId11 = string;
export type CorrelationId12 = string;
export type CreatedAt9 = string;
export type DevelopmentOnly42 = true;
export type IdempotencyKey11 = string;
export type SchemaVersion42 = "1.0.0";
export type Synthetic42 = true;
export type UpdatedAt1 = string;
export type ConsentId1 = string;
export type DevelopmentOnly43 = true;
export type FixtureId = "english" | "sinhala" | "romanized" | "mixed";
export type IdempotencyKey12 = string;
export type SchemaVersion43 = "1.0.0";
export type Synthetic43 = true;
export type Text6 = string;

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
export interface C4CounterfactualListResponse {
  development_only?: DevelopmentOnly3;
  items: Items;
  limit: Limit;
  offset: Offset;
  schema_version?: SchemaVersion4;
  synthetic?: Synthetic4;
  total: Total;
}
export interface C4CounterfactualSummary {
  best_edit_count?: BestEditCount;
  candidate_count: CandidateCount;
  counterfactual_id: CounterfactualId;
  created_at: CreatedAt1;
  development_only?: DevelopmentOnly4;
  is_development?: IsDevelopment;
  original_predicted_class?: OriginalPredictedClass;
  outcome: Outcome;
  schema_version?: SchemaVersion3;
  source_reference?: SourceReference;
  synthetic?: Synthetic3;
  target_class: TargetClass;
}
export interface C4CounterfactualRequest {
  development_only?: DevelopmentOnly5;
  idempotency_key?: IdempotencyKey;
  language?: Language;
  max_candidates?: MaxCandidates;
  max_edits?: MaxEdits;
  schema_version?: SchemaVersion5;
  source_reference?: SourceReference1;
  synthetic?: Synthetic5;
  target_class: TargetClass1;
  text: Text;
}
export interface C4CounterfactualResponse {
  best_candidate?: CounterfactualCandidate | null;
  candidates?: Candidates;
  counterfactual_id?: CounterfactualId1;
  created_at?: CreatedAt2;
  development_only?: DevelopmentOnly9;
  execution_time_ms?: ExecutionTimeMs;
  is_development?: IsDevelopment1;
  model_id?: ModelId;
  model_revision?: ModelRevision;
  model_version?: ModelVersion;
  non_diagnostic_notice?: NonDiagnosticNotice;
  original_predicted_class?: OriginalPredictedClass1;
  original_probabilities?: OriginalProbabilities;
  outcome?: Outcome1;
  outcome_message: OutcomeMessage;
  schema_version?: SchemaVersion9;
  search_limits?: SearchLimits;
  source_reference?: SourceReference2;
  supported_languages?: SupportedLanguages;
  synthetic?: Synthetic9;
  target_class: TargetClass2;
}
export interface CounterfactualCandidate {
  candidate_text?: CandidateText;
  development_only?: DevelopmentOnly6;
  diff_spans?: DiffSpans;
  edit_count: EditCount;
  edits?: Edits;
  minimality_description?: MinimalityDescription;
  minimality_rank?: MinimalityRank;
  predicted_class: PredictedClass;
  probabilities: Probabilities;
  schema_version?: SchemaVersion8;
  synthetic?: Synthetic8;
  target_probability: TargetProbability;
  target_probability_delta: TargetProbabilityDelta;
  verified?: Verified;
}
export interface TextSpanDiff {
  development_only?: DevelopmentOnly7;
  original_text?: OriginalText;
  schema_version?: SchemaVersion6;
  synthetic?: Synthetic6;
  text: Text1;
  type: Type;
}
export interface EditOperation {
  development_only?: DevelopmentOnly8;
  index: Index;
  op: Op;
  original?: Original;
  replacement?: Replacement;
  schema_version?: SchemaVersion7;
  synthetic?: Synthetic7;
}
export interface Probabilities {
  [k: string]: number;
}
export interface OriginalProbabilities {
  [k: string]: number;
}
export interface SearchLimits {
  [k: string]: number | string;
}
export interface C4EncoderCheckRequest {
  development_only?: DevelopmentOnly10;
  language?: Language1;
  schema_version?: SchemaVersion10;
  synthetic?: Synthetic10;
  text: Text2;
}
export interface C4EncoderCheckResponse {
  development_only?: DevelopmentOnly11;
  embedding_shape: EmbeddingShape;
  encoder_executed?: EncoderExecuted;
  hidden_dimension?: HiddenDimension;
  model_id?: ModelId1;
  schema_version?: SchemaVersion11;
  status_message?: StatusMessage;
  synthetic?: Synthetic11;
  token_count: TokenCount;
  truncated: Truncated;
}
export interface C4ExplanationListResponse {
  development_only?: DevelopmentOnly12;
  items: Items1;
  limit: Limit1;
  offset: Offset1;
  schema_version?: SchemaVersion13;
  synthetic?: Synthetic13;
  total: Total1;
}
export interface C4ExplanationSummary {
  created_at: CreatedAt3;
  development_only?: DevelopmentOnly13;
  explanation_id: ExplanationId;
  is_development?: IsDevelopment2;
  method: Method;
  predicted_class?: PredictedClass1;
  schema_version?: SchemaVersion12;
  source_reference?: SourceReference3;
  synthetic?: Synthetic12;
  target_class: TargetClass3;
  target_class_probability?: TargetClassProbability;
}
export interface C4ExplanationRequest {
  development_only?: DevelopmentOnly14;
  idempotency_key?: IdempotencyKey1;
  language?: Language2;
  method: Method1;
  schema_version?: SchemaVersion14;
  source_reference?: SourceReference4;
  synthetic?: Synthetic14;
  target_class?: TargetClass4;
  text: Text3;
}
export interface C4ExplanationResponse {
  additivity_discrepancy_message?: AdditivityDiscrepancyMessage;
  additivity_residual?: AdditivityResidual;
  additivity_within_tolerance?: AdditivityWithinTolerance;
  base_value?: BaseValue;
  computation_bounds?: ComputationBounds;
  contributions?: Contributions;
  created_at?: CreatedAt4;
  development_only?: DevelopmentOnly16;
  diagnostics?: Diagnostics;
  explanation_id?: ExplanationId1;
  is_development?: IsDevelopment3;
  method: Method2;
  model_id?: ModelId2;
  model_revision?: ModelRevision1;
  model_version?: ModelVersion1;
  output_value?: OutputValue;
  predicted_class?: PredictedClass2;
  probabilities?: Probabilities1;
  reconstructed_output?: ReconstructedOutput;
  schema_version?: SchemaVersion16;
  source_reference?: SourceReference5;
  status?: Status1;
  status_message: StatusMessage1;
  synthetic?: Synthetic16;
  target_class?: TargetClass5;
  target_class_probability?: TargetClassProbability1;
  token_count?: TokenCount1;
  tokens?: Tokens;
  truncated?: Truncated1;
  weights?: Weights;
}
export interface ComputationBounds {
  [k: string]: number;
}
export interface FeatureContribution {
  abs_weight: AbsWeight;
  development_only?: DevelopmentOnly15;
  direction: Direction;
  schema_version?: SchemaVersion15;
  synthetic?: Synthetic15;
  token: Token;
  weight: Weight;
}
export interface Diagnostics {
  [k: string]: number | string | boolean;
}
export interface Probabilities1 {
  [k: string]: number;
}
export interface C4PredictionRequest {
  development_only?: DevelopmentOnly17;
  language?: Language3;
  schema_version?: SchemaVersion17;
  synthetic?: Synthetic17;
  text: Text4;
}
export interface C4PredictionResponse {
  confidence: Confidence;
  development_only?: DevelopmentOnly18;
  max_sequence_length?: MaxSequenceLength;
  model_id?: ModelId3;
  model_revision?: ModelRevision2;
  model_version?: ModelVersion2;
  predicted_sentiment: PredictedSentiment;
  probabilities: Probabilities2;
  schema_version?: SchemaVersion18;
  status?: Status2;
  status_message?: StatusMessage2;
  synthetic?: Synthetic18;
  token_count: TokenCount2;
  truncated: Truncated2;
}
export interface Probabilities2 {
  [k: string]: number;
}
export interface ConsentDecision {
  consent_status: ConsentStatus;
  consent_version?: ConsentVersion;
  development_only?: DevelopmentOnly19;
  purpose?: Purpose;
  schema_version?: SchemaVersion19;
  synthetic?: Synthetic19;
}
export interface ConsentLifecycle {
  case?: PseudonymousCase | null;
  consent: ConsentRecord;
  development_only?: DevelopmentOnly22;
  disposal_reason?: DisposalReason;
  explicitly_withdrawn_at?: ExplicitlyWithdrawnAt;
  schema_version?: SchemaVersion22;
  synthetic?: Synthetic22;
}
export interface PseudonymousCase {
  case_id: CaseId1;
  correlation_id: CorrelationId1;
  created_at: CreatedAt5;
  development_only?: DevelopmentOnly20;
  error_code?: ErrorCode | null;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion20;
  synthetic?: Synthetic20;
  updated_at: UpdatedAt;
}
export interface ConsentRecord {
  consent_id: ConsentId;
  consent_status: ConsentState;
  consent_version: ConsentVersion1;
  created_at: CreatedAt6;
  development_only?: DevelopmentOnly21;
  expires_at: ExpiresAt;
  purpose: Purpose1;
  schema_version?: SchemaVersion21;
  synthetic?: Synthetic21;
}
export interface ExplanationRequest {
  case_id: CaseId2;
  consent_status?: ConsentStatus1;
  consent_version?: ConsentVersion2;
  correlation_id: CorrelationId2;
  development_only?: DevelopmentOnly23;
  idempotency_key: IdempotencyKey2;
  inference: InferenceResponse;
  preprocessing: PreprocessResponse;
  purpose?: Purpose4;
  schema_version?: SchemaVersion25;
  synthetic?: Synthetic25;
}
export interface InferenceResponse {
  calibrated?: Calibrated;
  case_id: CaseId3;
  confidence: Confidence1;
  consent_status?: ConsentStatus2;
  consent_version?: ConsentVersion3;
  correlation_id: CorrelationId3;
  dataset_version?: DatasetVersion;
  development_only?: DevelopmentOnly24;
  emotional_tone?: EmotionalTone;
  idempotency_key: IdempotencyKey3;
  model_version?: ModelVersion3;
  purpose?: Purpose2;
  review_priority?: ReviewPriority;
  schema_version?: SchemaVersion23;
  service_name?: ServiceName1;
  service_version?: ServiceVersion1;
  stress_language_signals: StressLanguageSignals;
  synthetic?: Synthetic23;
  wellbeing_indicator?: WellbeingIndicator;
}
export interface PreprocessResponse {
  anonymized_text: AnonymizedText;
  case_id: CaseId4;
  consent_status?: ConsentStatus3;
  consent_version?: ConsentVersion4;
  correlation_id: CorrelationId4;
  dataset_version?: DatasetVersion1;
  development_only?: DevelopmentOnly25;
  idempotency_key: IdempotencyKey4;
  language: Language4;
  normalized_text: NormalizedText;
  pipeline_version?: PipelineVersion;
  purpose?: Purpose3;
  schema_version?: SchemaVersion24;
  service_name?: ServiceName2;
  service_version?: ServiceVersion2;
  synthetic?: Synthetic24;
  token_offsets: TokenOffsets;
  tokens: Tokens1;
  transformations: Transformations;
}
export interface ExplanationResponse {
  case_id: CaseId5;
  consent_status?: ConsentStatus4;
  consent_version?: ConsentVersion5;
  correlation_id: CorrelationId5;
  counterfactual?: Counterfactual;
  development_only?: DevelopmentOnly26;
  evidence: Evidence;
  explainer_version?: ExplainerVersion;
  faithfulness?: Faithfulness;
  idempotency_key: IdempotencyKey5;
  method?: Method3;
  purpose?: Purpose5;
  reliability_status?: ReliabilityStatus;
  schema_version?: SchemaVersion26;
  service_name?: ServiceName3;
  service_version?: ServiceVersion3;
  stability?: Stability;
  synthetic?: Synthetic26;
}
export interface FixturesResponse {
  development_only?: DevelopmentOnly27;
  fixtures: Fixtures;
  schema_version?: SchemaVersion27;
  synthetic?: Synthetic27;
}
export interface Fixtures {
  [k: string]: string;
}
export interface HealthResponse {
  development_only?: DevelopmentOnly28;
  schema_version?: SchemaVersion28;
  service_name: ServiceName4;
  status: Status3;
  synthetic?: Synthetic28;
}
export interface HumanReviewAction {
  action: Action;
  development_only?: DevelopmentOnly29;
  idempotency_key: IdempotencyKey6;
  schema_version?: SchemaVersion29;
  synthetic?: Synthetic29;
}
export interface InferenceRequest {
  case_id: CaseId6;
  consent_status?: ConsentStatus5;
  consent_version?: ConsentVersion6;
  correlation_id: CorrelationId6;
  development_only?: DevelopmentOnly30;
  idempotency_key: IdempotencyKey7;
  preprocessing: PreprocessResponse;
  purpose?: Purpose6;
  schema_version?: SchemaVersion30;
  synthetic?: Synthetic30;
}
export interface LifecycleAuditEvent {
  case_id?: CaseId7;
  correlation_id: CorrelationId7;
  created_at?: CreatedAt7;
  development_only?: DevelopmentOnly31;
  event_id?: EventId1;
  event_type: EventType1;
  policy_expires_at?: PolicyExpiresAt;
  schema_version?: SchemaVersion31;
  service_name?: ServiceName5;
  service_version?: ServiceVersion4;
  status: Status4;
  synthetic?: Synthetic31;
  trace_id?: TraceId;
}
export interface LoginRequest {
  development_only?: DevelopmentOnly32;
  password: Password;
  schema_version?: SchemaVersion32;
  synthetic?: Synthetic32;
  username: Username;
}
export interface PreprocessRequest {
  case_id: CaseId8;
  consent_status?: ConsentStatus6;
  consent_version?: ConsentVersion7;
  correlation_id: CorrelationId8;
  development_only?: DevelopmentOnly33;
  idempotency_key: IdempotencyKey8;
  purpose?: Purpose7;
  schema_version?: SchemaVersion33;
  synthetic?: Synthetic33;
  text: Text5;
}
export interface RetentionAction {
  action: Action1;
  action_id: ActionId;
  case_id: CaseId9;
  created_at: CreatedAt8;
  development_only?: DevelopmentOnly34;
  schema_version?: SchemaVersion34;
  status: Status5;
  synthetic?: Synthetic34;
}
export interface ReviewTask {
  case: PseudonymousCase;
  development_only?: DevelopmentOnly35;
  explanation: ExplanationResponse;
  human_review_required?: HumanReviewRequired;
  inference: InferenceResponse;
  preprocessing?: PreprocessResponse | null;
  schema_version?: SchemaVersion35;
  synthetic?: Synthetic35;
  task_id: TaskId;
}
export interface ServiceContext {
  case_id: CaseId10;
  consent_status?: ConsentStatus7;
  consent_version?: ConsentVersion8;
  correlation_id: CorrelationId9;
  development_only?: DevelopmentOnly36;
  idempotency_key: IdempotencyKey9;
  purpose?: Purpose8;
  schema_version?: SchemaVersion36;
  synthetic?: Synthetic36;
}
export interface ServiceError {
  correlation_id: CorrelationId10;
  development_only?: DevelopmentOnly37;
  error_code: ErrorCode;
  message?: Message;
  schema_version?: SchemaVersion37;
  synthetic?: Synthetic37;
}
export interface ServiceProvenance {
  correlation_id: CorrelationId11;
  development_only?: DevelopmentOnly38;
  explainer_version: ExplainerVersion1;
  model_dataset_version: ModelDatasetVersion;
  model_version: ModelVersion4;
  nlp_service_version: NlpServiceVersion;
  pipeline_version: PipelineVersion1;
  preprocessing_dataset_version: PreprocessingDatasetVersion;
  preprocessing_service_version: PreprocessingServiceVersion;
  schema_version?: SchemaVersion38;
  synthetic?: Synthetic38;
  xai_service_version: XaiServiceVersion;
}
export interface SubmissionSession {
  development_only?: DevelopmentOnly39;
  expires_at: ExpiresAt1;
  role: Role;
  schema_version?: SchemaVersion39;
  session_id: SessionId;
  synthetic?: Synthetic39;
}
export interface VersionResponse {
  development_only?: DevelopmentOnly40;
  mode: Mode;
  schema_version?: SchemaVersion40;
  service_name: ServiceName6;
  service_version?: ServiceVersion5;
  synthetic?: Synthetic40;
}
export interface WithdrawalRequest {
  development_only?: DevelopmentOnly41;
  idempotency_key: IdempotencyKey10;
  schema_version?: SchemaVersion41;
  synthetic?: Synthetic41;
}
export interface WorkflowExecution {
  attempts?: Attempts;
  case_id: CaseId11;
  correlation_id: CorrelationId12;
  created_at: CreatedAt9;
  development_only?: DevelopmentOnly42;
  error_code?: ErrorCode | null;
  idempotency_key: IdempotencyKey11;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion42;
  synthetic?: Synthetic42;
  updated_at: UpdatedAt1;
}
export interface WorkflowRequest {
  consent_id: ConsentId1;
  development_only?: DevelopmentOnly43;
  fixture_id: FixtureId;
  idempotency_key: IdempotencyKey12;
  schema_version?: SchemaVersion43;
  synthetic?: Synthetic43;
  text: Text6;
}
