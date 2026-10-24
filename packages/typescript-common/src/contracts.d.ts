// GENERATED from authoritative Python contracts via JSON Schema. Do not edit.

export type Contracts =
  | AccountResponse
  | AssignmentRequest
  | AuditEvent
  | C4ComparisonCandidateRecord
  | C4ComparisonCurrentRequest
  | C4ComparisonCurrentResponse
  | C4ComparisonEvaluatedResponse
  | C4ComparisonLanguageGroup
  | C4ComparisonMetricSummary
  | C4CounterfactualListResponse
  | C4CounterfactualRequest
  | C4CounterfactualResponse
  | C4CounterfactualSummary
  | C4CoverageCard
  | C4EncoderCheckRequest
  | C4EncoderCheckResponse
  | C4ExplanationListResponse
  | C4ExplanationRequest
  | C4ExplanationResponse
  | C4ExplanationSummary
  | C4FaithfulnessListResponse
  | C4FaithfulnessOccurrence
  | C4FaithfulnessRequest
  | C4FaithfulnessResponse
  | C4FaithfulnessStepResult
  | C4FaithfulnessSummary
  | C4InternalFaithfulnessRequest
  | C4InternalStabilityRequest
  | C4ManualEvaluationRequest
  | C4ManualEvaluationResponse
  | C4PairedEvidenceItem
  | C4PredictionRequest
  | C4PredictionResponse
  | C4StabilityListResponse
  | C4StabilityRequest
  | C4StabilityResponse
  | C4StabilityRunResult
  | C4StabilitySummary
  | C4StabilityWordConsistency
  | ConsentDecision
  | ConsentLifecycle
  | ConsentRecord
  | CounterfactualCandidate
  | CounterfactualFeedback
  | CounterfactualFeedbackRequest
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
  | TextSpanLock
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
export type CreatedAt1 = string;
export type DevelopmentOnly3 = true;
export type ExplanationId = string;
export type IncompatibilityReason = string | null;
export type IsCompatible = boolean;
export type Method = "LIME" | "SHAP";
export type RecordId = string;
export type RecordType = "FAITHFULNESS" | "STABILITY" | "EXPLANATION";
export type SchemaVersion3 = "1.0.0";
export type Synthetic3 = true;
export type CommonK = number;
export type DevelopmentOnly4 = true;
export type Language = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type SchemaVersion4 = "1.0.0";
export type SelectedLimeEvalId = string | null;
export type SelectedLimeExpId = string | null;
export type SelectedShapEvalId = string | null;
export type SelectedShapExpId = string | null;
export type SourceReference = string | null;
export type Synthetic4 = true;
export type TargetClass = string | null;
export type Text = string | null;
export type AuthorizedSourceText = string | null;
export type AvailableLimeRecords = C4ComparisonCandidateRecord[];
export type AvailableShapRecords = C4ComparisonCandidateRecord[];
export type DevelopmentOnly5 = true;
export type DevelopmentOnly6 = true;
export type ExplainedClass = string;
export type InputReference = string;
export type Language1 = "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed" | "Unknown";
export type LimeCreatedAt = string | null;
export type LimeEvaluationId = string | null;
export type LimeExplanationId = string | null;
export type LimeValue = number | null;
export type Metric = string;
export type ModelRevision = string | null;
export type PairedDifference = number | null;
export type Reason = string | null;
export type SchemaVersion5 = "1.0.0";
export type ShapCreatedAt = string | null;
export type ShapEvaluationId = string | null;
export type ShapExplanationId = string | null;
export type ShapValue = number | null;
export type SourceHash = string | null;
export type Status1 =
  | "COMPARABLE"
  | "INCOMPATIBLE"
  | "MISSING_LIME"
  | "MISSING_SHAP"
  | "MISSING_BOTH"
  | "EVALUATION_FAILED"
  | "PROVENANCE_UNAVAILABLE";
export type Synthetic5 = true;
export type EvidenceItems = C4PairedEvidenceItem[];
export type ExplainedClass1 = string;
export type InputReference1 = string;
export type Language2 = "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed" | "Unknown";
export type CommonK1 = number | null;
export type DefinitionVersion = string;
export type DevelopmentOnly7 = true;
export type EffectiveK = number | null;
export type ExcludedCount = number;
export type IncompatibleCount = number;
export type LimeIqr = number | null;
export type LimeMean = number | null;
export type LimeMedian = number | null;
export type LimeStd = number | null;
export type Metric1 = string;
export type MetricLabel = string;
export type MissingCount = number;
export type PairedDifferenceMean = number | null;
export type PairedDifferenceStd = number | null;
export type SchemaVersion6 = "1.0.0";
export type ShapIqr = number | null;
export type ShapMean = number | null;
export type ShapMedian = number | null;
export type ShapStd = number | null;
export type Synthetic6 = true;
export type Unit = string;
export type ValidPairsCount = number;
export type Metrics = C4ComparisonMetricSummary[];
export type ModelRevision1 = string | null;
export type NonDiagnosticNotice = string;
export type SchemaVersion7 = "1.0.0";
export type SelectedLimeExplanationId = string | null;
export type SelectedShapExplanationId = string | null;
export type SelectionRules = string;
export type SourceHash1 = string | null;
export type Synthetic7 = true;
export type TextAvailable = boolean;
export type ComparablePairs = number;
export type DevelopmentOnly8 = true;
export type DistinctInputsInScope = number;
export type IncompatibleEvidence = number;
export type MissingEvidence = number;
export type SchemaVersion8 = "1.0.0";
export type Synthetic8 = true;
export type DevelopmentOnly9 = true;
export type DevelopmentOnly10 = true;
export type Language3 = "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed" | "Unknown";
export type LimeMean1 = number | null;
export type LimeStd1 = number | null;
export type PairedDifferenceMean1 = number | null;
export type PairedDifferenceStd1 = number | null;
export type SchemaVersion9 = "1.0.0";
export type ShapMean1 = number | null;
export type ShapStd1 = number | null;
export type Synthetic9 = true;
export type ValidPairsCount1 = number;
export type LanguageGroups = C4ComparisonLanguageGroup[];
export type Limit = number;
export type MetricSummaries = C4ComparisonMetricSummary[];
export type NonDiagnosticNotice1 = string;
export type Offset = number;
export type PairedItems = C4PairedEvidenceItem[];
export type SchemaVersion10 = "1.0.0";
export type SelectedMetric = string;
export type SelectionRules1 = string;
export type Synthetic10 = true;
export type TotalItems = number;
export type DevelopmentOnly11 = true;
export type BestEditCount = number | null;
export type CandidateCount = number;
export type CounterfactualId = string;
export type CreatedAt2 = string;
export type DevelopmentOnly12 = true;
export type IsDevelopment = boolean;
export type OriginalPredictedClass = string | null;
export type Outcome = string;
export type SchemaVersion11 = "1.0.0";
export type SourceReference1 = string | null;
export type Synthetic11 = true;
export type TargetClass1 = string;
export type Items = C4CounterfactualSummary[];
export type Limit1 = number;
export type Offset1 = number;
export type SchemaVersion12 = "1.0.0";
export type Synthetic12 = true;
export type Total = number;
export type DevelopmentOnly13 = true;
export type EditMode = "both" | "replace_only" | "delete_only";
export type IdempotencyKey = string | null;
export type Language4 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type DevelopmentOnly14 = true;
export type End = number;
export type SchemaVersion13 = "1.0.0";
export type Start = number;
export type Synthetic13 = true;
export type Text1 = string | null;
export type LockedSpans = TextSpanLock[];
export type MaxCandidates = number;
export type MaxEdits = number;
export type SchemaVersion14 = "1.0.0";
export type SourceReference2 = string | null;
export type Synthetic14 = true;
export type TargetClass2 = "Negative" | "Neutral" | "Positive";
export type Text2 = string;
export type CandidateId = string | null;
export type CandidateText = string | null;
export type DevelopmentOnly15 = true;
export type DevelopmentOnly16 = true;
export type OriginalText = string | null;
export type SchemaVersion15 = "1.0.0";
export type Synthetic15 = true;
export type Text3 = string;
export type Type = "unchanged" | "deleted" | "inserted" | "replaced";
export type DiffSpans = TextSpanDiff[];
export type EditCount = number;
export type DevelopmentOnly17 = true;
export type EndOffset = number | null;
export type Index = number;
export type Op = "delete" | "replace" | "insert";
export type Original = string | null;
export type Replacement = string | null;
export type SchemaVersion16 = "1.0.0";
export type StartOffset = number | null;
export type Synthetic16 = true;
export type Edits = EditOperation[];
export type CandidateId1 = string;
export type Comment = string | null;
export type ContextPreserved = ("Yes" | "No" | "Unsure") | null;
export type CreatedAt3 = string | null;
export type DevelopmentOnly18 = true;
export type FeedbackId = string | null;
export type NaturalWording = ("Yes" | "No" | "Unsure") | null;
export type ReviewerId = string | null;
export type SchemaVersion17 = "1.0.0";
export type Synthetic17 = true;
export type UpdatedAt = string | null;
export type Useful = ("Yes" | "No" | "Unsure") | null;
export type MinimalityDescription = string;
export type MinimalityRank = number;
export type PredictedClass = string;
export type SchemaVersion18 = "1.0.0";
export type Synthetic18 = true;
export type TargetProbability = number;
export type TargetProbabilityDelta = number;
export type Verified = boolean;
export type Candidates = CounterfactualCandidate[];
export type CounterfactualId1 = string | null;
export type CreatedAt4 = string | null;
export type DevelopmentOnly19 = true;
export type EvaluatedCandidateCount = number;
export type ExecutionTimeMs = number | null;
export type IsDevelopment1 = boolean;
export type ModelId = string | null;
export type ModelRevision2 = string | null;
export type ModelVersion = string | null;
export type NonDiagnosticNotice2 = string;
export type OriginalPredictedClass1 = string | null;
export type Outcome1 =
  | "SUCCESS"
  | "NO_COUNTERFACTUAL_FOUND"
  | "ALREADY_TARGET_CLASS"
  | "SEARCH_LIMIT_EXCEEDED"
  | "TIMEOUT"
  | "UNAVAILABLE_MODEL";
export type OutcomeMessage = string;
export type RequestHash = string | null;
export type SchemaVersion19 = "1.0.0";
export type SourceReference3 = string | null;
export type StoppingReason = string | null;
export type SuccessfulCandidateCount = number;
export type SupportedLanguages = string[];
export type Synthetic19 = true;
export type TargetClass3 = string;
export type DevelopmentOnly20 = true;
export type Language5 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type SchemaVersion20 = "1.0.0";
export type Synthetic20 = true;
export type Text4 = string;
export type DevelopmentOnly21 = true;
export type EmbeddingShape = number[];
export type EncoderExecuted = true;
export type HiddenDimension = number;
export type ModelId1 = "FacebookAI/xlm-roberta-base";
export type SchemaVersion21 = "1.0.0";
export type StatusMessage = "Base encoder connected — wellbeing classification unavailable.";
export type Synthetic21 = true;
export type TokenCount = number;
export type Truncated = boolean;
export type DevelopmentOnly22 = true;
export type CreatedAt5 = string;
export type DevelopmentOnly23 = true;
export type ExplanationId1 = string;
export type IsDevelopment2 = boolean;
export type Method1 = "LIME" | "SHAP";
export type PredictedClass1 = string | null;
export type SchemaVersion22 = "1.0.0";
export type SourceReference4 = string | null;
export type Synthetic22 = true;
export type TargetClass4 = string;
export type TargetClassProbability = number | null;
export type Items1 = C4ExplanationSummary[];
export type Limit2 = number;
export type Offset2 = number;
export type SchemaVersion23 = "1.0.0";
export type Synthetic23 = true;
export type Total1 = number;
export type DevelopmentOnly24 = true;
export type IdempotencyKey1 = string | null;
export type Language6 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type Method2 = "LIME" | "SHAP";
export type SchemaVersion24 = "1.0.0";
export type SourceReference5 = string | null;
export type Synthetic24 = true;
export type TargetClass5 = string | null;
export type Text5 = string;
export type AdditivityDiscrepancyMessage = string | null;
export type AdditivityResidual = number | null;
export type AdditivityWithinTolerance = boolean | null;
export type BaseValue = number | null;
export type AbsWeight = number;
export type DevelopmentOnly25 = true;
export type Direction = "supports" | "opposes";
export type SchemaVersion25 = "1.0.0";
export type Synthetic25 = true;
export type Token = string;
export type Weight = number;
export type Contributions = FeatureContribution[];
export type CreatedAt6 = string | null;
export type DevelopmentOnly26 = true;
export type ExplanationId2 = string | null;
export type IsDevelopment3 = boolean;
export type Method3 = "LIME" | "SHAP";
export type ModelId2 = string | null;
export type ModelRevision3 = string | null;
export type ModelVersion1 = string | null;
export type OutputValue = number | null;
export type PredictedClass2 = string | null;
export type ReconstructedOutput = number | null;
export type SchemaVersion26 = "1.0.0";
export type SourceReference6 = string | null;
export type Status2 = "READY" | "AWAITING_CLASSIFIER_CONNECTION" | "UNAVAILABLE";
export type StatusMessage1 = string;
export type Synthetic26 = true;
export type TargetClass6 = string | null;
export type TargetClassProbability1 = number | null;
export type TokenCount1 = number | null;
export type Tokens = string[];
export type Truncated1 = boolean | null;
export type Weights = number[];
export type DevelopmentOnly27 = true;
export type Aopc = number | null;
export type BaselineProbability = number;
export type CreatedAt7 = string;
export type DevelopmentOnly28 = true;
export type EvaluationId = string;
export type ExplainedClass2 = string;
export type ExplanationId3 = string;
export type IsDevelopment4 = boolean;
export type Method4 = "LIME" | "SHAP";
export type Outcome2 = string;
export type SchemaVersion27 = "1.0.0";
export type SourceReference7 = string | null;
export type Synthetic27 = true;
export type Items2 = C4FaithfulnessSummary[];
export type Limit3 = number;
export type Offset3 = number;
export type SchemaVersion28 = "1.0.0";
export type Synthetic28 = true;
export type Total2 = number;
export type DevelopmentOnly29 = true;
export type End1 = number;
export type OccurrenceId = string;
export type Rank = number;
export type SchemaVersion29 = "1.0.0";
export type Start1 = number;
export type Synthetic29 = true;
export type Weight1 = number;
export type Word = string;
export type DevelopmentOnly30 = true;
export type ExplanationId4 = string;
export type IdempotencyKey2 = string | null;
export type Language7 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type MaxRemovalPct = number | null;
export type MaxRemovalWords = number | null;
export type RandomTrials = number;
export type SchemaVersion30 = "1.0.0";
export type Seed = number;
export type SourceReference8 = string | null;
export type Synthetic30 = true;
export type Text6 = string;
export type Aopc1 = number | null;
export type BaselineProbability1 = number;
export type BudgetEvaluated = number;
export type BudgetRequested = number;
export type CompletedSteps = number;
export type CompletedTrials = number;
export type CreatedAt8 = string | null;
export type DevelopmentOnly31 = true;
export type EvaluationId1 = string | null;
export type ExecutionTimeMs1 = number | null;
export type ExplainedClass3 = string;
export type ExplanationId5 = string;
export type FinalComprehensivenessDrop = number | null;
export type FinalDifferenceFromRandom = number | null;
export type FinalRandomMeanDrop = number | null;
export type FinalSufficiencyGap = number | null;
export type IsDevelopment5 = boolean;
export type Method5 = "LIME" | "SHAP";
export type ModelId3 = string | null;
export type ModelRevision4 = string | null;
export type ModelVersion2 = string | null;
export type NonDiagnosticNotice3 = string;
export type Outcome3 =
  | "SUCCESS"
  | "PARTIAL"
  | "NO_SUPPORTING_WORDS"
  | "UNSUPPORTED_ALIGNMENT"
  | "INCOMPATIBLE_MODEL"
  | "TEXT_MISMATCH"
  | "OVERLENGTH_TEXT"
  | "TIMEOUT"
  | "UNAVAILABLE_MODEL"
  | "INFERENCE_FAILED";
export type OutcomeMessage1 = string;
export type RankedWords = C4FaithfulnessOccurrence[];
export type Saved = boolean;
export type SchemaVersion31 = "1.0.0";
export type Seed1 = number;
export type SourceReference9 = string | null;
export type ComprehensivenessDrop = number;
export type DevelopmentOnly32 = true;
export type DifferenceFromRandom = number | null;
export type KeepRemainingProbability = number | null;
export type ModifiedText = string;
export type RandomMeanDrop = number | null;
export type RandomMeanProbability = number | null;
export type RandomStdDrop = number | null;
export type RandomTrialCount = number;
export type RemainingProbability = number;
export type RemovedOccurrenceIds = string[];
export type RemovedWords = string[];
export type SchemaVersion32 = "1.0.0";
export type Step = number;
export type SufficiencyGap = number | null;
export type Synthetic31 = true;
export type Steps = C4FaithfulnessStepResult[];
export type StoppingReason1 = string | null;
export type Synthetic32 = true;
export type TotalEligibleWords = number;
export type TotalInferences = number;
export type Contributions1 = FeatureContribution[];
export type DevelopmentOnly33 = true;
export type ExplainedClass4 = string;
export type ExplanationId6 = string;
export type Language8 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type MaxRemovalPct1 = number | null;
export type MaxRemovalWords1 = number | null;
export type Method6 = "LIME" | "SHAP";
export type ModelRevision5 = string | null;
export type RandomTrials1 = number;
export type SchemaVersion33 = "1.0.0";
export type Seed2 = number;
export type Synthetic33 = true;
export type TargetClassProbability2 = number | null;
export type Text7 = string;
export type Tokens1 = string[];
export type Weights1 = number[];
export type BaseSeed = number;
export type DevelopmentOnly34 = true;
export type ExplainedClass5 = string;
export type ExplainerEvals = number | null;
export type ExplanationId7 = string;
export type Language9 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type Method7 = "LIME" | "SHAP";
export type ModelRevision6 = string | null;
export type RunCount = number;
export type SchemaVersion34 = "1.0.0";
export type Synthetic34 = true;
export type TargetClassProbability3 = number | null;
export type Text8 = string;
export type TopK = number;
export type DevelopmentOnly35 = true;
export type EditedText = string;
export type Language10 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type OriginalText1 = string;
export type SchemaVersion35 = "1.0.0";
export type Synthetic35 = true;
export type TargetClass7 = "Negative" | "Neutral" | "Positive";
export type DevelopmentOnly36 = true;
export type DiffSpans1 = TextSpanDiff[];
export type EditCount1 = number;
export type EditedPredictedClass = string;
export type Edits1 = EditOperation[];
export type ExecutionTimeMs2 = number | null;
export type FlipStatusLabel = string;
export type IsFlip = boolean;
export type ModelId4 = string | null;
export type ModelRevision7 = string | null;
export type ModelVersion3 = string | null;
export type NonDiagnosticNotice4 = string;
export type OriginalPredictedClass2 = string;
export type SchemaVersion36 = "1.0.0";
export type Synthetic36 = true;
export type TargetClass8 = string;
export type TargetProbabilityAfter = number;
export type TargetProbabilityBefore = number;
export type TargetProbabilityDelta1 = number;
export type DevelopmentOnly37 = true;
export type Language11 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type SchemaVersion37 = "1.0.0";
export type Synthetic37 = true;
export type Text9 = string;
export type Confidence = number;
export type DevelopmentOnly38 = true;
export type MaxSequenceLength = number;
export type ModelId5 = string;
export type ModelRevision8 = string | null;
export type ModelVersion4 = string;
export type PredictedSentiment = "Negative" | "Neutral" | "Positive";
export type SchemaVersion38 = "1.0.0";
export type Status3 = "READY" | "FAILED";
export type StatusMessage2 = string;
export type Synthetic38 = true;
export type TokenCount2 = number;
export type Truncated2 = boolean;
export type DevelopmentOnly39 = true;
export type CompletedRuns = number;
export type CreatedAt9 = string;
export type DevelopmentOnly40 = true;
export type EvaluationId2 = string;
export type ExplainedClass6 = string;
export type ExplanationId8 = string;
export type IsDevelopment6 = boolean;
export type MeanAttributionStd = number | null;
export type MeanRankCorrelation = number | null;
export type MeanTopKOverlap = number | null;
export type Method8 = "LIME" | "SHAP";
export type Outcome4 = string;
export type RequestedRuns = number;
export type SchemaVersion39 = "1.0.0";
export type SourceReference10 = string | null;
export type Synthetic39 = true;
export type Items3 = C4StabilitySummary[];
export type Limit4 = number;
export type Offset4 = number;
export type SchemaVersion40 = "1.0.0";
export type Synthetic40 = true;
export type Total3 = number;
export type BaseSeed1 = number;
export type DevelopmentOnly41 = true;
export type ExplainerEvals1 = number | null;
export type ExplanationId9 = string;
export type IdempotencyKey3 = string | null;
export type Language12 = ("English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") | null;
export type RunCount1 = number;
export type SchemaVersion41 = "1.0.0";
export type SourceReference11 = string | null;
export type Synthetic41 = true;
export type Text10 = string;
export type TopK1 = number;
export type BaselineProbability2 = number;
export type CompletedRuns1 = number;
export type CreatedAt10 = string | null;
export type DeterminismNotice = string | null;
export type DevelopmentOnly42 = true;
export type EffectiveK1 = number;
export type EvaluationId3 = string | null;
export type ExecutionTimeMs3 = number | null;
export type ExplainedClass7 = string;
export type ExplainerVersion = string | null;
export type ExplanationId10 = string;
export type IsDeterministic = boolean;
export type IsDevelopment7 = boolean;
export type MeanAttributionStd1 = number | null;
export type MeanRankCorrelation1 = number | null;
export type MeanTopKOverlap1 = number | null;
export type Method9 = "LIME" | "SHAP";
export type ModelId6 = string | null;
export type ModelRevision9 = string | null;
export type ModelVersion5 = string | null;
export type NonDiagnosticNotice5 = string;
export type Outcome5 =
  | "SUCCESS"
  | "PARTIAL"
  | "UNSUPPORTED_ALIGNMENT"
  | "INCOMPATIBLE_MODEL"
  | "TEXT_MISMATCH"
  | "OVERLENGTH_TEXT"
  | "TIMEOUT"
  | "UNAVAILABLE_MODEL"
  | "INFERENCE_FAILED";
export type OutcomeMessage2 = string;
export type RequestedRuns1 = number;
export type DevelopmentOnly43 = true;
export type ErrorMessage = string | null;
export type ExecutionTimeMs4 = number | null;
export type IsReference = boolean;
export type RankCorrelation = number | null;
export type RunIndex = number;
export type SchemaVersion42 = "1.0.0";
export type Seed3 = number | null;
export type Status4 = "SUCCESS" | "FAILED";
export type Synthetic42 = true;
export type TopKIds = string[];
export type TopKOverlap = number | null;
export type Runs = C4StabilityRunResult[];
export type Saved1 = boolean;
export type SchemaVersion43 = "1.0.0";
export type SourceReference12 = string | null;
export type StoppingReason2 = string | null;
export type Synthetic43 = true;
export type TotalEligibleWords1 = number;
export type DevelopmentOnly44 = true;
export type End2 = number;
export type MeanWeight = number;
export type OccurrenceId1 = string;
export type RunOccurrenceCount = number;
export type SchemaVersion44 = "1.0.0";
export type Start2 = number;
export type StdDev = number | null;
export type Synthetic44 = true;
export type TopKFrequency = number;
export type Word1 = string;
export type WordConsistency = C4StabilityWordConsistency[];
export type ConsentStatus = "ACTIVE" | "REJECTED";
export type ConsentVersion = "dev-notice-1";
export type DevelopmentOnly45 = true;
export type Purpose = "synthetic-wellbeing-screening";
export type SchemaVersion45 = "1.0.0";
export type Synthetic45 = true;
export type CaseId1 = string;
export type CorrelationId1 = string;
export type CreatedAt11 = string;
export type DevelopmentOnly46 = true;
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
export type SchemaVersion46 = "1.0.0";
export type Synthetic46 = true;
export type UpdatedAt1 = string;
export type ConsentId = string;
export type ConsentState = "PENDING" | "ACTIVE" | "EXPIRED" | "WITHDRAWN" | "REJECTED" | "INVALID";
export type ConsentVersion1 = string;
export type CreatedAt12 = string;
export type DevelopmentOnly47 = true;
export type ExpiresAt = string;
export type Purpose1 = string;
export type SchemaVersion47 = "1.0.0";
export type Synthetic47 = true;
export type DevelopmentOnly48 = true;
export type DisposalReason = ("RETENTION" | "OWNER_WITHDRAWAL" | "LEGACY_DISPOSAL") | null;
export type ExplicitlyWithdrawnAt = string | null;
export type SchemaVersion48 = "1.0.0";
export type Synthetic48 = true;
export type CandidateId2 = string;
export type Comment1 = string | null;
export type ContextPreserved1 = ("Yes" | "No" | "Unsure") | null;
export type DevelopmentOnly49 = true;
export type NaturalWording1 = ("Yes" | "No" | "Unsure") | null;
export type SchemaVersion49 = "1.0.0";
export type Synthetic49 = true;
export type Useful1 = ("Yes" | "No" | "Unsure") | null;
export type CaseId2 = string;
export type ConsentStatus1 = "ACTIVE";
export type ConsentVersion2 = "dev-notice-1";
export type CorrelationId2 = string;
export type DevelopmentOnly50 = true;
export type IdempotencyKey4 = string;
export type Calibrated = false;
export type CaseId3 = string;
export type Confidence1 = number;
export type ConsentStatus2 = "ACTIVE";
export type ConsentVersion3 = "dev-notice-1";
export type CorrelationId3 = string;
export type DatasetVersion = "synthetic-fixtures-1";
export type DevelopmentOnly51 = true;
export type EmotionalTone = "synthetic-neutral";
export type IdempotencyKey5 = string;
export type ModelVersion6 = "mock-1";
export type Purpose2 = "synthetic-wellbeing-screening";
export type ReviewPriority = "HUMAN_REVIEW_REQUIRED";
export type SchemaVersion50 = "1.0.0";
export type ServiceName1 = "nlp";
export type ServiceVersion1 = "0.1.0";
export type StressLanguageSignals = "synthetic-busy-timetable"[];
export type Synthetic50 = true;
export type WellbeingIndicator = "synthetic-academic-pressure";
export type AnonymizedText = string;
export type CaseId4 = string;
export type ConsentStatus3 = "ACTIVE";
export type ConsentVersion4 = "dev-notice-1";
export type CorrelationId4 = string;
export type DatasetVersion1 = "synthetic-fixtures-1";
export type DevelopmentOnly52 = true;
export type IdempotencyKey6 = string;
export type Language13 = "en" | "si" | "romanized-si" | "mixed" | "uncertain";
export type NormalizedText = string;
export type PipelineVersion = "mock-1";
export type Purpose3 = "synthetic-wellbeing-screening";
export type SchemaVersion51 = "1.0.0";
export type ServiceName2 = "preprocessing";
export type ServiceVersion2 = "0.1.0";
export type Synthetic51 = true;
export type TokenOffsets = [unknown, unknown][];
export type Tokens2 = string[];
export type Transformations = string[];
export type Purpose4 = "synthetic-wellbeing-screening";
export type SchemaVersion52 = "1.0.0";
export type Synthetic52 = true;
export type CaseId5 = string;
export type ConsentStatus4 = "ACTIVE";
export type ConsentVersion5 = "dev-notice-1";
export type CorrelationId5 = string;
export type Counterfactual = null;
export type DevelopmentOnly53 = true;
export type Evidence = string[];
export type ExplainerVersion1 = "mock-1";
export type Faithfulness = null;
export type IdempotencyKey7 = string;
export type Method10 = "MOCK_FIXED_FIXTURE";
export type Purpose5 = "synthetic-wellbeing-screening";
export type ReliabilityStatus = "NOT_EVALUATED";
export type SchemaVersion53 = "1.0.0";
export type ServiceName3 = "xai";
export type ServiceVersion3 = "0.1.0";
export type Stability = null;
export type Synthetic53 = true;
export type DevelopmentOnly54 = true;
export type SchemaVersion54 = "1.0.0";
export type Synthetic54 = true;
export type DevelopmentOnly55 = true;
export type SchemaVersion55 = "1.0.0";
export type ServiceName4 = string;
export type Status5 = "ok" | "unavailable";
export type Synthetic55 = true;
export type Action = "START_REVIEW" | "COMPLETE_REVIEW";
export type DevelopmentOnly56 = true;
export type IdempotencyKey8 = string;
export type SchemaVersion56 = "1.0.0";
export type Synthetic56 = true;
export type CaseId6 = string;
export type ConsentStatus5 = "ACTIVE";
export type ConsentVersion6 = "dev-notice-1";
export type CorrelationId6 = string;
export type DevelopmentOnly57 = true;
export type IdempotencyKey9 = string;
export type Purpose6 = "synthetic-wellbeing-screening";
export type SchemaVersion57 = "1.0.0";
export type Synthetic57 = true;
export type CaseId7 = string | null;
export type CorrelationId7 = string;
export type CreatedAt13 = string;
export type DevelopmentOnly58 = true;
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
export type SchemaVersion58 = "1.0.0";
export type ServiceName5 = "orchestrator";
export type ServiceVersion4 = "0.1.0";
export type Status6 = string;
export type Synthetic58 = true;
export type TraceId = string | null;
export type DevelopmentOnly59 = true;
export type Password = string;
export type SchemaVersion59 = "1.0.0";
export type Synthetic59 = true;
export type Username = string;
export type CaseId8 = string;
export type ConsentStatus6 = "ACTIVE";
export type ConsentVersion7 = "dev-notice-1";
export type CorrelationId8 = string;
export type DevelopmentOnly60 = true;
export type IdempotencyKey10 = string;
export type Purpose7 = "synthetic-wellbeing-screening";
export type SchemaVersion60 = "1.0.0";
export type Synthetic60 = true;
export type Text11 = string;
export type Action1 = "DELETE_DERIVED_EVIDENCE" | "EXPIRE_ACCESS";
export type ActionId = string;
export type CaseId9 = string;
export type CreatedAt14 = string;
export type DevelopmentOnly61 = true;
export type SchemaVersion61 = "1.0.0";
export type Status7 = "PENDING" | "COMPLETED" | "FAILED";
export type Synthetic61 = true;
export type DevelopmentOnly62 = true;
export type HumanReviewRequired = true;
export type SchemaVersion62 = "1.0.0";
export type Synthetic62 = true;
export type TaskId = string;
export type CaseId10 = string;
export type ConsentStatus7 = "ACTIVE";
export type ConsentVersion8 = "dev-notice-1";
export type CorrelationId9 = string;
export type DevelopmentOnly63 = true;
export type IdempotencyKey11 = string;
export type Purpose8 = "synthetic-wellbeing-screening";
export type SchemaVersion63 = "1.0.0";
export type Synthetic63 = true;
export type CorrelationId10 = string;
export type DevelopmentOnly64 = true;
export type Message = "Request could not be completed safely.";
export type SchemaVersion64 = "1.0.0";
export type Synthetic64 = true;
export type CorrelationId11 = string;
export type DevelopmentOnly65 = true;
export type ExplainerVersion2 = "mock-1";
export type ModelDatasetVersion = "synthetic-fixtures-1";
export type ModelVersion7 = "mock-1";
export type NlpServiceVersion = "0.1.0";
export type PipelineVersion1 = "mock-1";
export type PreprocessingDatasetVersion = "synthetic-fixtures-1";
export type PreprocessingServiceVersion = "0.1.0";
export type SchemaVersion65 = "1.0.0";
export type Synthetic65 = true;
export type XaiServiceVersion = "0.1.0";
export type DevelopmentOnly66 = true;
export type ExpiresAt1 = string;
export type SchemaVersion66 = "1.0.0";
export type SessionId = string;
export type Synthetic66 = true;
export type DevelopmentOnly67 = true;
export type Mode = "MOCK_SYNTHETIC_DEVELOPMENT_ONLY" | "SYNTHETIC_DEVELOPMENT_ONLY";
export type SchemaVersion67 = "1.0.0";
export type ServiceName6 = string;
export type ServiceVersion5 = "0.1.0";
export type Synthetic67 = true;
export type DevelopmentOnly68 = true;
export type IdempotencyKey12 = string;
export type SchemaVersion68 = "1.0.0";
export type Synthetic68 = true;
export type Attempts = number;
export type CaseId11 = string;
export type CorrelationId12 = string;
export type CreatedAt15 = string;
export type DevelopmentOnly69 = true;
export type IdempotencyKey13 = string;
export type SchemaVersion69 = "1.0.0";
export type Synthetic69 = true;
export type UpdatedAt2 = string;
export type ConsentId1 = string;
export type DevelopmentOnly70 = true;
export type FixtureId = "english" | "sinhala" | "romanized" | "mixed";
export type IdempotencyKey14 = string;
export type SchemaVersion70 = "1.0.0";
export type Synthetic70 = true;
export type Text12 = string;

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
export interface C4ComparisonCandidateRecord {
  created_at: CreatedAt1;
  development_only?: DevelopmentOnly3;
  explanation_id: ExplanationId;
  incompatibility_reason?: IncompatibilityReason;
  is_compatible?: IsCompatible;
  method: Method;
  record_id: RecordId;
  record_type: RecordType;
  schema_version?: SchemaVersion3;
  settings?: Settings;
  synthetic?: Synthetic3;
}
export interface Settings {
  [k: string]: string | number | boolean | null;
}
export interface C4ComparisonCurrentRequest {
  common_k?: CommonK;
  development_only?: DevelopmentOnly4;
  language?: Language;
  schema_version?: SchemaVersion4;
  selected_lime_eval_id?: SelectedLimeEvalId;
  selected_lime_exp_id?: SelectedLimeExpId;
  selected_shap_eval_id?: SelectedShapEvalId;
  selected_shap_exp_id?: SelectedShapExpId;
  source_reference?: SourceReference;
  synthetic?: Synthetic4;
  target_class?: TargetClass;
  text?: Text;
}
export interface C4ComparisonCurrentResponse {
  authorized_source_text?: AuthorizedSourceText;
  available_lime_records?: AvailableLimeRecords;
  available_shap_records?: AvailableShapRecords;
  development_only?: DevelopmentOnly5;
  evidence_items?: EvidenceItems;
  explained_class: ExplainedClass1;
  input_reference: InputReference1;
  language?: Language2;
  metrics?: Metrics;
  model_revision?: ModelRevision1;
  non_diagnostic_notice?: NonDiagnosticNotice;
  schema_version?: SchemaVersion7;
  selected_lime_explanation_id?: SelectedLimeExplanationId;
  selected_shap_explanation_id?: SelectedShapExplanationId;
  selection_rules?: SelectionRules;
  source_hash?: SourceHash1;
  synthetic?: Synthetic7;
  text_available?: TextAvailable;
}
export interface C4PairedEvidenceItem {
  development_only?: DevelopmentOnly6;
  explained_class: ExplainedClass;
  input_reference: InputReference;
  language?: Language1;
  lime_created_at?: LimeCreatedAt;
  lime_evaluation_id?: LimeEvaluationId;
  lime_explanation_id?: LimeExplanationId;
  lime_value?: LimeValue;
  metric: Metric;
  model_revision?: ModelRevision;
  paired_difference?: PairedDifference;
  reason?: Reason;
  schema_version?: SchemaVersion5;
  settings_summary?: SettingsSummary;
  shap_created_at?: ShapCreatedAt;
  shap_evaluation_id?: ShapEvaluationId;
  shap_explanation_id?: ShapExplanationId;
  shap_value?: ShapValue;
  source_hash?: SourceHash;
  status?: Status1;
  synthetic?: Synthetic5;
}
export interface SettingsSummary {
  [k: string]: string | number | boolean | null;
}
export interface C4ComparisonMetricSummary {
  common_k?: CommonK1;
  definition_version?: DefinitionVersion;
  development_only?: DevelopmentOnly7;
  effective_k?: EffectiveK;
  excluded_count?: ExcludedCount;
  incompatible_count?: IncompatibleCount;
  lime_iqr?: LimeIqr;
  lime_mean?: LimeMean;
  lime_median?: LimeMedian;
  lime_std?: LimeStd;
  metric: Metric1;
  metric_label: MetricLabel;
  missing_count?: MissingCount;
  paired_difference_mean?: PairedDifferenceMean;
  paired_difference_std?: PairedDifferenceStd;
  schema_version?: SchemaVersion6;
  shap_iqr?: ShapIqr;
  shap_mean?: ShapMean;
  shap_median?: ShapMedian;
  shap_std?: ShapStd;
  synthetic?: Synthetic6;
  unit: Unit;
  valid_pairs_count?: ValidPairsCount;
}
export interface C4ComparisonEvaluatedResponse {
  coverage: C4CoverageCard;
  development_only?: DevelopmentOnly9;
  language_groups?: LanguageGroups;
  limit?: Limit;
  metric_summaries?: MetricSummaries;
  non_diagnostic_notice?: NonDiagnosticNotice1;
  offset?: Offset;
  paired_items?: PairedItems;
  schema_version?: SchemaVersion10;
  selected_metric: SelectedMetric;
  selection_rules?: SelectionRules1;
  synthetic?: Synthetic10;
  total_items?: TotalItems;
}
export interface C4CoverageCard {
  comparable_pairs?: ComparablePairs;
  development_only?: DevelopmentOnly8;
  distinct_inputs_in_scope?: DistinctInputsInScope;
  incompatible_evidence?: IncompatibleEvidence;
  missing_evidence?: MissingEvidence;
  schema_version?: SchemaVersion8;
  synthetic?: Synthetic8;
}
export interface C4ComparisonLanguageGroup {
  development_only?: DevelopmentOnly10;
  language: Language3;
  lime_mean?: LimeMean1;
  lime_std?: LimeStd1;
  paired_difference_mean?: PairedDifferenceMean1;
  paired_difference_std?: PairedDifferenceStd1;
  schema_version?: SchemaVersion9;
  shap_mean?: ShapMean1;
  shap_std?: ShapStd1;
  synthetic?: Synthetic9;
  valid_pairs_count?: ValidPairsCount1;
}
export interface C4CounterfactualListResponse {
  development_only?: DevelopmentOnly11;
  items: Items;
  limit: Limit1;
  offset: Offset1;
  schema_version?: SchemaVersion12;
  synthetic?: Synthetic12;
  total: Total;
}
export interface C4CounterfactualSummary {
  best_edit_count?: BestEditCount;
  candidate_count: CandidateCount;
  counterfactual_id: CounterfactualId;
  created_at: CreatedAt2;
  development_only?: DevelopmentOnly12;
  is_development?: IsDevelopment;
  original_predicted_class?: OriginalPredictedClass;
  outcome: Outcome;
  schema_version?: SchemaVersion11;
  source_reference?: SourceReference1;
  synthetic?: Synthetic11;
  target_class: TargetClass1;
}
export interface C4CounterfactualRequest {
  development_only?: DevelopmentOnly13;
  edit_mode?: EditMode;
  idempotency_key?: IdempotencyKey;
  language?: Language4;
  locked_spans?: LockedSpans;
  max_candidates?: MaxCandidates;
  max_edits?: MaxEdits;
  schema_version?: SchemaVersion14;
  source_reference?: SourceReference2;
  synthetic?: Synthetic14;
  target_class: TargetClass2;
  text: Text2;
}
export interface TextSpanLock {
  development_only?: DevelopmentOnly14;
  end: End;
  schema_version?: SchemaVersion13;
  start: Start;
  synthetic?: Synthetic13;
  text?: Text1;
}
export interface C4CounterfactualResponse {
  best_candidate?: CounterfactualCandidate | null;
  candidates?: Candidates;
  counterfactual_id?: CounterfactualId1;
  created_at?: CreatedAt4;
  development_only?: DevelopmentOnly19;
  evaluated_candidate_count?: EvaluatedCandidateCount;
  execution_time_ms?: ExecutionTimeMs;
  is_development?: IsDevelopment1;
  model_id?: ModelId;
  model_revision?: ModelRevision2;
  model_version?: ModelVersion;
  non_diagnostic_notice?: NonDiagnosticNotice2;
  original_predicted_class?: OriginalPredictedClass1;
  original_probabilities?: OriginalProbabilities;
  outcome?: Outcome1;
  outcome_message: OutcomeMessage;
  request_hash?: RequestHash;
  schema_version?: SchemaVersion19;
  search_limits?: SearchLimits;
  source_reference?: SourceReference3;
  stopping_reason?: StoppingReason;
  successful_candidate_count?: SuccessfulCandidateCount;
  supported_languages?: SupportedLanguages;
  synthetic?: Synthetic19;
  target_class: TargetClass3;
}
export interface CounterfactualCandidate {
  candidate_id?: CandidateId;
  candidate_text?: CandidateText;
  development_only?: DevelopmentOnly15;
  diff_spans?: DiffSpans;
  edit_count: EditCount;
  edits?: Edits;
  feedback?: CounterfactualFeedback | null;
  minimality_description?: MinimalityDescription;
  minimality_rank?: MinimalityRank;
  predicted_class: PredictedClass;
  probabilities: Probabilities;
  schema_version?: SchemaVersion18;
  synthetic?: Synthetic18;
  target_probability: TargetProbability;
  target_probability_delta: TargetProbabilityDelta;
  verified?: Verified;
}
export interface TextSpanDiff {
  development_only?: DevelopmentOnly16;
  original_text?: OriginalText;
  schema_version?: SchemaVersion15;
  synthetic?: Synthetic15;
  text: Text3;
  type: Type;
}
export interface EditOperation {
  development_only?: DevelopmentOnly17;
  end_offset?: EndOffset;
  index: Index;
  op: Op;
  original?: Original;
  replacement?: Replacement;
  schema_version?: SchemaVersion16;
  start_offset?: StartOffset;
  synthetic?: Synthetic16;
}
export interface CounterfactualFeedback {
  candidate_id: CandidateId1;
  comment?: Comment;
  context_preserved?: ContextPreserved;
  created_at?: CreatedAt3;
  development_only?: DevelopmentOnly18;
  feedback_id?: FeedbackId;
  natural_wording?: NaturalWording;
  reviewer_id?: ReviewerId;
  schema_version?: SchemaVersion17;
  synthetic?: Synthetic17;
  updated_at?: UpdatedAt;
  useful?: Useful;
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
  development_only?: DevelopmentOnly20;
  language?: Language5;
  schema_version?: SchemaVersion20;
  synthetic?: Synthetic20;
  text: Text4;
}
export interface C4EncoderCheckResponse {
  development_only?: DevelopmentOnly21;
  embedding_shape: EmbeddingShape;
  encoder_executed?: EncoderExecuted;
  hidden_dimension?: HiddenDimension;
  model_id?: ModelId1;
  schema_version?: SchemaVersion21;
  status_message?: StatusMessage;
  synthetic?: Synthetic21;
  token_count: TokenCount;
  truncated: Truncated;
}
export interface C4ExplanationListResponse {
  development_only?: DevelopmentOnly22;
  items: Items1;
  limit: Limit2;
  offset: Offset2;
  schema_version?: SchemaVersion23;
  synthetic?: Synthetic23;
  total: Total1;
}
export interface C4ExplanationSummary {
  created_at: CreatedAt5;
  development_only?: DevelopmentOnly23;
  explanation_id: ExplanationId1;
  is_development?: IsDevelopment2;
  method: Method1;
  predicted_class?: PredictedClass1;
  schema_version?: SchemaVersion22;
  source_reference?: SourceReference4;
  synthetic?: Synthetic22;
  target_class: TargetClass4;
  target_class_probability?: TargetClassProbability;
}
export interface C4ExplanationRequest {
  development_only?: DevelopmentOnly24;
  idempotency_key?: IdempotencyKey1;
  language?: Language6;
  method: Method2;
  schema_version?: SchemaVersion24;
  source_reference?: SourceReference5;
  synthetic?: Synthetic24;
  target_class?: TargetClass5;
  text: Text5;
}
export interface C4ExplanationResponse {
  additivity_discrepancy_message?: AdditivityDiscrepancyMessage;
  additivity_residual?: AdditivityResidual;
  additivity_within_tolerance?: AdditivityWithinTolerance;
  base_value?: BaseValue;
  computation_bounds?: ComputationBounds;
  contributions?: Contributions;
  created_at?: CreatedAt6;
  development_only?: DevelopmentOnly26;
  diagnostics?: Diagnostics;
  explanation_id?: ExplanationId2;
  is_development?: IsDevelopment3;
  method: Method3;
  model_id?: ModelId2;
  model_revision?: ModelRevision3;
  model_version?: ModelVersion1;
  output_value?: OutputValue;
  predicted_class?: PredictedClass2;
  probabilities?: Probabilities1;
  reconstructed_output?: ReconstructedOutput;
  schema_version?: SchemaVersion26;
  source_reference?: SourceReference6;
  status?: Status2;
  status_message: StatusMessage1;
  synthetic?: Synthetic26;
  target_class?: TargetClass6;
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
  development_only?: DevelopmentOnly25;
  direction: Direction;
  schema_version?: SchemaVersion25;
  synthetic?: Synthetic25;
  token: Token;
  weight: Weight;
}
export interface Diagnostics {
  [k: string]: number | string | boolean;
}
export interface Probabilities1 {
  [k: string]: number;
}
export interface C4FaithfulnessListResponse {
  development_only?: DevelopmentOnly27;
  items: Items2;
  limit: Limit3;
  offset: Offset3;
  schema_version?: SchemaVersion28;
  synthetic?: Synthetic28;
  total: Total2;
}
export interface C4FaithfulnessSummary {
  aopc?: Aopc;
  baseline_probability: BaselineProbability;
  created_at: CreatedAt7;
  development_only?: DevelopmentOnly28;
  evaluation_id: EvaluationId;
  explained_class: ExplainedClass2;
  explanation_id: ExplanationId3;
  is_development?: IsDevelopment4;
  method: Method4;
  outcome: Outcome2;
  schema_version?: SchemaVersion27;
  source_reference?: SourceReference7;
  synthetic?: Synthetic27;
}
export interface C4FaithfulnessOccurrence {
  development_only?: DevelopmentOnly29;
  end: End1;
  occurrence_id: OccurrenceId;
  rank: Rank;
  schema_version?: SchemaVersion29;
  start: Start1;
  synthetic?: Synthetic29;
  weight: Weight1;
  word: Word;
}
export interface C4FaithfulnessRequest {
  development_only?: DevelopmentOnly30;
  explanation_id: ExplanationId4;
  idempotency_key?: IdempotencyKey2;
  language?: Language7;
  max_removal_pct?: MaxRemovalPct;
  max_removal_words?: MaxRemovalWords;
  random_trials?: RandomTrials;
  schema_version?: SchemaVersion30;
  seed?: Seed;
  source_reference?: SourceReference8;
  synthetic?: Synthetic30;
  text: Text6;
}
export interface C4FaithfulnessResponse {
  aopc?: Aopc1;
  baseline_probability: BaselineProbability1;
  budget_evaluated?: BudgetEvaluated;
  budget_requested?: BudgetRequested;
  completed_steps?: CompletedSteps;
  completed_trials?: CompletedTrials;
  created_at?: CreatedAt8;
  development_only?: DevelopmentOnly31;
  evaluation_id?: EvaluationId1;
  execution_time_ms?: ExecutionTimeMs1;
  explained_class: ExplainedClass3;
  explanation_id: ExplanationId5;
  final_comprehensiveness_drop?: FinalComprehensivenessDrop;
  final_difference_from_random?: FinalDifferenceFromRandom;
  final_random_mean_drop?: FinalRandomMeanDrop;
  final_sufficiency_gap?: FinalSufficiencyGap;
  is_development?: IsDevelopment5;
  method: Method5;
  model_id?: ModelId3;
  model_revision?: ModelRevision4;
  model_version?: ModelVersion2;
  non_diagnostic_notice?: NonDiagnosticNotice3;
  outcome?: Outcome3;
  outcome_message: OutcomeMessage1;
  ranked_words?: RankedWords;
  saved?: Saved;
  schema_version?: SchemaVersion31;
  seed?: Seed1;
  source_reference?: SourceReference9;
  steps?: Steps;
  stopping_reason?: StoppingReason1;
  synthetic?: Synthetic32;
  total_eligible_words?: TotalEligibleWords;
  total_inferences?: TotalInferences;
}
export interface C4FaithfulnessStepResult {
  comprehensiveness_drop: ComprehensivenessDrop;
  development_only?: DevelopmentOnly32;
  difference_from_random?: DifferenceFromRandom;
  keep_remaining_probability?: KeepRemainingProbability;
  modified_text?: ModifiedText;
  random_mean_drop?: RandomMeanDrop;
  random_mean_probability?: RandomMeanProbability;
  random_std_drop?: RandomStdDrop;
  random_trial_count?: RandomTrialCount;
  remaining_probability: RemainingProbability;
  removed_occurrence_ids?: RemovedOccurrenceIds;
  removed_words?: RemovedWords;
  schema_version?: SchemaVersion32;
  step: Step;
  sufficiency_gap?: SufficiencyGap;
  synthetic?: Synthetic31;
}
export interface C4InternalFaithfulnessRequest {
  contributions?: Contributions1;
  development_only?: DevelopmentOnly33;
  explained_class: ExplainedClass4;
  explanation_id: ExplanationId6;
  language?: Language8;
  max_removal_pct?: MaxRemovalPct1;
  max_removal_words?: MaxRemovalWords1;
  method: Method6;
  model_revision?: ModelRevision5;
  random_trials?: RandomTrials1;
  schema_version?: SchemaVersion33;
  seed?: Seed2;
  synthetic?: Synthetic33;
  target_class_probability?: TargetClassProbability2;
  text: Text7;
  tokens?: Tokens1;
  weights?: Weights1;
}
export interface C4InternalStabilityRequest {
  base_seed?: BaseSeed;
  development_only?: DevelopmentOnly34;
  explained_class: ExplainedClass5;
  explainer_evals?: ExplainerEvals;
  explanation_id: ExplanationId7;
  language?: Language9;
  method: Method7;
  model_revision?: ModelRevision6;
  run_count?: RunCount;
  schema_version?: SchemaVersion34;
  synthetic?: Synthetic34;
  target_class_probability?: TargetClassProbability3;
  text: Text8;
  top_k?: TopK;
}
export interface C4ManualEvaluationRequest {
  development_only?: DevelopmentOnly35;
  edited_text: EditedText;
  language?: Language10;
  original_text: OriginalText1;
  schema_version?: SchemaVersion35;
  synthetic?: Synthetic35;
  target_class: TargetClass7;
}
export interface C4ManualEvaluationResponse {
  development_only?: DevelopmentOnly36;
  diff_spans?: DiffSpans1;
  edit_count: EditCount1;
  edited_predicted_class: EditedPredictedClass;
  edited_probabilities?: EditedProbabilities;
  edits?: Edits1;
  execution_time_ms?: ExecutionTimeMs2;
  flip_status_label: FlipStatusLabel;
  is_flip: IsFlip;
  model_id?: ModelId4;
  model_revision?: ModelRevision7;
  model_version?: ModelVersion3;
  non_diagnostic_notice?: NonDiagnosticNotice4;
  original_predicted_class: OriginalPredictedClass2;
  original_probabilities?: OriginalProbabilities1;
  schema_version?: SchemaVersion36;
  synthetic?: Synthetic36;
  target_class: TargetClass8;
  target_probability_after: TargetProbabilityAfter;
  target_probability_before: TargetProbabilityBefore;
  target_probability_delta: TargetProbabilityDelta1;
}
export interface EditedProbabilities {
  [k: string]: number;
}
export interface OriginalProbabilities1 {
  [k: string]: number;
}
export interface C4PredictionRequest {
  development_only?: DevelopmentOnly37;
  language?: Language11;
  schema_version?: SchemaVersion37;
  synthetic?: Synthetic37;
  text: Text9;
}
export interface C4PredictionResponse {
  confidence: Confidence;
  development_only?: DevelopmentOnly38;
  max_sequence_length?: MaxSequenceLength;
  model_id?: ModelId5;
  model_revision?: ModelRevision8;
  model_version?: ModelVersion4;
  predicted_sentiment: PredictedSentiment;
  probabilities: Probabilities2;
  schema_version?: SchemaVersion38;
  status?: Status3;
  status_message?: StatusMessage2;
  synthetic?: Synthetic38;
  token_count: TokenCount2;
  truncated: Truncated2;
}
export interface Probabilities2 {
  [k: string]: number;
}
export interface C4StabilityListResponse {
  development_only?: DevelopmentOnly39;
  items: Items3;
  limit: Limit4;
  offset: Offset4;
  schema_version?: SchemaVersion40;
  synthetic?: Synthetic40;
  total: Total3;
}
export interface C4StabilitySummary {
  completed_runs: CompletedRuns;
  created_at: CreatedAt9;
  development_only?: DevelopmentOnly40;
  evaluation_id: EvaluationId2;
  explained_class: ExplainedClass6;
  explanation_id: ExplanationId8;
  is_development?: IsDevelopment6;
  mean_attribution_std?: MeanAttributionStd;
  mean_rank_correlation?: MeanRankCorrelation;
  mean_top_k_overlap?: MeanTopKOverlap;
  method: Method8;
  outcome: Outcome4;
  requested_runs: RequestedRuns;
  schema_version?: SchemaVersion39;
  source_reference?: SourceReference10;
  synthetic?: Synthetic39;
}
export interface C4StabilityRequest {
  base_seed?: BaseSeed1;
  development_only?: DevelopmentOnly41;
  explainer_evals?: ExplainerEvals1;
  explanation_id: ExplanationId9;
  idempotency_key?: IdempotencyKey3;
  language?: Language12;
  run_count?: RunCount1;
  schema_version?: SchemaVersion41;
  source_reference?: SourceReference11;
  synthetic?: Synthetic41;
  text: Text10;
  top_k?: TopK1;
}
export interface C4StabilityResponse {
  baseline_probability: BaselineProbability2;
  completed_runs?: CompletedRuns1;
  created_at?: CreatedAt10;
  determinism_notice?: DeterminismNotice;
  development_only?: DevelopmentOnly42;
  effective_k?: EffectiveK1;
  evaluation_id?: EvaluationId3;
  execution_time_ms?: ExecutionTimeMs3;
  explained_class: ExplainedClass7;
  explainer_version?: ExplainerVersion;
  explanation_id: ExplanationId10;
  is_deterministic?: IsDeterministic;
  is_development?: IsDevelopment7;
  mean_attribution_std?: MeanAttributionStd1;
  mean_rank_correlation?: MeanRankCorrelation1;
  mean_top_k_overlap?: MeanTopKOverlap1;
  method: Method9;
  model_id?: ModelId6;
  model_revision?: ModelRevision9;
  model_version?: ModelVersion5;
  non_diagnostic_notice?: NonDiagnosticNotice5;
  outcome?: Outcome5;
  outcome_message: OutcomeMessage2;
  requested_runs?: RequestedRuns1;
  runs?: Runs;
  saved?: Saved1;
  schema_version?: SchemaVersion43;
  source_reference?: SourceReference12;
  stopping_reason?: StoppingReason2;
  synthetic?: Synthetic43;
  total_eligible_words?: TotalEligibleWords1;
  word_consistency?: WordConsistency;
}
export interface C4StabilityRunResult {
  development_only?: DevelopmentOnly43;
  error_message?: ErrorMessage;
  execution_time_ms?: ExecutionTimeMs4;
  is_reference?: IsReference;
  rank_correlation?: RankCorrelation;
  run_index: RunIndex;
  schema_version?: SchemaVersion42;
  seed?: Seed3;
  status?: Status4;
  synthetic?: Synthetic42;
  top_k_ids?: TopKIds;
  top_k_overlap?: TopKOverlap;
  weights?: Weights2;
}
export interface Weights2 {
  [k: string]: number;
}
export interface C4StabilityWordConsistency {
  development_only?: DevelopmentOnly44;
  end: End2;
  mean_weight: MeanWeight;
  occurrence_id: OccurrenceId1;
  run_occurrence_count: RunOccurrenceCount;
  schema_version?: SchemaVersion44;
  start: Start2;
  std_dev?: StdDev;
  synthetic?: Synthetic44;
  top_k_frequency: TopKFrequency;
  word?: Word1;
}
export interface ConsentDecision {
  consent_status: ConsentStatus;
  consent_version?: ConsentVersion;
  development_only?: DevelopmentOnly45;
  purpose?: Purpose;
  schema_version?: SchemaVersion45;
  synthetic?: Synthetic45;
}
export interface ConsentLifecycle {
  case?: PseudonymousCase | null;
  consent: ConsentRecord;
  development_only?: DevelopmentOnly48;
  disposal_reason?: DisposalReason;
  explicitly_withdrawn_at?: ExplicitlyWithdrawnAt;
  schema_version?: SchemaVersion48;
  synthetic?: Synthetic48;
}
export interface PseudonymousCase {
  case_id: CaseId1;
  correlation_id: CorrelationId1;
  created_at: CreatedAt11;
  development_only?: DevelopmentOnly46;
  error_code?: ErrorCode | null;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion46;
  synthetic?: Synthetic46;
  updated_at: UpdatedAt1;
}
export interface ConsentRecord {
  consent_id: ConsentId;
  consent_status: ConsentState;
  consent_version: ConsentVersion1;
  created_at: CreatedAt12;
  development_only?: DevelopmentOnly47;
  expires_at: ExpiresAt;
  purpose: Purpose1;
  schema_version?: SchemaVersion47;
  synthetic?: Synthetic47;
}
export interface CounterfactualFeedbackRequest {
  candidate_id: CandidateId2;
  comment?: Comment1;
  context_preserved?: ContextPreserved1;
  development_only?: DevelopmentOnly49;
  natural_wording?: NaturalWording1;
  schema_version?: SchemaVersion49;
  synthetic?: Synthetic49;
  useful?: Useful1;
}
export interface ExplanationRequest {
  case_id: CaseId2;
  consent_status?: ConsentStatus1;
  consent_version?: ConsentVersion2;
  correlation_id: CorrelationId2;
  development_only?: DevelopmentOnly50;
  idempotency_key: IdempotencyKey4;
  inference: InferenceResponse;
  preprocessing: PreprocessResponse;
  purpose?: Purpose4;
  schema_version?: SchemaVersion52;
  synthetic?: Synthetic52;
}
export interface InferenceResponse {
  calibrated?: Calibrated;
  case_id: CaseId3;
  confidence: Confidence1;
  consent_status?: ConsentStatus2;
  consent_version?: ConsentVersion3;
  correlation_id: CorrelationId3;
  dataset_version?: DatasetVersion;
  development_only?: DevelopmentOnly51;
  emotional_tone?: EmotionalTone;
  idempotency_key: IdempotencyKey5;
  model_version?: ModelVersion6;
  purpose?: Purpose2;
  review_priority?: ReviewPriority;
  schema_version?: SchemaVersion50;
  service_name?: ServiceName1;
  service_version?: ServiceVersion1;
  stress_language_signals: StressLanguageSignals;
  synthetic?: Synthetic50;
  wellbeing_indicator?: WellbeingIndicator;
}
export interface PreprocessResponse {
  anonymized_text: AnonymizedText;
  case_id: CaseId4;
  consent_status?: ConsentStatus3;
  consent_version?: ConsentVersion4;
  correlation_id: CorrelationId4;
  dataset_version?: DatasetVersion1;
  development_only?: DevelopmentOnly52;
  idempotency_key: IdempotencyKey6;
  language: Language13;
  normalized_text: NormalizedText;
  pipeline_version?: PipelineVersion;
  purpose?: Purpose3;
  schema_version?: SchemaVersion51;
  service_name?: ServiceName2;
  service_version?: ServiceVersion2;
  synthetic?: Synthetic51;
  token_offsets: TokenOffsets;
  tokens: Tokens2;
  transformations: Transformations;
}
export interface ExplanationResponse {
  case_id: CaseId5;
  consent_status?: ConsentStatus4;
  consent_version?: ConsentVersion5;
  correlation_id: CorrelationId5;
  counterfactual?: Counterfactual;
  development_only?: DevelopmentOnly53;
  evidence: Evidence;
  explainer_version?: ExplainerVersion1;
  faithfulness?: Faithfulness;
  idempotency_key: IdempotencyKey7;
  method?: Method10;
  purpose?: Purpose5;
  reliability_status?: ReliabilityStatus;
  schema_version?: SchemaVersion53;
  service_name?: ServiceName3;
  service_version?: ServiceVersion3;
  stability?: Stability;
  synthetic?: Synthetic53;
}
export interface FixturesResponse {
  development_only?: DevelopmentOnly54;
  fixtures: Fixtures;
  schema_version?: SchemaVersion54;
  synthetic?: Synthetic54;
}
export interface Fixtures {
  [k: string]: string;
}
export interface HealthResponse {
  development_only?: DevelopmentOnly55;
  schema_version?: SchemaVersion55;
  service_name: ServiceName4;
  status: Status5;
  synthetic?: Synthetic55;
}
export interface HumanReviewAction {
  action: Action;
  development_only?: DevelopmentOnly56;
  idempotency_key: IdempotencyKey8;
  schema_version?: SchemaVersion56;
  synthetic?: Synthetic56;
}
export interface InferenceRequest {
  case_id: CaseId6;
  consent_status?: ConsentStatus5;
  consent_version?: ConsentVersion6;
  correlation_id: CorrelationId6;
  development_only?: DevelopmentOnly57;
  idempotency_key: IdempotencyKey9;
  preprocessing: PreprocessResponse;
  purpose?: Purpose6;
  schema_version?: SchemaVersion57;
  synthetic?: Synthetic57;
}
export interface LifecycleAuditEvent {
  case_id?: CaseId7;
  correlation_id: CorrelationId7;
  created_at?: CreatedAt13;
  development_only?: DevelopmentOnly58;
  event_id?: EventId1;
  event_type: EventType1;
  policy_expires_at?: PolicyExpiresAt;
  schema_version?: SchemaVersion58;
  service_name?: ServiceName5;
  service_version?: ServiceVersion4;
  status: Status6;
  synthetic?: Synthetic58;
  trace_id?: TraceId;
}
export interface LoginRequest {
  development_only?: DevelopmentOnly59;
  password: Password;
  schema_version?: SchemaVersion59;
  synthetic?: Synthetic59;
  username: Username;
}
export interface PreprocessRequest {
  case_id: CaseId8;
  consent_status?: ConsentStatus6;
  consent_version?: ConsentVersion7;
  correlation_id: CorrelationId8;
  development_only?: DevelopmentOnly60;
  idempotency_key: IdempotencyKey10;
  purpose?: Purpose7;
  schema_version?: SchemaVersion60;
  synthetic?: Synthetic60;
  text: Text11;
}
export interface RetentionAction {
  action: Action1;
  action_id: ActionId;
  case_id: CaseId9;
  created_at: CreatedAt14;
  development_only?: DevelopmentOnly61;
  schema_version?: SchemaVersion61;
  status: Status7;
  synthetic?: Synthetic61;
}
export interface ReviewTask {
  case: PseudonymousCase;
  development_only?: DevelopmentOnly62;
  explanation: ExplanationResponse;
  human_review_required?: HumanReviewRequired;
  inference: InferenceResponse;
  preprocessing?: PreprocessResponse | null;
  schema_version?: SchemaVersion62;
  synthetic?: Synthetic62;
  task_id: TaskId;
}
export interface ServiceContext {
  case_id: CaseId10;
  consent_status?: ConsentStatus7;
  consent_version?: ConsentVersion8;
  correlation_id: CorrelationId9;
  development_only?: DevelopmentOnly63;
  idempotency_key: IdempotencyKey11;
  purpose?: Purpose8;
  schema_version?: SchemaVersion63;
  synthetic?: Synthetic63;
}
export interface ServiceError {
  correlation_id: CorrelationId10;
  development_only?: DevelopmentOnly64;
  error_code: ErrorCode;
  message?: Message;
  schema_version?: SchemaVersion64;
  synthetic?: Synthetic64;
}
export interface ServiceProvenance {
  correlation_id: CorrelationId11;
  development_only?: DevelopmentOnly65;
  explainer_version: ExplainerVersion2;
  model_dataset_version: ModelDatasetVersion;
  model_version: ModelVersion7;
  nlp_service_version: NlpServiceVersion;
  pipeline_version: PipelineVersion1;
  preprocessing_dataset_version: PreprocessingDatasetVersion;
  preprocessing_service_version: PreprocessingServiceVersion;
  schema_version?: SchemaVersion65;
  synthetic?: Synthetic65;
  xai_service_version: XaiServiceVersion;
}
export interface SubmissionSession {
  development_only?: DevelopmentOnly66;
  expires_at: ExpiresAt1;
  role: Role;
  schema_version?: SchemaVersion66;
  session_id: SessionId;
  synthetic?: Synthetic66;
}
export interface VersionResponse {
  development_only?: DevelopmentOnly67;
  mode: Mode;
  schema_version?: SchemaVersion67;
  service_name: ServiceName6;
  service_version?: ServiceVersion5;
  synthetic?: Synthetic67;
}
export interface WithdrawalRequest {
  development_only?: DevelopmentOnly68;
  idempotency_key: IdempotencyKey12;
  schema_version?: SchemaVersion68;
  synthetic?: Synthetic68;
}
export interface WorkflowExecution {
  attempts?: Attempts;
  case_id: CaseId11;
  correlation_id: CorrelationId12;
  created_at: CreatedAt15;
  development_only?: DevelopmentOnly69;
  error_code?: ErrorCode | null;
  idempotency_key: IdempotencyKey13;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion69;
  synthetic?: Synthetic69;
  updated_at: UpdatedAt2;
}
export interface WorkflowRequest {
  consent_id: ConsentId1;
  development_only?: DevelopmentOnly70;
  fixture_id: FixtureId;
  idempotency_key: IdempotencyKey14;
  schema_version?: SchemaVersion70;
  synthetic?: Synthetic70;
  text: Text12;
}
