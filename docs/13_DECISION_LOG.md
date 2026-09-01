# Decision log

## 2026-08-30 - Accept D7-E4B durable receipt closeout before repeat verification

DECISION=Treat_revision_44_release_and_the_fresh_revision_46_exact_binding_as_the_current_governance_acceptance_record.
RATIONALE=The prior D7-E4B writer completed and released normally. The earlier revision-42 ACTIVE/Test-N failure is historical authoring evidence, not the current acceptance state; the renewed Reviewer passed, its prior scope/lifecycle P1 is withdrawn and resolved, and the latest Verifier requires these durable receipts before independent repeat verification.

```text
AUTHORITY_ID=OWNER_GO_D7_E4B_ONE_SHOT_PRODUCTION_RECONCILIATION_V1
ASSIGNMENT_ID=SGDS_D7_E4B_RECEIPT_CLOSEOUT_V1
WRITER_ID=01a052eb-7f36-79c0-8d20-76b12ed84ae5
PRIOR_WRITERCOMPLETE=d7-e4b-one-shot-complete-01a0518c_COMPLETED
PRIOR_CONTROLLERRELEASE=d7-e4b-one-shot-release-01a0518c_RELEASED
PRE_ASSIGNMENT_STATE=NONE_REVISION_44_sha256:a59e1e22965bc33a7343715b7e61d3b32bb7e4141f1041072015ad77a2b380e6
CURRENT_WRITER_BINDING=d7-e4b-receipt-closeout-verify-01a052eb_VERIFIED_ACTIVE_REVISION_46
ACCEPTANCE=WINDOWS_POWERSHELL_723_TOTAL_722_PASS_0_FAIL_1_EXPECTED_SKIP_0_TODO;D7_E4B_45_OF_45;A_Q_17_OF_17;BUNDLE_C_AGGREGATE_CHECK_PASS;GIT_DIFF_CHECK_0;STAGING_EMPTY
BASELINE=HEAD_AND_ORIGIN_MAIN_fdb8ef020590759d45a17dfc17738e8a2957a36f
RENEWED_REVIEWER=PASS
PREVIOUS_SCOPE_LIFECYCLE_P1=WITHDRAWN_RESOLVED
LATEST_VERIFIER_P1=REPEAT_VERIFICATION_REQUIRES_DURABLE_RECEIPT_RECORD
PARENT_ONE_SHOT_PRODUCTION_AUTHORITY=UNCONSUMED
PRODUCTION_OR_REMOTE_ACTION=NOT_RUN
```

## 2026-08-30 - Repair secret-scanner token boundary

DECISION=Restrict_only_the_final_sk_token_alternative_to_a_non_alphanumeric_left_boundary.
RATIONALE=The prior unbounded sk- expression reported ordinary governance words such as task-specific as potential secrets. The approved repair retains detection of standalone sk- token prefixes, changes no other alternative, and adds no exclusion.

```text
AUTHORITY_ID=OWNER_GO_SECRET_SCANNER_FALSE_POSITIVE_REPAIR_V1
SCOPE=scripts/checkers/check-no-secret.ps1;active_contract;work_log;decision_log;handoff
PATTERN_CHANGE=sk-[A-Za-z0-9]_TO_(?<![A-Za-z0-9])sk-[A-Za-z0-9]
PATTERN_WEAKENING=NO
EXCLUSIONS_ADDED=NO
WRITER_STATE_LOCK_ISOLATION_MUTATION=NO
COMMIT_PUSH_DEPLOY_PRODUCTION=NO
```

## 2026-08-23 - Adopt Model B controller-enforced Writer Authority v3

DECISION=Use_controller_scoped_logical_assignments_with_an_atomic_durable_writer_slot.
RATIONALE=The approved cooperative local threat model needs fail-closed
concurrency, replay reconciliation, and explicit ambiguity handling, not a
broker or hostile same-user task attestation.

```text
SELECTED_MODEL=MODEL_B_CONTROLLER_ENFORCED_SINGLE_WRITER
REPOSITORY_PRIMITIVE=MODEL_C_STYLE_ATOMIC_DURABLE_WRITER_SLOT
NON_SPOOFABLE_TASK_ATTESTATION_REQUIRED=false
PROCESS_THREAD_SESSION_ENVIRONMENT_AUTHORITY=FORBIDDEN
LEGACY_V2_LIVE_STATE=BLOCK_AND_OWNER_GOVERNED_DISPOSITION
AUTO_EXPIRY_RECOVERY=FORBIDDEN
RECOVERWRITER=UNAVAILABLE
```

## 2026-08-23 - Aggregate validation hard gate

DECISION=Freeze the bootstrap source candidate pending an Owner-approved
resolution for the aggregate secret-scanner false positive.
RATIONALE=`check-no-secret.ps1` treats ordinary `task-...` governance wording as
an `sk-` token. The failing locations include the required active-workflow and
completed-contract evidence. Changing that protected checker, or changing the
predecessor contract that was required to be preserved, is outside the bounded
Writer Authority v3 allowlist/intent.

```text
AGGREGATE_CHECK_STATUS=BLOCKED_BEFORE_D7_E4B_CHECKER
SOURCE_MUTATION_STOPPED=YES
REVIEWER_VERIFIER_NOT_DISPATCHED=YES
```

## 2026-08-22 - Correct cross-project workflow-reference boundary

DECISION=Use_SẢN_XUẤT_LT_only_as_orchestration_reference
RATIONALE=SyncGmailDriveSheet must retain its own repository authority, history, writer semantics, checker/test contracts, and production gates. Cross-project workflow reuse must never become cross-project source or authority import.

```text
SOURCE_BASE=SyncGmailDriveSheet_LOCAL_REPOSITORY_AND_OWNER_UPLOADED_SYNC_FILES
REFERENCE_PROJECT=SẢN_XUẤT_LT
REFERENCE_SCOPE=ORCHESTRATION_PATTERN_ONLY
CROSS_PROJECT_SOURCE_IMPORT=FORBIDDEN
CROSS_PROJECT_PHASE_HISTORY_IMPORT=FORBIDDEN
ACTIVE_CONTRACT_REMAINS_SYNC_SPECIFIC=true
RECOVERWRITER=UNAVAILABLE
```


## 2026-08-22 - Adopt SẢN XUẤT LT-aligned GPT Work phase-controller workflow

DECISION=Promote GPT Work to local-repository phase controller and keep Codex Primary as delegated technical executor.
RATIONALE=Owner should not design repository-specific repair from a single terminal error when GPT Work can inspect the actual local repository, diagnose the whole coupled path, and return one consolidated evidence-backed plan.

```text
WORKFLOW_VERSION=SGDS_SXLT_ALIGNED_V3
OWNER_CHATGPT_ROLE=WHAT_BUSINESS_ARCHITECTURE_HARD_GATES_FINAL_GO_NO_GO
GPT_WORK_ROLE=LOCAL_REPOSITORY_PHASE_CONTROLLER
CODEX_PRIMARY_ROLE=DELEGATED_TECHNICAL_EXECUTOR
DIAGNOSE_CLUSTER_BEFORE_PATCH=true
ONE_DEFECT_REPORT_DOES_NOT_EQUAL_ONE_OWNER_PROMPT=true
GITHUB_ROLE=OWNER_CHATGPT_COMMITTED_BASELINE_HISTORY_PROVENANCE_CHECK
GITHUB_DOES_NOT_REPLACE_LOCAL_DIRTY_STATE=true
OWNER_VISIBLE_PROGRESS_POLICY=MINIMAL
SOURCE_MUTATION_STILL_OWNER_ENVELOPE_GATED=true
RECOVERWRITER=UNAVAILABLE
```

## 2026-08-22 - Require next-direction closeout and autonomous continuation

DECISION=Every GPT Work return to Owner must contain the current result and a repository-grounded next-direction proposal in the same closeout.
RATIONALE=Eliminate the redundant result -> Owner asks for plan -> plan -> Owner decision loop.

```text
GPT_WORK_RETURN_TO_OWNER_REQUIRES_NEXT_DIRECTION=true
CLOSEOUT_MUST_INCLUDE_NEXT_EXECUTION_PROPOSAL=true
OWNER_PLANNING_PROMPT_AFTER_NORMAL_CLOSEOUT=false
GPT_WORK_CONTINUE_WITHIN_DELEGATED_ENVELOPE=true
IF_NEXT_ACTION_WITHIN_CURRENT_DELEGATED_ENVELOPE=true
AND_GENUINE_OWNER_HARD_GATE=false
THEN_GPT_WORK_MUST_CONTINUE_AUTONOMOUSLY=true
```

A returned hard-gate or terminal closeout should include the recommended option,
proposed objective/envelope, allowed/forbidden scope, autonomous action classes,
hard stops, success criteria, cheapest-capable routing, and exact Owner decision
required. Do not manufacture options when one route is clearly superior.

This decision does not weaken Owner gates for abnormal writer recovery,
governance/source scope expansion, architecture/data-contract changes,
model-ceiling escalation, clasp/GAS/production mutation, Gmail/Drive/Sheets/
Script Properties/Firestore/Firebase/triggers, checkpoint commit/push, deploy,
destructive operations, or stricter active-contract boundaries.

## 2026-08-22 - Supersede historical Primary routing semantics without deleting history

DECISION=Historical SGDS records that assigned contract/risk/checkpoint routing to Primary remain historical evidence but do not define current orchestration.
SUPERSEDES_CURRENT_ROUTING_SEMANTICS_OF=SYNC-GOV1-004
HISTORICAL_RECORD_DELETION=NO

```text
HISTORICAL_PRIMARY_ROUTING=SUPERSEDED_FOR_CURRENT_ORCHESTRATION
CURRENT_OWNER_CHATGPT_ROLE=WHAT_AND_SUBSTANTIVE_AUTHORITY
CURRENT_GPT_WORK_ROLE=LOCAL_REPOSITORY_PHASE_CONTROLLER
CURRENT_CODEX_PRIMARY_ROLE=TECHNICAL_HOW_WITHIN_APPROVED_ENVELOPE
ACTIVE_CONTRACT_REMAINS_TASK_SPECIFIC_EXECUTION_AUTHORITY=true
```

# Historical decision log follows

## SYNC-GOV1-001 active contract wins

DECISION=The single file under `docs/exec-plans/active/` overrides stale execution wording elsewhere.
RATIONALE=Execution authority must be unambiguous and fail closed.

## SYNC-GOV1-002 no lease recovery

DECISION=`RecoverWriter` is not an SGDS helper action.
RATIONALE=A lost or stale writer identity must receive owner-governed review rather than an automatic continuation.

## SYNC-GOV1-003 model-neutral profiles

DECISION=Repository profiles do not pin a model.
RATIONALE=Runtime selection is environmental capability, not execution authorization.

## SYNC-GOV1-004 responsibility and cost routing

DECISION=Primary owns contract/risk/checkpoint routing; specialists own bounded execution. DEFAULT_COST_POLICY=CHEAPEST_CAPABLE.
ONE_WRITER_POLICY=Exactly one Coder writes after exact ACTIVE verification; RESERVED denies and inherited dirt is preserved.
CHECKPOINT_OWNER_DECISION=HOLD_PENDING_INDEPENDENT_REVIEW_AND_VERIFICATION

## SYNC-GOV1R2-001 v2 control-plane repair

DECISION=Preserve the GOV1 failed candidate and repair only the lease, semantic manifest, behavioral tests, checker, and evidence-required governance records.
RATIONALE=GOV1 review remains FAIL with P1=3 and P2=1; R2 independent review and verification are NOT_RUN until the Coder freezes the repaired candidate.
R2_REVIEW_STATUS=NOT_RUN
R2_VERIFIER_STATUS=NOT_RUN

## SYNC-GOV1R6F-001 lossless overlay transport and validation

DECISION=Replace comma-delimited overlay forwarding with one strict Base64 UTF-8 JSON-array payload and reject legacy/new ambiguity.
RATIONALE=Legal comma and Unicode paths must retain exact cardinality and identity. Marker ownership, full manifest validation, semantic-index object safety, and cleanup remain fail closed.
R6_INITIAL_WRITER_ATTEMPT=BLOCKED_BEFORE_SOURCE_WRITE
R6E_WRITER_LIFECYCLE_TRUST=PASS
R6F_CODER_REPAIR=PASS_PENDING_NORMAL_WRITER_CLOSURE
REVIEWER_STATUS=NOT_RUN_TRUST_GATE
VERIFIER_STATUS=NOT_RUN_TRUST_GATE

## SGDS-WRITER-AUTHORITY-V3-001 trusted task identity is an enforceable hard gate (2026-08-22)

DECISION=Do not treat the current `CODEX_THREAD_ID`, session-log records, shared-process metadata, or caller-provided identifiers as Writer Authority v3 exclusive-task identity.
RATIONALE=`CODEX_THREAD_ID` is ordinary inheritable environment text; the matching per-user session log is mutable by the current user; no current-task/assignment attestation interface or repository-consumable capability is exposed to the local execution environment. The available native turn-binding interface requires a caller-supplied opaque `turn_token` and only governs outer native tool calls.
TRUSTED_TASK_IDENTITY_PROVEN_AVAILABLE=NO
OPTION_2_STATUS=BLOCKED
NEXT_RECOMMENDED_OPTION=OPTION_3_DEDICATED_WRITER_AUTHORITY_BROKER_OR_EQUIVALENT
SOURCE_IMPLEMENTATION_AUTHORIZED=NO


## SGDS-GOV-WF2-001 master delegated envelope becomes default orchestration (2026-08-22)

DECISION=Use Owner+ChatGPT for WHAT/authority, GPT Work as phase controller, Codex Primary for HOW execution, and fresh independent Reviewer/Verifier threads when required.
RATIONALE=This reduces repetitive Owner relay for ordinary same-scope technical corrections while retaining the sole-active-contract law, one-writer law, independent review, evidence preservation, and production hard gates.
MASTER_ENVELOPE_MULTI_PHASE_DEFAULT=YES
ACTIVE_CONTRACT_REMAINS_EXECUTION_AUTHORITY=YES
SAME_SCOPE_CONTROLLER_CONTINUATION=ONLY_WHEN_CONTRACT_AUTHORIZES
SUBSTANTIVE_HARD_GATE_RETURNS_TO_OWNER=YES
CLOSED_ATTEMPT_REUSE=FORBIDDEN_WHEN_FRESH_AUTHORITY_REQUIRED
PRODUCTION_AUTHORITY_CHANGED=NO

## SGDS-GOV-WF2-002 durable evidence and late-completion quarantine (2026-08-22)

DECISION=Treat mutation-capable timeout or transport loss as an unknown completion state until exact side effects are reconciled.
RATIONALE=Client timeout does not prove server-side execution stopped; blind retry can create duplicate isolation, locks, or mutations.
TIMEOUT_STATE=PENDING_LATE_COMPLETION_QUARANTINE
BLIND_RETRY=FORBIDDEN
STABLE_ZERO_STATE_REQUIRED_BEFORE_FRESH_MUTATION_ATTEMPT=YES

## 2026-08-30 - Normalize six D7 checker dirty scopes with exact paths

DECISION=Enumerate individual untracked files in the five E4A-family dirty-scope checks and extend all six D7 checker allowlists only with the exact current inherited and governance files authorized by the Owner.
RATIONALE=Default git status directory collapsing hid individual untracked paths from five checkers, while historical exact allowlists did not include the current governance bootstrap candidate. File-level enumeration plus exact literals restores consistent fail-closed evaluation without changing runtime or production semantics.
AUTHORITY_ID=OWNER_GO_D7_DIRTY_SCOPE_NORMALIZATION_V1
CHECKER_SCOPE=D7_E3V;D7_E4A1;D7_E4A1A;D7_E4A1B;D7_E4A1C;D7_E4A2
DIRECTORY_ALLOWLIST_ENTRIES_ADDED=NO
WILDCARD_OR_PREFIX_EXEMPTIONS_ADDED=NO
UNKNOWN_DIRTY_PATHS_STILL_FAIL=YES
EXISTING_GUARD_RULES_CHANGED=NO
STAGING_OR_ENVIRONMENT_BYPASS_ADDED=NO
RUNTIME_OR_PRODUCTION_SEMANTICS_CHANGED=NO

## 2026-08-30 - Close independent Reviewer P2 isolation coverage gaps

DECISION=Extend existing Test N only, retaining the exact A-Q 17-test matrix, to prove tracked source deletion remains absent in both PowerShell 5.1 and PowerShell 7 isolation snapshots and to exercise each strict payload-rejection class under both runtimes.
RATIONALE=Independent review identified unexercised tracked-deletion behavior and asymmetric runtime coverage for malformed JSON, non-string members, invalid Base64, and invalid UTF-8. The bounded regression closes those evidence gaps without changing runtime helper semantics.
AUTHORITY_ID=OWNER_GO_ISOLATION_REVIEW_P2_TEST_CLOSURE_V1
CODER_TASK_ID=01a05110-02e0-7201-b0ba-7c6537302279
ASSIGNMENT_ID=SGDS_ISOLATION_REVIEW_P2_TEST_CLOSURE_01A05110
RUNTIME_HELPER_CHANGED=NO
CHECKER_SCOPE_CHANGED=NO
PROTECTED_GUARDS_WORKTREES_OR_PRODUCTION_SCOPE_CHANGED=NO

## 2026-08-30 - Make isolation payload parsing and tracked bytes portable

DECISION=Use System.Web JavaScriptSerializer on Windows PowerShell 5.1 and System.Text.Json JsonDocument on PowerShell 7 for the same Base64 strict UTF-8 JSON string-array contract, then materialize every tracked changed path from the source after the retained binary patch is applied.
RATIONALE=System.Web is not available in the PowerShell 7 runtime, while core.autocrlf can make a linked-worktree checkout byte-different from the source candidate even when the normalized Git diff is equivalent. Platform-native structured parsing plus guarded raw-byte materialization restores parser and candidate identity without weakening patch, manifest, index, status, object-database, containment, type, or reparse invariants.
AUTHORITY_ID=OWNER_GO_ISOLATION_PORTABILITY_REPAIR_V1
PARSER_DELIMITER_OR_AD_HOC_SPLITTING=FORBIDDEN
MALFORMED_OR_WRONG_JSON_TYPES=FAIL_CLOSED
SOURCE_DELETION_DISPOSITION=ABSENT_IN_ISOLATION
RETAINED_BINARY_PATCH=STILL_REQUIRED_AND_VALIDATED
STATIC_CHECKER_CANDIDATE_SCOPE_CHANGED=NO
PROTECTED_GUARD_WORKTREE_OR_PRODUCTION_SCOPE_CHANGED=NO

## 2026-08-30 - Finalize governance checkpoint record before commit gate

DECISION=Record the completed portability and Reviewer-P2 lifecycles, acceptance, independent renewed review, independent verification, and clean isolation teardown in the active governance records only.
RATIONALE=The durable v3 receipts prove both prior writer lifecycles completed and released through revision 36; the frozen candidate then passed the exact A-Q matrix and aggregate bundle, while independent Reviewer and Verifier reported no remaining findings. A docs-only finalization slot preserves this evidence without broadening source, test, checker, agent, guard, lifecycle, or production scope.
AUTHORITY_ID=OWNER_GO_GOVERNANCE_CHECKPOINT_RECORD_FINALIZATION_V1
SUPERSEDED_AUTHORITY_ID=OWNER_GO_ISOLATION_REVIEW_P2_TEST_CLOSURE_V1
CODER_TASK_ID=01a05129-0af8-7321-9b85-d686628856af
ASSIGNMENT_ID=SGDS_GOVERNANCE_CHECKPOINT_RECORD_FINALIZATION_01A05129
CONTROLLER_ASSIGN_OPERATION_ID=governance-checkpoint-record-assign-01a05129
CONTROLLER_VERIFY_OPERATION_ID=governance-checkpoint-record-verify-01a05129
WRITER_SLOT_STATUS=VERIFIED_ACTIVE_REVISION_38
EXACT_DOCS_ONLY_SCOPE=ACTIVE_CONTRACT;WORK_LOG;DECISION_LOG;HANDOFF
PRE_RECORD_EVIDENCE=PORTABILITY_AND_P2_RELEASED_THROUGH_REVISION_36;A_Q_17_0_0_0;BUNDLE_C_AGGREGATE_CHECK_PASS;GIT_DIFF_CHECK_PASS;STAGING_EMPTY
RENEWED_REVIEWER=01a0511c-c183-7cd3-83f3-4e02e185c76a_PASS_NO_P0_P1_P2_INITIAL_SEQUENCING_FINDING_WITHDRAWN_AFTER_DURABLE_RECEIPTS
VERIFIER=01a05121-6120-7740-93bd-a2980b1be706_PASS_NO_P0_P1_P2_P3
ISOLATION_CLEANUP=PASS_MAIN_STATUS_INDEX_UNCHANGED_VERIFIER_SCRATCH_REMOVED
CODER_STATUS=ACTIVE_WHILE_AUTHORING_CONTROLLER_WRITERCOMPLETE_CONTROLLERRELEASE_REQUIRED
CHECKPOINT_COMMIT=OWNER_APPROVAL_REQUIRED_AFTER_SUCCESSFUL_CONTROLLER_CLOSURE
STAGE_COMMIT_PUSH_DEPLOY_OR_PRODUCTION_MUTATION=NOT_AUTHORIZED

## 2026-08-30 - Serialize D7-E4B as a single-use production authority

DECISION=Bind the Owner-approved D7-E4B reconciliation to exactly one fresh preflight, exact temporary marker creation, one invocation of `runD7E4BExactFirestoreReconciliation`, guaranteed marker deletion, and read-only verification after normal Controller closure and independent governance/acceptance validation.
RATIONALE=The reconciliation is a seven-write production operation with data-integrity risk. A one-shot authority prevents replay, while fresh preflight and fail-closed drift checks prevent acting on stale source or state evidence.
AUTHORITY_ID=OWNER_GO_D7_E4B_ONE_SHOT_PRODUCTION_RECONCILIATION_V1
TASK_ID=01a0518c-a075-7920-864c-24b9f0371432
ASSIGNMENT_ID=SGDS_D7_E4B_ONE_SHOT_01A0518C
CONTROLLER_ASSIGN_OPERATION_ID=d7-e4b-one-shot-assign-01a0518c
CONTROLLER_VERIFY_OPERATION_ID=d7-e4b-one-shot-verify-01a0518c
WRITER_SLOT=VERIFIED_ACTIVE_REVISION_42
AUTHORITY_CONSUMPTION=EXACTLY_ONE_ENTRYPOINT_INVOCATION
HARD_STOPS=MARKER_PREEXISTENCE;AUTHORITY_DRIFT;SOURCE_PARITY_DRIFT;STATE_DRIFT;PRECONDITION_FAILURE;TIMEOUT;TRANSPORT_LOSS;UNKNOWN_OUTCOME
PRECONDITION_FAILURE_WRITES=0
RETRY=FORBIDDEN
SUCCESS=7_FIRESTORE_WRITES_JOB_3_LEASE_2_REPORT_1_AUDIT_1;JOB_VERSION_7;JOB_AND_LEASE_RECONCILIATION_REQUIRED;REPORTS_2;AUDITS_3;ATTACHMENTS_0;EXTERNAL_MUTATION_0
EXCLUDED=COMMIT;PUSH;DEPLOY;CLASP_PUSH;SOURCE_SYNC;CREDENTIALS;IAM;TRIGGERS;GMAIL;DRIVE;SHEETS;ATTACHMENTS
CURRENT_DECISION_ONLY=GOVERNANCE_SERIALIZATION_NO_PRODUCTION_EXECUTION_OR_MARKER_MUTATION

## 2026-08-31 - Treat D7-E4B as consumed with a zero-write blocked result

DECISION=Supersede earlier D7-E4B `UNCONSUMED` and planned-success assertions with the consumed-attempt receipt: exactly one authorized invocation completed with `BLOCKED_D7_E4B_PRECONDITION_CHANGED`, `UNKNOWN_WRITE_OUTCOME=NO`, and zero runtime write counters.
RATIONALE=The valid marker was deleted and verified absent, while the one post-verifier observed matching snapshots, no concurrent external change, zero production mutations, and `UNEXPECTED_FIRESTORE_STATE`. The D7-E4B conjunction definitely failed because the runtime returned `BLOCKED_D7_E4B_PRECONDITION_CHANGED` with zero writes, but its exact failing conjunct was not serialized and remains not isolated. Legacy D7_E3G independently observed zero Drive matches and one non-exact or conflicting Sheet row; that is high-confidence diagnostic direction, not exact D7-E4B predicate proof, because helper semantics differ. Exact Sheet row/content, Drive XML/PDF, lease/fence/generation, page/latest-report, and attachment/document predicates remain not proven.
AUTHORITY_ID=OWNER_GO_D7_E4B_CONSUMED_ATTEMPT_RECEIPT_AND_READ_ONLY_PRECONDITION_DELTA_DIAGNOSIS_V1
WRITER_SLOT_STATUS=VERIFIED_ACTIVE_REVISION_50
PARENT_ONE_SHOT_AUTHORITY_STATUS=CONSUMED_ZERO_WRITE_BLOCKED_PRECONDITION
RECONCILIATION=NOT_COMPLETED
SUCCESS_TARGET_7_WRITES=NOT_MET
ROOT_CAUSE=NOT_CLAIMED_BEYOND_AVAILABLE_EVIDENCE
FUTURE_ACTIONS_FORBIDDEN=PRODUCTION_RETRY;MARKER;PRODUCTION_MUTATION;COMMIT;PUSH;DEPLOY;CLASP;SOURCE_SYNC
FRESH_OWNER_AUTHORITY_REQUIRED_FOR=EXTERNAL_READ;DIAGNOSTIC_SOURCE_CHANGE;REPAIR;NEW_PRODUCTION_ATTEMPT
