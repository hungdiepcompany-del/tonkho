# Phase 1 fresh production read-only forensic rebaseline

PHASE_ID=SGDS_PHASE1_FRESH_PRODUCTION_READ_ONLY_FORENSIC_REBASELINE
TASK_ID=01a09872-e890-76f3-9e74-319ace1372ff
WRITER_ID=01a09872-e890-76f3-9e74-319ace1372ff
STATUS=ACTIVE
OWNER_AUTHORITY=DIRECT_OWNER_DELEGATED_TO_PHASE_CONTROLLER
AUTHORITY_ID=OWNER_DELEGATED_AUTO_GO_PHASE1_DOC_REVIEW_CORRECTION_V1
CURRENT_AUTHORITY_ASSIGNMENT_ID=SGDS_PHASE1_DOC_REVIEW_CORRECTION_01a09872
CURRENT_AUTHORITY_CODER_THREAD_ID=01a09872-e890-76f3-9e74-319ace1372ff
CURRENT_AUTHORITY_CODER_ROLE=SOLE_PHASE1_DOC_REVIEW_CORRECTION_CODER
CURRENT_AUTHORITY_ASSIGN_OPERATION_ID=phase1-doc-review-correction-assign-01a09872
CURRENT_AUTHORITY_VERIFY_OPERATION_ID=phase1-doc-review-correction-verify-01a09872
CURRENT_AUTHORITY_COMPLETE_OPERATION_ID=phase1-doc-review-correction-complete-01a09872
CURRENT_AUTHORITY_RELEASE_OPERATION_ID=phase1-doc-review-correction-release-01a09872
AUTHORITY_PREDECESSOR=OWNER_GO_PHASE1_FRESH_PRODUCTION_READ_ONLY_FORENSIC_REBASELINE_EXACTLY_ONCE_V1_CLOSED_RELEASED_NONE_REVISION_192
OWNER_GO_RECEIVED=OWNER_DELEGATED_AUTO_GO_FOR_NON_PRIVILEGED_IN_SCOPE_CORRECTION
OWNER_BOOTSTRAP_EXCEPTION=CONTROLLER_MAY_UPDATE_ONLY_THIS_CURRENT_AUTHORITY_PREAMBLE_BEFORE_ASSIGN_VERIFY_NO_WRITER_SLOT_LEASE_LOCK_OR_STATE_IS_CREATED_FORGED_OR_IMPLIED
RISK_CLASS=LOW_LOCAL_ONLY_DOCUMENTATION_CORRECTION
CURRENT_AUTHORITY_RULE=THE_TITLE_TO_FIRST_SECTION_PREAMBLE_IS_THE_ONLY_AUTHORITY_SOURCE_FOR_AUTHORITY_ID_CURRENT_AUTHORITY_ASSIGNMENT_ID_AND_CURRENT_AUTHORITY_CODER_THREAD_ID
CURRENT_AUTHORITY_BOUNDARY=CORRECT_ONLY_THE_TWO_INDEPENDENT_REVIEW_DOCUMENTATION_FINDINGS_AND_REQUIRED_CLOSEOUT_HASH_RECORDS_IN_EXACT_FIVE_DOCUMENT_PATHS
PHASE1_RUNTIME_INVOCATION_BUDGET=CONSUMED_EXACTLY_ONCE_NO_RERUN_AUTHORIZED
PHASE1_PRODUCTION_READ_SCOPE=ONE_EXACT_GMAIL_THREAD_AND_MESSAGE;TWO_EXACT_DRIVE_ARTIFACTS;ONE_EXACT_SHEET_A_TO_P_ROW;EXACT_DETERMINISTIC_FIRESTORE_JOB_LEASE_ATTACHMENT_RECORDS_EVENTS_AND_RECONCILIATION_REPORTS
PHASE1_DOC_WRITE_SCOPE=docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md;docs/12_AI_WORK_LOG.md;docs/13_DECISION_LOG.md;docs/99_NEXT_AI_HANDOFF.md;docs/FILE_MANIFEST.md
PHASE1_FORBIDDEN=NO_APPLICATION_RUNTIME_TEST_OR_CHECKER_EDIT_NO_RECONCILIATION_OR_REPAIR_NO_GMAIL_DRIVE_SHEETS_FIRESTORE_OR_SCRIPT_PROPERTY_WRITE_NO_MARKER_CREATE_DELETE_NO_TRIGGER_CHANGE_NO_CLASP_PUSH_NO_DEPLOY_NO_GIT_STAGE_COMMIT_PUSH

## Current Phase 1 authority

This preamble is the current Owner authority for a local documentation
correction only. The runtime invocation budget was consumed exactly once by
the completed `runD7E3IExactProductionConflictForensicReadOnly` dispatch. No
external read, remote parity pull, credential/project verification, or runtime
rerun is authorized by this correction authority.

The exact D7-E3I reachable definition files and `appsscript` manifest byte
match was only a bounded static parity prerequisite. It is not full-project
parity, does not prove the whole production execution environment, and cannot
authorize any source-dependent production mutation while full-project drift
remains. The sanitized execution result below remains factual evidence, and
its stop-before-reconciliation-or-mutation direction remains a hard stop.

The controller bootstrap above changes no writer lease, lock, or state. The
named Coder may edit only the five documentation paths in
`PHASE1_DOC_WRITE_SCOPE` after exact normal `ControllerAssign` and
`ControllerVerify`. All Phase 0 text below is retained as historical evidence
and cannot widen this Phase 1 authority.

## Phase 1 sanitized execution evidence

PHASE1_DISPATCH=ONE_AND_ONLY_ONE_CONFIRMED_APPS_SCRIPT_DISPATCH_OF_runD7E3IExactProductionConflictForensicReadOnly
PHASE1_EXECUTION=COMPLETED_NORMALLY
PHASE1_STATUS=BLOCKED_D7_E3I_FORENSICS_INCOMPLETE
PHASE1_CLASSIFICATION=FORENSICS_INCOMPLETE
GMAIL_EXACT_SOURCE_READ=VERIFIED_READ_OK
SHEETS_EXACT_ROW_READ=READ_OK_CANONICAL_ROW_ABSENT
FIRESTORE_EXACT_DOCUMENTS_READ=READ_OK_JOB_VALIDATED_NOT_COMPLETED_UNKNOWN_WRITE_OUTCOME_EVIDENCE_PRESENT
DRIVE_EXACT_PDF=RESOURCE_NOT_FOUND_ACCESS_AND_CONTENT_NOT_PROVEN
DRIVE_EXACT_XML=RESOURCE_NOT_FOUND_ACCESS_AND_CONTENT_NOT_PROVEN
PERMISSION_PROBE=EXECUTED_NO_BROAD_SCOPE_OR_CLOUD_PLATFORM_SCOPE_ADDITION_REQUIRED
READ_COUNTS=DRIVE_4_FIRESTORE_5_GMAIL_1_SHEETS_1_WITHIN_MAXIMA
PRODUCTION_MUTATIONS=ZERO
FORBIDDEN_MUTATIONS=ZERO_DESTRUCTIVE_REPAIR_RECONCILIATION_GMAIL_DRIVE_SHEETS_FIRESTORE_TRIGGER
REMOTE_SOURCE_PULL_AUDIT=FULL_PROJECT_DRIFT_FOUND_EXACT_D7_E3I_FORENSIC_REACHABLE_CALL_GRAPH_AND_APPSSCRIPT_MANIFEST_MATCH_LOCAL_NO_SOURCE_SYNC
REMOTE_ONLY=invoiceCanonical.js_SKU_ENGINE.js
LOCAL_ONLY=D7_E4C_ExactPreconditionDiagnostic.js
REMOTE_LOCAL_MISMATCHES=14_D7_E4B_ExactFirestoreReconciliationRuntime.js_gmailLabels.js_gmailProcessInvoiceXML.js_gmailSearch.js_hashUtils.js_Invoice_AttachmentParser.js_main.js_sheetHoaDon.js_sheetMenu.js_sheetNhapXuat.js_sheetSidebar.html_sheetTonKho.js_sheetUtils.js_triggers.js
GIT_CHECKPOINT=8512cae06cf57a58f2bcb01f0558c9aa0dcec293_LOCAL_ONLY
ORIGIN_MAIN=bf6f792631896acbf85caa21d7a597dfcebe0648
STAGING_AT_PHASE_START=EMPTY
PROTECTED_WORKTREES=PRESERVED_w_w1
GIT_STAGE_COMMIT_PUSH=NOT_RUN
NEXT_DIRECTION=STOP_BEFORE_RECONCILIATION_OR_MUTATION;FRESH_LATER_PHASE_MUST_DIAGNOSE_MISSING_DRIVE_ARTIFACTS_AND_UNKNOWN_FIRESTORE_OUTCOME_RECONCILE_REMOTE_LOCAL_SOURCE_PROVENANCE_AND_OBTAIN_FRESH_OWNER_AUTHORITY_FOR_ANY_PRODUCTION_WRITE
CODER_CLOSEOUT=FREEZE_AND_REPORT_NO_WRITERCOMPLETE_NO_CONTROLLERRELEASE
CONTROLLER_NEXT_ACTION=FREEZE_BEFORE_INDEPENDENT_REVIEW;PRIMARY_ALONE_MAY_PERFORM_ACTIVE_ONLY_WRITERCOMPLETE_AND_CONTROLLERRELEASE_AFTER_COMPLETED

## Historical Phase 0 closeout record

Close the Phase 0 local evidence record without changing source, tests, runtime,
candidate identity, archive, control-plane state, or any external system.
Record the V6 completion/release and independent Reviewer/Verifier acceptance
facts, refresh the six documentation hashes, and leave Phase 1 production
read-only forensic rebaseline as a fresh, ungranted authority boundary.

## Proven current state

- `HEAD` and `origin/main` are `bf6f792631896acbf85caa21d7a597dfcebe0648`.
- The pre-bootstrap worktree was clean and the Git index/staging area was empty.
- V15B completed and released normally at writer-slot revision 160.
- The compatibility-repair writer completed and released normally; the writer
  slot is `NONE` at revision 168 before this assignment.
- Independent review in a fresh helper-created isolation found no P0/P1 source
  defect and proved the frozen candidate identity, archive provenance, and
  manifest hashes.
- The same review found one P2 acceptance defect: the aggregate runner invokes
  the receipt-bound governance checker only after the long command sequence, so
  the five-minute controller receipt expired before validation.
- The receipt-order repair writer completed and released normally; the current
  writer slot is `NONE` at revision 172 before this assignment.
- A fresh isolated review proved the receipt-bound governance gate ran first and
  A-Q passed 17/17, then aggregate stopped at the first of five legacy D7
  checkers whose private exact allowlists do not include the full current
  candidate.
- The review's archive-length P1 is rejected by stronger raw-byte evidence:
  the completed archive and the retired `HEAD` path resolve to the identical
  Git blob `0e630f2ac2dee9fd02ad905ef42d44b9feed0c0c` and 1118 lines.
- The review's lifecycle P1 is a documentation-clarity defect, not a second
  writer or slot conflict: revision 170 was authoring-time ACTIVE evidence and
  the receipt correctly proved post-release `NONE` at revision 172.
- The stale review isolation was removed under exact Owner abnormal-cleanup
  authority; the fresh review isolation was removed normally. No active
  helper-created isolation remains.
- The integrated legacy D7 scope-alignment writer completed and released
  normally; the writer slot is `NONE` at revision 176 before this assignment.
- Independent review passed A-Q 17/17, all scoped D7 checkers, the 772-test
  suite with one declared skip, staging, diff, manifest, and archive identity,
  but returned two P2 documentation findings: stale phase/revision labels in
  `docs/00_INDEX.md` and `docs/04_MASTER_PLAN.md`, plus incorrect 1018-line
  observations in `docs/12_AI_WORK_LOG.md`, `docs/13_DECISION_LOG.md`, and
  `docs/99_NEXT_AI_HANDOFF.md`. The raw archive count is 1118.
- The documentation-correction writer completed and released normally; the
  writer slot is `NONE` at revision 180 before this assignment.
- The Owner-authorized abnormal cleanup removed only isolation
  `6490ff048b9a48d4b8b6b98d45e34051`, its exact registry entry, and Git admin
  worktree `w2`; main status/index and protected `w`/`w1` were preserved, and
  no prune or repair command was used.
- Investigation mapped newly added loose Git objects to current candidate-file
  blobs created during Codex review snapshots. HEAD, worktree content, status,
  index, archive, and manifest candidate identities remained unchanged. The
  helper's all-object physical inventory is therefore over-broad for the
  safety property it is intended to prove.
- The V6 object-identity repair completed normally at revision 183 and released
  to `NONE` at revision 184. Before this V7 assignment the control plane was
  `NONE` at revision 184 and no active isolation existed.
- Independent Reviewer task `01a0941f-99d6-77d3-ae77-6172d27f4ae6` is
  archived with no P0-P3 findings and the final aggregate PASS: A-Q 17/17,
  772 total / 771 pass / 0 fail / 1 expected skip, including D7 E4B 45/45 and
  E4C 39/39.
- Owner authorized abnormal cleanup only for orphan test roots
  `ea9b9d3f0f6e43fda790777a1c92e775`,
  `00756b9b279241bf9f38e97e449fabf6`, and
  `e3d677228f544650bdf6292d8eaaf6b8` after proving fixture source/common
  directories absent, roots unregistered, and no reparse point. Inherited
  siblings and protected `w`/`w1` were preserved. Reviewer isolation then
  cleaned up normally with main worktree and index unchanged.
- Independent Verifier task `01a0981f-61c3-7b23-a15d-536fb5c4b110` is
  archived after isolated aggregate exit 0 with the same full acceptance,
  PowerShell 5.1 and 7 AST across eight files with zero errors, exact 25-path
  candidate, empty staging, and archive blob
  `0e630f2ac2dee9fd02ad905ef42d44b9feed0c0c` with 1118 LF and zero CR.
  Verifier cleanup then removed its scratch isolation normally with main/index
  unchanged.
- D7-E4B's prior one-shot was consumed, made zero runtime writes, and has no retry authority.
- D7-E4C local diagnostics are committed.
- Production reconciliation is not complete.

## Authority and boundary

This contract authorizes only the local Phase 0 paths listed below. The Owner's
continuous GO permits the Controller's minimal bootstrap edit to this preamble
and scope before assignment; that exception does not create, forge, or imply a
writer slot, lease, lock, or verified writer state. It does not authorize any
external read, remote action, production operation, or runtime execution.
Historical contracts and records are evidence only; they cannot widen this
scope or replace the three generic current binding fields in this preamble.

Do not manually edit writer state, transition locks, or isolation registry, and
do not mutate protected `w`/`w1` worktrees, `.codex`, Git index, staging area,
remotes, or deployments. Only the exact normal helper lifecycle named in this
preamble is authorized for this assignment.
The Coder must freeze and report without invoking `WriterComplete` or
`ControllerRelease`. After independent confirmation of the frozen candidate,
the Controller alone, acting as Primary, may invoke the exact ACTIVE-only
`WriterComplete`; only after a `COMPLETED` result may the Controller alone,
acting as Primary, invoke the exact `ControllerRelease`.

## Allowed mutation scope

The exact 25-path Phase 0 candidate remains frozen as the canonical governance
scope. The stricter V7 documentation-write authority appears below; it must not
change the 18 non-document candidate entries.

- `scripts/ai/Manage-NonWriterIsolation.ps1`
- `scripts/checkers/check-ai-governance-bootstrap.mjs`
- `tests/unit/ai-governance-bootstrap.test.mjs`
- `scripts/test/run-all-checks.mjs`
- `scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs`
- `tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs`
- `scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs`
- `tests/unit/d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.test.mjs`
- `scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs`
- `tests/unit/d7-e4a1a-canonical-identity-configuration-read-only-recovery.test.mjs`
- `scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs`
- `tests/unit/d7-e4a1b-owner-configure-canonical-properties.test.mjs`
- `scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs`
- `tests/unit/d7-e4a1c-owner-marker-single-read-only-cardinality-execution.test.mjs`
- `scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs`
- `tests/unit/d7-e4a2-exact-firestore-reconciliation-plan-finalization.test.mjs`
- `docs/exec-plans/active/SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md`
- `docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md`
- `docs/exec-plans/completed/SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md`
- `docs/00_INDEX.md`
- `docs/04_MASTER_PLAN.md`
- `docs/12_AI_WORK_LOG.md`
- `docs/13_DECISION_LOG.md`
- `docs/99_NEXT_AI_HANDOFF.md`
- `docs/FILE_MANIFEST.md`

## V7 authorized mutation delta

Only these seven documentation paths may receive V7 writes. Every other path
in the canonical frozen candidate scope is hash-invariant for this closeout.

- `docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md`
- `docs/00_INDEX.md`
- `docs/04_MASTER_PLAN.md`
- `docs/12_AI_WORK_LOG.md`
- `docs/13_DECISION_LOG.md`
- `docs/99_NEXT_AI_HANDOFF.md`
- `docs/FILE_MANIFEST.md`

## Acceptance criteria

- Exactly one real active Markdown contract exists.
- The completed Writer Authority v3 contract retains the original 1118-line
  committed content byte-for-byte; the transient Phase 0 bootstrap preamble is
  not historical contract content.
- Receipt and static validation read only `AUTHORITY_ID`,
  `CURRENT_AUTHORITY_ASSIGNMENT_ID`, and
  `CURRENT_AUTHORITY_CODER_THREAD_ID` from this title-to-first-section
  preamble, failing closed for missing, empty, or duplicate bindings.
- The A-Q governance matrix remains exactly 17 tests.
- The aggregate runs the scope-only gate first, then the receipt-bound full
  governance gate, before dynamic helper import or any long-running check.
- Static governance and test Q fail closed if the receipt-bound gate is absent,
  duplicated, moved after the dynamic import, or left in the long command list.
- Governance exports one frozen exact 25-path candidate scope. Each of the five
  legacy D7 gates above composes that exact scope with its historical scope
  instead of copying another Phase 0 list; wildcard or prefix acceptance remains
  forbidden.
- Focused tests prove the shared exact-scope integration, current candidate
  acceptance, staged-path rejection, and unrelated or near-match rejection.
- The legacy D7-E3V dirty-file gate accepts exactly the two Phase 0 contract
  transition paths plus the exact aggregate-runner addition while continuing to
  reject unrelated or near-match dirty files.
- The V7 delta changes exactly the seven documentation paths listed above;
  all 18 non-document candidate hashes remain unchanged.
- Current-state overlays and mandatory logs/handoff accurately record the V6
  normal completion/release, independent review/verifier, bounded abnormal
  cleanup, and Phase 1 direction without rewriting historical records.
- The isolation helper stores and validates a deterministic identity of the
  object graph reachable from the exact manifest HEAD, independent of loose
  versus packed storage and harmless unreachable object additions. Missing or
  unreadable reachable objects, a changed HEAD graph, or any existing candidate
  identity drift still fails closed.
- The isolation manifest is version 4 and the controller inspection receipt is
  version 2. Both bind the explicit `reachable_head_object_graph_identity`;
  the misleading physical `object_database_identity` field is absent.
- A-Q remains exactly 17 cases and includes a regression proving that an
  unreachable content-addressed snapshot object added after isolation creation
  does not block validation or normal cleanup; existing raw-byte, status, index,
  overlay, linked-index, and content-drift rejection remains intact.
- Final bytes are listed in `docs/FILE_MANIFEST.md`; the six hashable changed
  documents are listed and the manifest is the explicit self-hash exception.
- Both PowerShell AST parsers, Node syntax/static checks, scope-only, A-Q 17/17,
  six D7 checkers and focused suites, full npm test, diff, exact 25-path
  candidate, exact seven-document delta, empty staging, archive blob/LF proof,
  and final manifest verification pass.

## Next phase handoff

V6 completed and released normally, and independent Reviewer and Verifier
acceptance is recorded above. V7 is a local documentation-only closeout: no
receipt is minted or bypassed while this writer is ACTIVE. Phase 1 production
read-only forensic rebaseline remains a distinct fresh-authority boundary and
is not authorized by this contract.

NEXT_PHASE=PHASE_1_FRESH_PRODUCTION_READ_ONLY_FORENSIC_REBASELINE
NEXT_PHASE_STATUS=REQUIRES_FRESH_OWNER_AUTHORITY
NEXT_PHASE_ALLOWED_ACTION=READ_ONLY_FORENSIC_REBASELINE_ONLY_AFTER_A_FRESH_CONTRACT
NEXT_PHASE_FORBIDDEN=NO_RECONCILIATION_REPAIR_NO_RUNTIME_WRITE_NO_RETRY_OF_D7_E4B
PHASE0_EXTERNAL_READ_AUTHORIZED=false
CODER_CLOSEOUT=FREEZE_AND_REPORT_NO_WRITERCOMPLETE_NO_CONTROLLERRELEASE
CONTROLLER_NEXT_ACTION=INDEPENDENTLY_CONFIRM_FROZEN_CANDIDATE_THEN_EXACT_ACTIVE_ONLY_WRITERCOMPLETE_AND_ONLY_AFTER_COMPLETED_EXACT_CONTROLLERRELEASE
