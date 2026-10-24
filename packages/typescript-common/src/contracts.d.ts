// GENERATED from authoritative Python contracts via JSON Schema. Do not edit.

export type Contracts =
  | AccountResponse
  | AdminAnalytics
  | AdminAuditItem
  | AdminAuditPage
  | AdminCaseOperations
  | AdminCasePage
  | AdminCaseSummary
  | AdminOverview
  | AssignmentChangeRequest
  | AssignmentRequest
  | AuditEvent
  | CaseStatusCount
  | ComponentDirectory
  | ComponentRoute
  | ConsentDecision
  | ConsentLifecycle
  | ConsentRecord
  | CounsellorReviewRecord
  | DemoEvidence
  | DemoReceipt
  | DemoRun
  | DemoRunPage
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
  | ReviewQueueItem
  | ReviewQueuePage
  | ReviewRecordRequest
  | ReviewTask
  | ServiceContext
  | ServiceError
  | ServiceProvenance
  | StaffPage
  | StaffSummary
  | StaffUpdateRequest
  | SubmissionCount
  | SubmissionSession
  | VersionResponse
  | WithdrawalRequest
  | WorkflowExecution
  | WorkflowRequest
  | WorkloadCount;
export type AccountId = string;
export type DevelopmentOnly = true;
export type Role = "STUDENT" | "COUNSELLOR" | "ADMIN" | "RESEARCHER" | "SERVICE";
export type SchemaVersion = "1.0.0";
export type Synthetic = true;
export type DevelopmentOnly1 = true;
export type Interval = "day" | "week";
export type ObservedAt = string;
export type SchemaVersion1 = "1.0.0";
export type Since = string;
/**
 * @maxItems 11
 */
export type Statuses =
  | []
  | [CaseStatusCount]
  | [CaseStatusCount, CaseStatusCount]
  | [CaseStatusCount, CaseStatusCount, CaseStatusCount]
  | [CaseStatusCount, CaseStatusCount, CaseStatusCount, CaseStatusCount]
  | [CaseStatusCount, CaseStatusCount, CaseStatusCount, CaseStatusCount, CaseStatusCount]
  | [CaseStatusCount, CaseStatusCount, CaseStatusCount, CaseStatusCount, CaseStatusCount, CaseStatusCount]
  | [
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount
    ]
  | [
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount
    ]
  | [
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount
    ]
  | [
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount
    ]
  | [
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount,
      CaseStatusCount
    ];
export type Cases = number;
export type DevelopmentOnly2 = true;
export type SchemaVersion2 = "1.0.0";
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
export type Synthetic1 = true;
export type BucketStart = string;
export type Cases1 = number;
export type DevelopmentOnly3 = true;
export type SchemaVersion3 = "1.0.0";
export type Synthetic2 = true;
/**
 * @maxItems 367
 */
export type Submissions = SubmissionCount[];
export type Synthetic3 = true;
export type Timezone = "UTC";
export type TotalCases = number;
export type Until = string;
export type Cases2 = number;
export type CounsellorId = string | null;
export type DevelopmentOnly4 = true;
export type DisplayName = string;
export type SchemaVersion4 = "1.0.0";
export type Synthetic4 = true;
/**
 * @maxItems 21
 */
export type Workload = WorkloadCount[];
export type WorkloadAssignmentPairs = number;
export type CaseId = string | null;
export type CorrelationId = string;
export type DevelopmentOnly5 = true;
export type EventId = string;
export type AdminEventType =
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
  | "ASSIGNMENT"
  | "ADMIN_EVIDENCE_ACCESS"
  | "STAFF_ADMINISTRATION";
export type OccurredAt = string;
export type Outcome = string;
export type PolicyExpiresAt = string | null;
export type SchemaVersion5 = "1.0.0";
export type ServiceVersion = "0.1.0";
export type Synthetic5 = true;
export type CaseId1 = string;
export type DevelopmentOnly6 = true;
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
export type CorrelationId1 = string;
export type DevelopmentOnly7 = true;
export type ExplainerVersion = "mock-1";
export type ModelDatasetVersion = "synthetic-fixtures-1";
export type ModelVersion = "mock-1";
export type NlpServiceVersion = "0.1.0";
export type PipelineVersion = "mock-1";
export type PreprocessingDatasetVersion = "synthetic-fixtures-1";
export type PreprocessingServiceVersion = "0.1.0";
export type SchemaVersion6 = "1.0.0";
export type Synthetic6 = true;
export type XaiServiceVersion = "0.1.0";
export type RetentionReason = ("RETENTION" | "OWNER_WITHDRAWAL" | "LEGACY_DISPOSAL") | null;
export type SchemaVersion7 = "1.0.0";
export type Synthetic7 = true;
export type DevelopmentOnly8 = true;
/**
 * @maxItems 50
 */
export type Items = AdminAuditItem[];
export type NextCursor = string | null;
export type ObservedAt1 = string;
export type Provider = "MOCK_SYNTHETIC_DEVELOPMENT_ONLY";
export type SchemaVersion8 = "1.0.0";
export type Synthetic8 = true;
export type DevelopmentOnly9 = true;
/**
 * @maxItems 20
 */
export type Items1 =
  | []
  | [AdminCaseSummary]
  | [AdminCaseSummary, AdminCaseSummary]
  | [AdminCaseSummary, AdminCaseSummary, AdminCaseSummary]
  | [AdminCaseSummary, AdminCaseSummary, AdminCaseSummary, AdminCaseSummary]
  | [AdminCaseSummary, AdminCaseSummary, AdminCaseSummary, AdminCaseSummary, AdminCaseSummary]
  | [AdminCaseSummary, AdminCaseSummary, AdminCaseSummary, AdminCaseSummary, AdminCaseSummary, AdminCaseSummary]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ]
  | [
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary,
      AdminCaseSummary
    ];
export type AssignmentCount = number;
export type AssignmentEligible = boolean;
export type AssignmentState = "AWAITING_ASSIGNMENT" | "ASSIGNED" | "NOT_ELIGIBLE";
export type AssignmentVersion = string;
export type Attempts = number;
export type CaseId2 = string;
/**
 * @maxItems 20
 */
export type Counsellors =
  | []
  | [StaffSummary]
  | [StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ];
export type AccountId1 = string;
export type CreatedAt = string;
export type DevelopmentOnly10 = true;
export type DisplayName1 = string;
export type Enabled = boolean;
export type ExpiresAt = string | null;
export type IsCurrentAccount = boolean;
export type Role1 = "ADMIN" | "COUNSELLOR" | "RESEARCHER";
export type SchemaVersion9 = "1.0.0";
export type Synthetic9 = true;
export type UpdatedAt = string;
export type Usable = boolean;
export type CreatedAt1 = string;
export type DevelopmentOnly11 = true;
export type DisposalReason = ("RETENTION" | "OWNER_WITHDRAWAL" | "LEGACY_DISPOSAL") | null;
export type ExpiresAt1 = string;
export type HumanReviewStatus = "AWAITING_REVIEW" | "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE";
export type JobStatus = ("QUEUED" | "RUNNING" | "DONE" | "CANCELLED" | "DEAD_LETTER") | null;
export type LastAssignmentAt = string | null;
export type SchemaVersion10 = "1.0.0";
export type Synthetic10 = true;
export type UpdatedAt1 = string;
export type NextOffset = number | null;
export type ObservedAt2 = string;
export type SchemaVersion11 = "1.0.0";
export type Synthetic11 = true;
export type ActiveCounsellors = number;
export type AssignedCases = number;
export type AssignmentPolicy = "DESIGNATED_DEVELOPMENT" | "MANUAL";
export type AwaitingAssignment = number;
export type DesignatedCounsellorAvailable = boolean;
export type DevelopmentOnly12 = true;
export type DisposedCases = number;
export type EligibleCases = number;
export type EnabledStaff = number;
export type FailedCases = number;
export type ObservedAt3 = string;
export type PendingJobs = number;
export type RetentionHours = number;
export type SchemaVersion12 = "1.0.0";
export type Synthetic12 = true;
export type CounsellorId1 = string | null;
export type DevelopmentOnly13 = true;
export type ExpectedVersion = string;
export type SchemaVersion13 = "1.0.0";
export type Synthetic13 = true;
export type CounsellorId2 = string;
export type DevelopmentOnly14 = true;
export type SchemaVersion14 = "1.0.0";
export type Synthetic14 = true;
export type CaseId3 = string | null;
export type CorrelationId2 = string;
export type CreatedAt2 = string;
export type DevelopmentOnly15 = true;
export type EventId1 = string;
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
export type SchemaVersion15 = "1.0.0";
export type ServiceName = "orchestrator";
export type ServiceVersion1 = "0.1.0";
export type Status = string;
export type Synthetic15 = true;
export type DevelopmentOnly16 = true;
/**
 * @minItems 3
 * @maxItems 3
 */
export type Items2 = [ComponentRoute, ComponentRoute, ComponentRoute];
export type Component = "C2" | "C3" | "C4";
export type DevelopmentOnly17 = true;
export type Function = "PREPROCESSING" | "INFERENCE" | "EXPLANATION";
export type Provider1 = "MOCK_SYNTHETIC_DEVELOPMENT_ONLY";
export type RouteStatus = "INTERNAL_SERVICE_ONLY";
export type SchemaVersion16 = "1.0.0";
export type Synthetic16 = true;
export type WebPath = null;
export type ObservedAt4 = string;
export type SchemaVersion17 = "1.0.0";
export type Synthetic17 = true;
export type ConsentStatus = "ACTIVE" | "REJECTED";
export type ConsentVersion = "dev-notice-1";
export type DevelopmentOnly18 = true;
export type Purpose = "synthetic-wellbeing-screening";
export type SchemaVersion18 = "1.0.0";
export type Synthetic18 = true;
export type CaseId4 = string;
export type CorrelationId3 = string;
export type CreatedAt3 = string;
export type DevelopmentOnly19 = true;
export type SchemaVersion19 = "1.0.0";
export type Synthetic19 = true;
export type UpdatedAt2 = string;
export type ConsentId = string;
export type ConsentState = "PENDING" | "ACTIVE" | "EXPIRED" | "WITHDRAWN" | "REJECTED" | "INVALID";
export type ConsentVersion1 = string;
export type CreatedAt4 = string;
export type DevelopmentOnly20 = true;
export type ExpiresAt2 = string;
export type Purpose1 = string;
export type SchemaVersion20 = "1.0.0";
export type Synthetic20 = true;
export type DevelopmentOnly21 = true;
export type DisposalReason1 = ("RETENTION" | "OWNER_WITHDRAWAL" | "LEGACY_DISPOSAL") | null;
export type ExplicitlyWithdrawnAt = string | null;
export type SchemaVersion21 = "1.0.0";
export type Synthetic21 = true;
export type DevelopmentOnly22 = true;
export type FollowUp = "NO_FOLLOW_UP_PLANNED" | "DISCUSSION_OFFERED" | "FOLLOW_UP_REQUESTED";
export type Interpretation = string;
export type SavedAt = string;
export type SchemaVersion22 = "1.0.0";
export type Synthetic22 = true;
export type TaskId = string;
export type BlockingObserved = boolean;
export type ConsentPolicyValid = boolean;
export type ConsentRecorded = boolean;
export type DevelopmentOnly23 = true;
export type DisposalConfirmed = boolean;
export type FailureObserved = boolean;
export type ObservedAt5 = string;
export type ProvenanceValidated = boolean;
export type Provider2 = "MOCK_SYNTHETIC_DEVELOPMENT_ONLY";
export type ReceiptOnly = boolean;
export type DevelopmentOnly24 = true;
export type Event =
  | "CONSENT_RECORDED"
  | "CONSENT_EXPIRED"
  | "OPERATION_BLOCKED"
  | "SUBMISSION_REPLAY"
  | "WORKFLOW_TRANSITION"
  | "JOB_RETRY"
  | "JOB_TERMINAL"
  | "HUMAN_REVIEW"
  | "WITHDRAWAL"
  | "RETENTION";
export type OccurredAt1 = string;
export type SchemaVersion23 = "1.0.0";
export type Synthetic23 = true;
/**
 * @maxItems 50
 */
export type Receipts = DemoReceipt[];
export type ReceiptsTruncated = boolean;
export type ReplayObserved = boolean;
export type ReviewCompletedAt = string | null;
export type ReviewRecordSavedAt = string | null;
export type ReviewStartedAt = string | null;
export type ReviewTaskAuthorized = boolean;
export type CaseId5 = string | null;
export type CreatedAt5 = string;
export type DevelopmentOnly25 = true;
export type RunId = string;
export type SchemaVersion24 = "1.0.0";
export type Synthetic24 = true;
export type SchemaVersion25 = "1.0.0";
export type Synthetic25 = true;
export type WithdrawnAt = string | null;
export type DevelopmentOnly26 = true;
export type NextOffset1 = number | null;
/**
 * @maxItems 20
 */
export type Runs =
  | []
  | [DemoRun]
  | [DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun, DemoRun]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ]
  | [
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun,
      DemoRun
    ];
export type SchemaVersion26 = "1.0.0";
export type Synthetic26 = true;
export type CaseId6 = string;
export type ConsentStatus1 = "ACTIVE";
export type ConsentVersion2 = "dev-notice-1";
export type CorrelationId4 = string;
export type DevelopmentOnly27 = true;
export type IdempotencyKey = string;
export type Calibrated = false;
export type CaseId7 = string;
export type Confidence = number;
export type ConsentStatus2 = "ACTIVE";
export type ConsentVersion3 = "dev-notice-1";
export type CorrelationId5 = string;
export type DatasetVersion = "synthetic-fixtures-1";
export type DevelopmentOnly28 = true;
export type EmotionalTone = "synthetic-neutral";
export type IdempotencyKey1 = string;
export type ModelVersion1 = "mock-1";
export type Purpose2 = "synthetic-wellbeing-screening";
export type ReviewPriority = "HUMAN_REVIEW_REQUIRED";
export type SchemaVersion27 = "1.0.0";
export type ServiceName1 = "nlp";
export type ServiceVersion2 = "0.1.0";
export type StressLanguageSignals = "synthetic-busy-timetable"[];
export type Synthetic27 = true;
export type WellbeingIndicator = "synthetic-academic-pressure";
export type AnonymizedText = string;
export type CaseId8 = string;
export type ConsentStatus3 = "ACTIVE";
export type ConsentVersion4 = "dev-notice-1";
export type CorrelationId6 = string;
export type DatasetVersion1 = "synthetic-fixtures-1";
export type DevelopmentOnly29 = true;
export type IdempotencyKey2 = string;
export type Language = "en" | "si" | "romanized-si" | "mixed" | "uncertain";
export type NormalizedText = string;
export type PipelineVersion1 = "mock-1";
export type Purpose3 = "synthetic-wellbeing-screening";
export type SchemaVersion28 = "1.0.0";
export type ServiceName2 = "preprocessing";
export type ServiceVersion3 = "0.1.0";
export type Synthetic28 = true;
export type TokenOffsets = [unknown, unknown][];
export type Tokens = string[];
export type Transformations = string[];
export type Purpose4 = "synthetic-wellbeing-screening";
export type SchemaVersion29 = "1.0.0";
export type Synthetic29 = true;
export type CaseId9 = string;
export type ConsentStatus4 = "ACTIVE";
export type ConsentVersion5 = "dev-notice-1";
export type CorrelationId7 = string;
export type Counterfactual = null;
export type DevelopmentOnly30 = true;
export type Evidence = string[];
export type ExplainerVersion1 = "mock-1";
export type Faithfulness = null;
export type IdempotencyKey3 = string;
export type Method = "MOCK_FIXED_FIXTURE";
export type Purpose5 = "synthetic-wellbeing-screening";
export type ReliabilityStatus = "NOT_EVALUATED";
export type SchemaVersion30 = "1.0.0";
export type ServiceName3 = "xai";
export type ServiceVersion4 = "0.1.0";
export type Stability = null;
export type Synthetic30 = true;
export type DevelopmentOnly31 = true;
export type SchemaVersion31 = "1.0.0";
export type Synthetic31 = true;
export type DevelopmentOnly32 = true;
export type SchemaVersion32 = "1.0.0";
export type ServiceName4 = string;
export type Status1 = "ok" | "unavailable";
export type Synthetic32 = true;
export type Action = "START_REVIEW" | "COMPLETE_REVIEW";
export type DevelopmentOnly33 = true;
export type IdempotencyKey4 = string;
export type SchemaVersion33 = "1.0.0";
export type Synthetic33 = true;
export type CaseId10 = string;
export type ConsentStatus5 = "ACTIVE";
export type ConsentVersion6 = "dev-notice-1";
export type CorrelationId8 = string;
export type DevelopmentOnly34 = true;
export type IdempotencyKey5 = string;
export type Purpose6 = "synthetic-wellbeing-screening";
export type SchemaVersion34 = "1.0.0";
export type Synthetic34 = true;
export type CaseId11 = string | null;
export type CorrelationId9 = string;
export type CreatedAt6 = string;
export type DevelopmentOnly35 = true;
export type EventId2 = string;
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
  | "ASSIGNMENT"
  | "ADMIN_EVIDENCE_ACCESS"
  | "STAFF_ADMINISTRATION";
export type PolicyExpiresAt1 = string | null;
export type SchemaVersion35 = "1.0.0";
export type ServiceName5 = "orchestrator";
export type ServiceVersion5 = "0.1.0";
export type Status2 = string;
export type Synthetic35 = true;
export type TraceId = string | null;
export type DevelopmentOnly36 = true;
export type Password = string;
export type SchemaVersion36 = "1.0.0";
export type Synthetic36 = true;
export type Username = string;
export type CaseId12 = string;
export type ConsentStatus6 = "ACTIVE";
export type ConsentVersion7 = "dev-notice-1";
export type CorrelationId10 = string;
export type DevelopmentOnly37 = true;
export type IdempotencyKey6 = string;
export type Purpose7 = "synthetic-wellbeing-screening";
export type SchemaVersion37 = "1.0.0";
export type Synthetic37 = true;
export type Text = string;
export type Action1 = "DELETE_DERIVED_EVIDENCE" | "EXPIRE_ACCESS";
export type ActionId = string;
export type CaseId13 = string;
export type CreatedAt7 = string;
export type DevelopmentOnly38 = true;
export type SchemaVersion38 = "1.0.0";
export type Status3 = "PENDING" | "COMPLETED" | "FAILED";
export type Synthetic38 = true;
export type Assignment = "ASSIGNED_TO_YOU";
export type DevelopmentOnly39 = true;
export type ReviewCompletedAt1 = string | null;
export type ReviewRecordSavedAt1 = string | null;
export type ReviewStartedAt1 = string | null;
export type SchemaVersion39 = "1.0.0";
export type Synthetic39 = true;
export type TaskId1 = string;
export type DevelopmentOnly40 = true;
/**
 * @maxItems 20
 */
export type Items3 =
  | []
  | [ReviewQueueItem]
  | [ReviewQueueItem, ReviewQueueItem]
  | [ReviewQueueItem, ReviewQueueItem, ReviewQueueItem]
  | [ReviewQueueItem, ReviewQueueItem, ReviewQueueItem, ReviewQueueItem]
  | [ReviewQueueItem, ReviewQueueItem, ReviewQueueItem, ReviewQueueItem, ReviewQueueItem]
  | [ReviewQueueItem, ReviewQueueItem, ReviewQueueItem, ReviewQueueItem, ReviewQueueItem, ReviewQueueItem]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ]
  | [
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem,
      ReviewQueueItem
    ];
export type NextOffset2 = number | null;
export type ObservedAt6 = string;
export type SchemaVersion40 = "1.0.0";
export type Synthetic40 = true;
export type DevelopmentOnly41 = true;
export type FollowUp1 = "NO_FOLLOW_UP_PLANNED" | "DISCUSSION_OFFERED" | "FOLLOW_UP_REQUESTED";
export type IdempotencyKey7 = string;
export type Interpretation1 = string;
export type SchemaVersion41 = "1.0.0";
export type Synthetic41 = true;
export type DevelopmentOnly42 = true;
export type HumanReviewRequired = true;
export type SchemaVersion42 = "1.0.0";
export type Synthetic42 = true;
export type TaskId2 = string;
export type CaseId14 = string;
export type ConsentStatus7 = "ACTIVE";
export type ConsentVersion8 = "dev-notice-1";
export type CorrelationId11 = string;
export type DevelopmentOnly43 = true;
export type IdempotencyKey8 = string;
export type Purpose8 = "synthetic-wellbeing-screening";
export type SchemaVersion43 = "1.0.0";
export type Synthetic43 = true;
export type CorrelationId12 = string;
export type DevelopmentOnly44 = true;
export type Message = "Request could not be completed safely.";
export type SchemaVersion44 = "1.0.0";
export type Synthetic44 = true;
export type DevelopmentOnly45 = true;
/**
 * @maxItems 20
 */
export type Items4 =
  | []
  | [StaffSummary]
  | [StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary, StaffSummary]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ]
  | [
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary,
      StaffSummary
    ];
export type NextOffset3 = number | null;
export type ObservedAt7 = string;
export type SchemaVersion45 = "1.0.0";
export type Synthetic45 = true;
export type DevelopmentOnly46 = true;
export type Enabled1 = boolean;
export type ExpectedUpdatedAt = string;
export type Role2 = "ADMIN" | "COUNSELLOR" | "RESEARCHER";
export type SchemaVersion46 = "1.0.0";
export type Synthetic46 = true;
export type DevelopmentOnly47 = true;
export type ExpiresAt3 = string;
export type SchemaVersion47 = "1.0.0";
export type SessionId = string;
export type Synthetic47 = true;
export type DevelopmentOnly48 = true;
export type Mode = "MOCK_SYNTHETIC_DEVELOPMENT_ONLY" | "SYNTHETIC_DEVELOPMENT_ONLY";
export type SchemaVersion48 = "1.0.0";
export type ServiceName6 = string;
export type ServiceVersion6 = "0.1.0";
export type Synthetic48 = true;
export type DevelopmentOnly49 = true;
export type IdempotencyKey9 = string;
export type SchemaVersion49 = "1.0.0";
export type Synthetic49 = true;
export type Attempts1 = number;
export type CaseId15 = string;
export type CorrelationId13 = string;
export type CreatedAt8 = string;
export type DevelopmentOnly50 = true;
export type IdempotencyKey10 = string;
export type SchemaVersion50 = "1.0.0";
export type Synthetic50 = true;
export type UpdatedAt3 = string;
export type ConsentId1 = string;
export type DevelopmentOnly51 = true;
export type FixtureId = "english" | "sinhala" | "romanized" | "mixed";
export type IdempotencyKey11 = string;
export type SchemaVersion51 = "1.0.0";
export type Synthetic51 = true;
export type Text1 = string;

export interface AccountResponse {
  account_id: AccountId;
  development_only?: DevelopmentOnly;
  role: Role;
  schema_version?: SchemaVersion;
  synthetic?: Synthetic;
}
export interface AdminAnalytics {
  development_only?: DevelopmentOnly1;
  interval: Interval;
  observed_at: ObservedAt;
  schema_version?: SchemaVersion1;
  since: Since;
  statuses: Statuses;
  submissions: Submissions;
  synthetic?: Synthetic3;
  timezone?: Timezone;
  total_cases: TotalCases;
  until: Until;
  workload: Workload;
  workload_assignment_pairs: WorkloadAssignmentPairs;
}
export interface CaseStatusCount {
  cases: Cases;
  development_only?: DevelopmentOnly2;
  schema_version?: SchemaVersion2;
  state: WorkflowState;
  synthetic?: Synthetic1;
}
export interface SubmissionCount {
  bucket_start: BucketStart;
  cases: Cases1;
  development_only?: DevelopmentOnly3;
  schema_version?: SchemaVersion3;
  synthetic?: Synthetic2;
}
export interface WorkloadCount {
  cases: Cases2;
  counsellor_id: CounsellorId;
  development_only?: DevelopmentOnly4;
  display_name: DisplayName;
  schema_version?: SchemaVersion4;
  synthetic?: Synthetic4;
}
export interface AdminAuditItem {
  case_id?: CaseId;
  correlation_id: CorrelationId;
  development_only?: DevelopmentOnly5;
  event_id: EventId;
  event_type: AdminEventType;
  occurred_at: OccurredAt;
  outcome: Outcome;
  policy_expires_at?: PolicyExpiresAt;
  schema_version?: SchemaVersion5;
  service_version?: ServiceVersion;
  synthetic?: Synthetic5;
}
export interface AdminAuditPage {
  case_operations?: AdminCaseOperations | null;
  development_only?: DevelopmentOnly8;
  items: Items;
  next_cursor?: NextCursor;
  observed_at: ObservedAt1;
  provider?: Provider;
  schema_version?: SchemaVersion8;
  synthetic?: Synthetic8;
}
export interface AdminCaseOperations {
  case_id: CaseId1;
  development_only?: DevelopmentOnly6;
  failure_code?: ErrorCode | null;
  processing_status: WorkflowState;
  provenance?: ServiceProvenance | null;
  retention_reason?: RetentionReason;
  schema_version?: SchemaVersion7;
  synthetic?: Synthetic7;
}
export interface ServiceProvenance {
  correlation_id: CorrelationId1;
  development_only?: DevelopmentOnly7;
  explainer_version: ExplainerVersion;
  model_dataset_version: ModelDatasetVersion;
  model_version: ModelVersion;
  nlp_service_version: NlpServiceVersion;
  pipeline_version: PipelineVersion;
  preprocessing_dataset_version: PreprocessingDatasetVersion;
  preprocessing_service_version: PreprocessingServiceVersion;
  schema_version?: SchemaVersion6;
  synthetic?: Synthetic6;
  xai_service_version: XaiServiceVersion;
}
export interface AdminCasePage {
  development_only?: DevelopmentOnly9;
  items: Items1;
  next_offset?: NextOffset;
  observed_at: ObservedAt2;
  schema_version?: SchemaVersion11;
  synthetic?: Synthetic11;
}
export interface AdminCaseSummary {
  assignment_count: AssignmentCount;
  assignment_eligible: AssignmentEligible;
  assignment_state: AssignmentState;
  assignment_version: AssignmentVersion;
  attempts?: Attempts;
  case_id: CaseId2;
  counsellors: Counsellors;
  created_at: CreatedAt1;
  development_only?: DevelopmentOnly11;
  disposal_reason?: DisposalReason;
  expires_at: ExpiresAt1;
  failure_code?: ErrorCode | null;
  human_review_status?: HumanReviewStatus;
  job_status?: JobStatus;
  last_assignment_at?: LastAssignmentAt;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion10;
  synthetic?: Synthetic10;
  updated_at: UpdatedAt1;
}
export interface StaffSummary {
  account_id: AccountId1;
  created_at: CreatedAt;
  development_only?: DevelopmentOnly10;
  display_name: DisplayName1;
  enabled: Enabled;
  expires_at?: ExpiresAt;
  is_current_account?: IsCurrentAccount;
  role: Role1;
  schema_version?: SchemaVersion9;
  synthetic?: Synthetic9;
  updated_at: UpdatedAt;
  usable: Usable;
}
export interface AdminOverview {
  active_counsellors: ActiveCounsellors;
  assigned_cases: AssignedCases;
  assignment_policy: AssignmentPolicy;
  awaiting_assignment: AwaitingAssignment;
  designated_counsellor_available: DesignatedCounsellorAvailable;
  development_only?: DevelopmentOnly12;
  disposed_cases: DisposedCases;
  eligible_cases: EligibleCases;
  enabled_staff: EnabledStaff;
  failed_cases: FailedCases;
  observed_at: ObservedAt3;
  pending_jobs: PendingJobs;
  retention_hours: RetentionHours;
  schema_version?: SchemaVersion12;
  synthetic?: Synthetic12;
}
export interface AssignmentChangeRequest {
  counsellor_id: CounsellorId1;
  development_only?: DevelopmentOnly13;
  expected_version: ExpectedVersion;
  schema_version?: SchemaVersion13;
  synthetic?: Synthetic13;
}
export interface AssignmentRequest {
  counsellor_id: CounsellorId2;
  development_only?: DevelopmentOnly14;
  schema_version?: SchemaVersion14;
  synthetic?: Synthetic14;
}
export interface AuditEvent {
  case_id?: CaseId3;
  correlation_id: CorrelationId2;
  created_at?: CreatedAt2;
  development_only?: DevelopmentOnly15;
  event_id?: EventId1;
  event_type: EventType;
  schema_version?: SchemaVersion15;
  service_name?: ServiceName;
  service_version?: ServiceVersion1;
  status: Status;
  synthetic?: Synthetic15;
}
export interface ComponentDirectory {
  development_only?: DevelopmentOnly16;
  items: Items2;
  observed_at: ObservedAt4;
  schema_version?: SchemaVersion17;
  synthetic?: Synthetic17;
}
export interface ComponentRoute {
  component: Component;
  development_only?: DevelopmentOnly17;
  function: Function;
  provider: Provider1;
  route_status?: RouteStatus;
  schema_version?: SchemaVersion16;
  synthetic?: Synthetic16;
  web_path?: WebPath;
}
export interface ConsentDecision {
  consent_status: ConsentStatus;
  consent_version?: ConsentVersion;
  development_only?: DevelopmentOnly18;
  purpose?: Purpose;
  schema_version?: SchemaVersion18;
  synthetic?: Synthetic18;
}
export interface ConsentLifecycle {
  case?: PseudonymousCase | null;
  consent: ConsentRecord;
  development_only?: DevelopmentOnly21;
  disposal_reason?: DisposalReason1;
  explicitly_withdrawn_at?: ExplicitlyWithdrawnAt;
  schema_version?: SchemaVersion21;
  synthetic?: Synthetic21;
}
export interface PseudonymousCase {
  case_id: CaseId4;
  correlation_id: CorrelationId3;
  created_at: CreatedAt3;
  development_only?: DevelopmentOnly19;
  error_code?: ErrorCode | null;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion19;
  synthetic?: Synthetic19;
  updated_at: UpdatedAt2;
}
export interface ConsentRecord {
  consent_id: ConsentId;
  consent_status: ConsentState;
  consent_version: ConsentVersion1;
  created_at: CreatedAt4;
  development_only?: DevelopmentOnly20;
  expires_at: ExpiresAt2;
  purpose: Purpose1;
  schema_version?: SchemaVersion20;
  synthetic?: Synthetic20;
}
export interface CounsellorReviewRecord {
  development_only?: DevelopmentOnly22;
  follow_up: FollowUp;
  interpretation: Interpretation;
  saved_at: SavedAt;
  schema_version?: SchemaVersion22;
  synthetic?: Synthetic22;
  task_id: TaskId;
}
export interface DemoEvidence {
  blocking_observed: BlockingObserved;
  consent_policy_valid: ConsentPolicyValid;
  consent_recorded: ConsentRecorded;
  development_only?: DevelopmentOnly23;
  disposal_confirmed: DisposalConfirmed;
  failure_observed: FailureObserved;
  observed_at: ObservedAt5;
  provenance_validated: ProvenanceValidated;
  provider?: Provider2;
  receipt_only: ReceiptOnly;
  receipts: Receipts;
  receipts_truncated: ReceiptsTruncated;
  replay_observed: ReplayObserved;
  review_completed_at?: ReviewCompletedAt;
  review_record_saved_at?: ReviewRecordSavedAt;
  review_started_at?: ReviewStartedAt;
  review_task_authorized: ReviewTaskAuthorized;
  run: DemoRun;
  schema_version?: SchemaVersion25;
  synthetic?: Synthetic25;
  withdrawn_at?: WithdrawnAt;
}
export interface DemoReceipt {
  development_only?: DevelopmentOnly24;
  event: Event;
  occurred_at: OccurredAt1;
  schema_version?: SchemaVersion23;
  synthetic?: Synthetic23;
}
export interface DemoRun {
  case_id?: CaseId5;
  consent_status: ConsentState;
  created_at: CreatedAt5;
  development_only?: DevelopmentOnly25;
  processing_status?: WorkflowState | null;
  run_id: RunId;
  schema_version?: SchemaVersion24;
  synthetic?: Synthetic24;
}
export interface DemoRunPage {
  development_only?: DevelopmentOnly26;
  next_offset?: NextOffset1;
  runs: Runs;
  schema_version?: SchemaVersion26;
  synthetic?: Synthetic26;
}
export interface ExplanationRequest {
  case_id: CaseId6;
  consent_status?: ConsentStatus1;
  consent_version?: ConsentVersion2;
  correlation_id: CorrelationId4;
  development_only?: DevelopmentOnly27;
  idempotency_key: IdempotencyKey;
  inference: InferenceResponse;
  preprocessing: PreprocessResponse;
  purpose?: Purpose4;
  schema_version?: SchemaVersion29;
  synthetic?: Synthetic29;
}
export interface InferenceResponse {
  calibrated?: Calibrated;
  case_id: CaseId7;
  confidence: Confidence;
  consent_status?: ConsentStatus2;
  consent_version?: ConsentVersion3;
  correlation_id: CorrelationId5;
  dataset_version?: DatasetVersion;
  development_only?: DevelopmentOnly28;
  emotional_tone?: EmotionalTone;
  idempotency_key: IdempotencyKey1;
  model_version?: ModelVersion1;
  purpose?: Purpose2;
  review_priority?: ReviewPriority;
  schema_version?: SchemaVersion27;
  service_name?: ServiceName1;
  service_version?: ServiceVersion2;
  stress_language_signals: StressLanguageSignals;
  synthetic?: Synthetic27;
  wellbeing_indicator?: WellbeingIndicator;
}
export interface PreprocessResponse {
  anonymized_text: AnonymizedText;
  case_id: CaseId8;
  consent_status?: ConsentStatus3;
  consent_version?: ConsentVersion4;
  correlation_id: CorrelationId6;
  dataset_version?: DatasetVersion1;
  development_only?: DevelopmentOnly29;
  idempotency_key: IdempotencyKey2;
  language: Language;
  normalized_text: NormalizedText;
  pipeline_version?: PipelineVersion1;
  purpose?: Purpose3;
  schema_version?: SchemaVersion28;
  service_name?: ServiceName2;
  service_version?: ServiceVersion3;
  synthetic?: Synthetic28;
  token_offsets: TokenOffsets;
  tokens: Tokens;
  transformations: Transformations;
}
export interface ExplanationResponse {
  case_id: CaseId9;
  consent_status?: ConsentStatus4;
  consent_version?: ConsentVersion5;
  correlation_id: CorrelationId7;
  counterfactual?: Counterfactual;
  development_only?: DevelopmentOnly30;
  evidence: Evidence;
  explainer_version?: ExplainerVersion1;
  faithfulness?: Faithfulness;
  idempotency_key: IdempotencyKey3;
  method?: Method;
  purpose?: Purpose5;
  reliability_status?: ReliabilityStatus;
  schema_version?: SchemaVersion30;
  service_name?: ServiceName3;
  service_version?: ServiceVersion4;
  stability?: Stability;
  synthetic?: Synthetic30;
}
export interface FixturesResponse {
  development_only?: DevelopmentOnly31;
  fixtures: Fixtures;
  schema_version?: SchemaVersion31;
  synthetic?: Synthetic31;
}
export interface Fixtures {
  [k: string]: string;
}
export interface HealthResponse {
  development_only?: DevelopmentOnly32;
  schema_version?: SchemaVersion32;
  service_name: ServiceName4;
  status: Status1;
  synthetic?: Synthetic32;
}
export interface HumanReviewAction {
  action: Action;
  development_only?: DevelopmentOnly33;
  idempotency_key: IdempotencyKey4;
  schema_version?: SchemaVersion33;
  synthetic?: Synthetic33;
}
export interface InferenceRequest {
  case_id: CaseId10;
  consent_status?: ConsentStatus5;
  consent_version?: ConsentVersion6;
  correlation_id: CorrelationId8;
  development_only?: DevelopmentOnly34;
  idempotency_key: IdempotencyKey5;
  preprocessing: PreprocessResponse;
  purpose?: Purpose6;
  schema_version?: SchemaVersion34;
  synthetic?: Synthetic34;
}
export interface LifecycleAuditEvent {
  case_id?: CaseId11;
  correlation_id: CorrelationId9;
  created_at?: CreatedAt6;
  development_only?: DevelopmentOnly35;
  event_id?: EventId2;
  event_type: EventType1;
  policy_expires_at?: PolicyExpiresAt1;
  schema_version?: SchemaVersion35;
  service_name?: ServiceName5;
  service_version?: ServiceVersion5;
  status: Status2;
  synthetic?: Synthetic35;
  trace_id?: TraceId;
}
export interface LoginRequest {
  development_only?: DevelopmentOnly36;
  password: Password;
  schema_version?: SchemaVersion36;
  synthetic?: Synthetic36;
  username: Username;
}
export interface PreprocessRequest {
  case_id: CaseId12;
  consent_status?: ConsentStatus6;
  consent_version?: ConsentVersion7;
  correlation_id: CorrelationId10;
  development_only?: DevelopmentOnly37;
  idempotency_key: IdempotencyKey6;
  purpose?: Purpose7;
  schema_version?: SchemaVersion37;
  synthetic?: Synthetic37;
  text: Text;
}
export interface RetentionAction {
  action: Action1;
  action_id: ActionId;
  case_id: CaseId13;
  created_at: CreatedAt7;
  development_only?: DevelopmentOnly38;
  schema_version?: SchemaVersion38;
  status: Status3;
  synthetic?: Synthetic38;
}
export interface ReviewQueueItem {
  assignment?: Assignment;
  case: PseudonymousCase;
  development_only?: DevelopmentOnly39;
  review_completed_at?: ReviewCompletedAt1;
  review_record_saved_at?: ReviewRecordSavedAt1;
  review_started_at?: ReviewStartedAt1;
  schema_version?: SchemaVersion39;
  synthetic?: Synthetic39;
  task_id: TaskId1;
}
export interface ReviewQueuePage {
  development_only?: DevelopmentOnly40;
  items: Items3;
  next_offset?: NextOffset2;
  observed_at: ObservedAt6;
  schema_version?: SchemaVersion40;
  synthetic?: Synthetic40;
}
export interface ReviewRecordRequest {
  development_only?: DevelopmentOnly41;
  follow_up: FollowUp1;
  idempotency_key: IdempotencyKey7;
  interpretation: Interpretation1;
  schema_version?: SchemaVersion41;
  synthetic?: Synthetic41;
}
export interface ReviewTask {
  case: PseudonymousCase;
  development_only?: DevelopmentOnly42;
  explanation: ExplanationResponse;
  human_review_required?: HumanReviewRequired;
  inference: InferenceResponse;
  schema_version?: SchemaVersion42;
  synthetic?: Synthetic42;
  task_id: TaskId2;
}
export interface ServiceContext {
  case_id: CaseId14;
  consent_status?: ConsentStatus7;
  consent_version?: ConsentVersion8;
  correlation_id: CorrelationId11;
  development_only?: DevelopmentOnly43;
  idempotency_key: IdempotencyKey8;
  purpose?: Purpose8;
  schema_version?: SchemaVersion43;
  synthetic?: Synthetic43;
}
export interface ServiceError {
  correlation_id: CorrelationId12;
  development_only?: DevelopmentOnly44;
  error_code: ErrorCode;
  message?: Message;
  schema_version?: SchemaVersion44;
  synthetic?: Synthetic44;
}
export interface StaffPage {
  development_only?: DevelopmentOnly45;
  items: Items4;
  next_offset?: NextOffset3;
  observed_at: ObservedAt7;
  schema_version?: SchemaVersion45;
  synthetic?: Synthetic45;
}
export interface StaffUpdateRequest {
  development_only?: DevelopmentOnly46;
  enabled: Enabled1;
  expected_updated_at: ExpectedUpdatedAt;
  role: Role2;
  schema_version?: SchemaVersion46;
  synthetic?: Synthetic46;
}
export interface SubmissionSession {
  development_only?: DevelopmentOnly47;
  expires_at: ExpiresAt3;
  role: Role;
  schema_version?: SchemaVersion47;
  session_id: SessionId;
  synthetic?: Synthetic47;
}
export interface VersionResponse {
  development_only?: DevelopmentOnly48;
  mode: Mode;
  schema_version?: SchemaVersion48;
  service_name: ServiceName6;
  service_version?: ServiceVersion6;
  synthetic?: Synthetic48;
}
export interface WithdrawalRequest {
  development_only?: DevelopmentOnly49;
  idempotency_key: IdempotencyKey9;
  schema_version?: SchemaVersion49;
  synthetic?: Synthetic49;
}
export interface WorkflowExecution {
  attempts?: Attempts1;
  case_id: CaseId15;
  correlation_id: CorrelationId13;
  created_at: CreatedAt8;
  development_only?: DevelopmentOnly50;
  error_code?: ErrorCode | null;
  idempotency_key: IdempotencyKey10;
  processing_status: WorkflowState;
  schema_version?: SchemaVersion50;
  synthetic?: Synthetic50;
  updated_at: UpdatedAt3;
}
export interface WorkflowRequest {
  consent_id: ConsentId1;
  development_only?: DevelopmentOnly51;
  fixture_id: FixtureId;
  idempotency_key: IdempotencyKey11;
  schema_version?: SchemaVersion51;
  synthetic?: Synthetic51;
  text: Text1;
}
