# Offline exact17 reconciliation and adjudication plan V1

PHASE_ID=SGDS_OFFLINE_EXACT17_RECONCILIATION_PLAN_V1
TASK_ID=01a0508a-ca2d-72b0-8138-e60315864d31
WRITER_ID=01a0508a-ca2d-72b0-8138-e60315864d31
STATUS=ACTIVE
OWNER_AUTHORITY=DIRECT_OWNER_DELEGATED_TO_PHASE_CONTROLLER
AUTHORITY_ID=OWNER_GO_OFFLINE_EXACT17_RECONCILIATION_PLAN_V1_20260920
CURRENT_AUTHORITY_ASSIGNMENT_ID=SGDS_OFFLINE_EXACT17_RECONCILIATION_PLAN_REVIEW_CORRECTION_V2_01a0508a
CURRENT_AUTHORITY_CODER_THREAD_ID=01a0508a-ca2d-72b0-8138-e60315864d31
CURRENT_AUTHORITY_CODER_ROLE=SOLE_OFFLINE_RECONCILIATION_DOCUMENTATION_REVIEW_CORRECTION_CODER
CURRENT_AUTHORITY_ASSIGN_OPERATION_ID=offline-exact17-plan-review-correction-assign-01a0508a
CURRENT_AUTHORITY_VERIFY_OPERATION_ID=offline-exact17-plan-review-correction-verify-01a0508a
CURRENT_AUTHORITY_COMPLETE_OPERATION_ID=offline-exact17-plan-review-correction-complete-01a0508a
CURRENT_AUTHORITY_RELEASE_OPERATION_ID=offline-exact17-plan-review-correction-release-01a0508a
AUTHORITY_PREDECESSOR=FRESH_SOURCE_PROVENANCE_REVIEW_CORRECTION_V2_CLOSED_NONE_REVISION_224_CHECKPOINT_35ae93c6e34d478326c0b78a420c7c5e99188778
OWNER_GO_RECEIVED=GO_IN_REPLY_TO_GO_OFFLINE_EXACT17_RECONCILIATION_PLAN_FOUR_UNKNOWN_HOLD_NO_SYNC_NO_PRODUCTION
OWNER_BOOTSTRAP_EXCEPTION=NONE_CURRENT_ASSIGNMENT_WAS_CREATED_FROM_NONE_REVISION_224_BEFORE_DOCUMENT_MUTATION
RISK_CLASS=HIGH_SOURCE_RECONCILIATION_ADJUDICATION_WITH_LOCAL_ONLY_DOCUMENTATION
CURRENT_AUTHORITY_RULE=THE_TITLE_TO_FIRST_SECTION_PREAMBLE_IS_THE_ONLY_AUTHORITY_SOURCE_FOR_AUTHORITY_ID_CURRENT_AUTHORITY_ASSIGNMENT_ID_AND_CURRENT_AUTHORITY_CODER_THREAD_ID
CURRENT_AUTHORITY_BOUNDARY=RETAINED_EVIDENCE_ONLY_EXACT17_DISPOSITION_ACCEPTANCE_ROLLBACK_AND_OWNER_BUSINESS_GATE_PLAN_THEN_GOVERNED_FIVE_DOCUMENT_CLOSEOUT
READ_ONLY_SOURCE_SCOPE=D7_E4B_ExactFirestoreReconciliationRuntime.js;gmailLabels.js;gmailProcessInvoiceXML.js;gmailSearch.js;hashUtils.js;Invoice_AttachmentParser.js;main.js;sheetHoaDon.js;sheetMenu.js;sheetNhapXuat.js;sheetSidebar.html;sheetTonKho.js;sheetUtils.js;triggers.js;D7_E4C_ExactPreconditionDiagnostic.js;invoiceCanonical.js;SKU_ENGINE.js
MODEL_ROUTING=ADJUDICATION_SOL_HIGH;RETAINED_EVIDENCE_INSPECTION_LUNA_MEDIUM;CODER_TERRA_HIGH;REVIEWER_TERRA_HIGH;VERIFIER_TERRA_HIGH
AUTONOMOUS_ACTIONS=READ_SEALED_RETAINED_EVIDENCE;DEFINE_EXACT17_HOLD_DISPOSITIONS_ACCEPTANCE_ROLLBACK_AND_OWNER_GATES;NORMAL_HELPER_ISOLATION_CREATE_VALIDATE_CLEANUP;NORMAL_EXACT_CONTROLLER_WRITER_LIFECYCLE;ONE_CODER_FIVE_DOCUMENT_RECORD_AND_SAME_SCOPE_CORRECTIONS;INDEPENDENT_REVIEW_VERIFY
DOCUMENTATION_WRITE_SCOPE=docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md;docs/12_AI_WORK_LOG.md;docs/13_DECISION_LOG.md;docs/99_NEXT_AI_HANDOFF.md;docs/FILE_MANIFEST.md
REMOTE_PROVENANCE_READ_BUDGET=CONSUMED_BY_ONE_SUCCESSFUL_FRESH_CLONE_ATTEMPT_NO_RETRY_NO_SECOND_FETCH_NO_RERUN
EXACT_SCRIPT_ID=19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM
PRODUCTION_READ_ONLY_INVOCATION_BUDGET=PRIOR_UNCONSUMED_NOT_AUTHORIZED_BY_THIS_SOURCE_AUDIT
PRODUCTION_READ_LIMITS=GMAIL_ONE_EXACT_MESSAGE;DRIVE_MAX_TWO_FILES_PER_ARTIFACT;SHEETS_MAX_TWO_EXACT_ROWS;FIRESTORE_MAX_FIVE_EXACT_DOCUMENT_READS
HARD_STOPS=AMBIGUOUS_AUTHORITY_IDENTITY_SECOND_WRITER_SCOPE_EXPANSION_NEW_FETCH_NETWORK_OR_PRODUCTION_ACCESS_UNEXPECTED_DRIFT_OUTSIDE_FROZEN_SCOPE_ANY_SOURCE_IMPORT_OVERWRITE_SYNC_RECONCILIATION_OR_DATA_MUTATION_REQUEST_ABNORMAL_RECOVERY_CHECKPOINT_COMMIT_PUSH_OWNER_BUSINESS_POLICY_SELECTION
FORBIDDEN=NO_APPLICATION_SOURCE_TEST_CHECKER_OR_NONLISTED_DOCUMENT_EDIT_NO_NEW_FETCH_NETWORK_SOURCE_IMPORT_OVERWRITE_SYNC_CLASP_PUSH_OR_REPOSITORY_PULL_NO_RECONCILIATION_REPAIR_OR_PRODUCTION_ACCESS_OR_MUTATION_NO_GMAIL_DRIVE_SHEETS_FIRESTORE_SCRIPT_PROPERTY_MARKER_TRIGGER_IAM_ACL_CREDENTIAL_DEPLOY_GIT_STAGE_COMMIT_PUSH_NO_MANUAL_WRITER_OR_ISOLATION_STATE_MUTATION_NO_PROTECTED_W_W1_CHANGE

## Current authority and authoring state

This section records a non-liveness authoring snapshot for the offline plan
review correction. The initial plan authoring reached WriterComplete revision
`227` and ControllerRelease slot `NONE` revision `228`. Fresh InspectWriter then
observed that terminal state before ControllerAssign and ControllerVerify
established the exact correction binding
`authority_id=OWNER_GO_OFFLINE_EXACT17_RECONCILIATION_PLAN_V1_20260920`,
`assignment_id=SGDS_OFFLINE_EXACT17_RECONCILIATION_PLAN_REVIEW_CORRECTION_V2_01a0508a`,
and `writer_id=01a0508a-ca2d-72b0-8138-e60315864d31` as `ACTIVE`, revision `230`.
This observation does not prove later slot liveness. Every later session must
use fresh InspectWriter evidence before lifecycle routing; no historical
assignment may be replayed.

The authorized documentation delta is exactly these five paths:

- `docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md`
- `docs/12_AI_WORK_LOG.md`
- `docs/13_DECISION_LOG.md`
- `docs/99_NEXT_AI_HANDOFF.md`
- `docs/FILE_MANIFEST.md`

No application source, tests, checkers, other documentation, control-plane
state, isolation state, Git index, protected `w`/`w1`, or external system may
be changed by this Coder. The Coder must freeze after local documentation
validation and must not invoke WriterComplete or ControllerRelease.

## Fresh source provenance evidence

The sealed immutable evidence root is
`C:\Users\Admin\.codex\sgds-evidence\source-provenance-20260915-v1`.
The supplied byte identities are `provenance-analysis.md` SHA-256
`323d0f9223beaba20eaa9001eba532a42518da20a19b341ab9d23a125179b946`,
`provenance-history.json` SHA-256
`e442a5100c7ca374573a31e9fe8fff2e8247424e19b7c8cffb60cb47f6485802`, and
`inventory.json` SHA-256
`0f137d2e160370d7f2490298e40a3a7ff9d2bcf463cdafddbbb336e579fafe27`.
They are evidence-byte identities, not author attribution, deployment proof,
live-state proof, or authorization to synchronize source.

- The sole fresh source fetch completed with `attempt=1`, `retry=0`, and
  `exit=0`. Its budget is `CONSUMED_NO_RERUN`; no subsequent source fetch is
  authorized.
- Frozen inventory is 80 local clasp-tracked files, 81 remote files, 79 common
  files, 51 raw exact files, 14 line-ending-only files, 14 content-different
  files, one local-only E4C file, and two remote-only files
  (`invoiceCanonical.js`, `SKU_ENGINE.js`).
- Independent Luna inventory verification passed all byte, count, scope, and
  receipt checks. The count of 80 remains correct because direct clasp status
  excludes `d6jPilotReadiness.js`; the separate 81-file Git source-like set
  includes that clasp-ignored file.
- Sol examined 202 locally reachable commits and 37 exact-path blobs. Twelve
  remote variants have exact raw historic matches and coexist at
  `6b16ef51bfcb4455453b528879057a34f4db9eed`; four remain UNKNOWN after raw and
  LF comparison; remote absence of E4C is a distinct known local lineage.

## Exact 17-path provenance disposition

`K` means the remote raw bytes have a historic witness at the shared commit;
`U` means raw and LF history found no match; `A` means the remote file is
absent. Every row is recoverable from the sealed analysis/history/inventory
identities above.

| Path | Remote disposition | Historic witness/blob or evidence pointer |
| --- | --- | --- |
| D7_E4B_ExactFirestoreReconciliationRuntime.js | K | `6b16ef51...:5ff038c9f1aae44adabd5cd3780c4dfd36edf9a9` |
| D7_E4C_ExactPreconditionDiagnostic.js | A | local known lineage; remote absent |
| Invoice_AttachmentParser.js | K | `6b16ef51...:d4b4f6b4b27245dcadca5ed2eae42fe7a5e0d79b` |
| SKU_ENGINE.js | U | `provenance-history.json`; zero reachable exact-path versions |
| gmailLabels.js | K | `6b16ef51...:3f10beb8e1429d699fb9da851cb21435e62c8c54` |
| gmailProcessInvoiceXML.js | K | `6b16ef51...:67e622fc2d37f017eeb128f1cc3905b0b67cf605` |
| gmailSearch.js | K | `6b16ef51...:3b3076b9ff056fb291d7e3df47da4e88310abd78` |
| hashUtils.js | K | `6b16ef51...:feeb60dc214a95f66b35b3e61fc18251d9c77a4f` |
| invoiceCanonical.js | K | `6b16ef51...:a34fdaeaa889b61619ac81d050ad5b2c52fad1bb` |
| main.js | K | `6b16ef51...:02af2c33dc5216ba64d4428d8e68c28223bbee3d` |
| sheetHoaDon.js | K | `6b16ef51...:6fbb9a817ffa22c64a37c4ea9e7e65bd4ab8de3d` |
| sheetMenu.js | U | `provenance-history.json` |
| sheetNhapXuat.js | U | `provenance-history.json` |
| sheetSidebar.html | K | `6b16ef51...:26f5dd1e14d38e1121d7955e3ce115d3dc16f163` |
| sheetTonKho.js | U | `provenance-history.json` |
| sheetUtils.js | K | `6b16ef51...:30015b8ad6f7a75420bc46dbcdb50d31d49c0291` |
| triggers.js | K | `6b16ef51...:88d9c58d3a2849f7c30d6990126794fd37907830` |

The known remote variants are not a full-parity claim, a defective mixed-era
claim, an intentional-deletion claim, or author provenance. In particular,
`invoiceCanonical.js` has known divergent lineage but no deletion evidence;
`SKU_ENGINE.js`, `sheetMenu.js`, `sheetNhapXuat.js`, and `sheetTonKho.js` are
UNKNOWN. `FULL_PROJECT_SEMANTIC_PARITY=false` remains the hard stop.

The report records coupled behavior requiring business adjudication before any
future action: E4B/E4C API and evidence-schema coupling; legacy versus
approved-V2 identity; partial retry/file completion; formula/history/registry
and edit mutations; Nhap-Xuat/Ton-Kho completion, ordering, and oversell; and
SKU monthly-costing, unit, and opening-balance policy. `SKU_ENGINE.js` setup,
approval, and dry-run/output functions write Sheets even when
`ProductionCommit` is disabled.

## Offline exact17 reconciliation plan

This phase does not select local or remote as authoritative. `HOLD-K` means the
remote bytes have a retained historic witness but are not approved for import;
`HOLD-A` means the local-only dependency is retained without a deletion or
deployment claim; `HOLD-U` means no reachable exact-path raw or LF witness was
found and the remote bytes remain quarantined from any candidate. These are
current safety dispositions, not future keep/adapt/remove business decisions.

| Path | Evidence class | Current disposition | Coupled future gate |
| --- | --- | --- | --- |
| D7_E4B_ExactFirestoreReconciliationRuntime.js | K | HOLD-K | Adjudicate atomically with E4C and complete evidence schema |
| D7_E4C_ExactPreconditionDiagnostic.js | A | HOLD-A | Retain local dependency until E4B/E4C candidate is selected |
| Invoice_AttachmentParser.js | K | HOLD-K | Approve PDF review and XML/PDF association policy |
| SKU_ENGINE.js | U | HOLD-U | Require immutable provenance plus SKU/unit/opening/monthly-cost policy |
| gmailLabels.js | K | HOLD-K | Adjudicate with search, scanner ownership, and completion projection |
| gmailProcessInvoiceXML.js | K | HOLD-K | Approve identity, line ordinal, and artifact-content policy |
| gmailSearch.js | K | HOLD-K | Adjudicate atomically with label and partial-retry lifecycle |
| hashUtils.js | K | HOLD-K | Approve durable line identity and collision/replay policy |
| invoiceCanonical.js | K | HOLD-K | Approve legacy-to-V2 identity and historical O/P writes |
| main.js | K | HOLD-K | Approve formula/history mutation and replay ownership |
| sheetHoaDon.js | K | HOLD-K | Approve registry conflict, View ownership, and repair policy |
| sheetMenu.js | U | HOLD-U | Require immutable provenance and SKU command exposure decision |
| sheetNhapXuat.js | U | HOLD-U | Require immutable provenance plus ordering/oversell/history policy |
| sheetSidebar.html | K | HOLD-K | Adjudicate with producer run identity and terminal protocol |
| sheetTonKho.js | U | HOLD-U | Require immutable provenance plus ordering/oversell/log policy |
| sheetUtils.js | K | HOLD-K | Approve run-ID-bound progress semantics; TTL alone is insufficient |
| triggers.js | K | HOLD-K | Approve edit identity, audit, and reconciliation-flag consumer |

The four `HOLD-U` paths are exactly `SKU_ENGINE.js`, `sheetMenu.js`,
`sheetNhapXuat.js`, and `sheetTonKho.js`. No evidence in this phase upgrades
them to known lineage. All 12 `HOLD-K` remote variants remain bound to witness
commit `6b16ef51bfcb4455453b528879057a34f4db9eed`; the one `HOLD-A` path remains
bound to the local checkpoint. No row authorizes source assembly.

### Required Owner adjudications

1. Choose the durable invoice and line identity contract, including 10-3 tax
   identity, legacy replay, PDF/XML association, and collision handling.
2. Approve or reject historical Sheet mutation ownership for registry, O/P
   keys/formulas, edit-trigger repair, actor/reason/timestamp audit, and
   concurrent edit preservation.
3. Choose the partial-thread retry and completion contract across Gmail labels,
   scanner file flags, source ordinals, and projection status.
4. Choose Nhap-Xuat/Ton-Kho ordering, oversell, invalid-date, logging, and
   run-ID-bound terminal semantics.
5. Provide immutable provenance and a keep/adapt/remove decision for the SKU
   extension, including units, aliases, opening balances, monthly costing,
   Sheet-writing dry runs, and menu exposure.

Until all five adjudications are explicit, the coherent candidate is
`NOT_FORMED` and all 17 paths remain HOLD. Evidence may prove byte lineage but
cannot decide these business semantics.

### Future candidate acceptance and rollback contract

A later local-source implementation gate may be proposed only when all of the
following are reviewable before mutation:

- exact 17-path candidate operation (`KEEP_LOCAL`, `ADAPT`, or `REMOVE`) and
  final SHA-256 for every candidate path, with no implicit files;
- the four `HOLD-U` paths resolved by immutable provenance or explicit Owner
  disposition, without relabeling UNKNOWN as known;
- one atomic E4B/E4C API/evidence schema and one atomic Gmail retry/completion
  lifecycle;
- explicit invoice/line identity, historical-write audit, Nhap-Xuat/Ton-Kho,
  and SKU policy decisions corresponding to the five gates above;
- focused syntax/unit/static checks for every changed module, governance A-Q
  exactly `17/0/0/0`, aggregate checks with zero failure, `git diff --check`,
  exact scope/hash verification, and independent Reviewer plus Verifier PASS;
- no source sync, production read, production mutation, commit, or push inside
  that future implementation envelope unless separately authorized.

The rollback baseline for any future local candidate is checkpoint
`35ae93c6e34d478326c0b78a420c7c5e99188778`. The future proposal must include
an exact inverse patch or exact-path restore plan to that baseline before any
implementation. This is a local-source rollback only; it does not imply a GAS
or production rollback and cannot authorize either boundary.

## Allowed mutation scope

This exact 25-path list is retained only as the historical Phase 0 candidate
identity required by the local static governance checker. It does not widen
the current five-document `DOCUMENTATION_WRITE_SCOPE` in the authoritative
preamble.

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

## Production boundary and disposition

No source synchronization, production data access, or production mutation is
authorized or performed. Fresh-phase counters are Gmail/Drive/Sheets/Firestore
reads `0/0/0/0`, source sync `0`, clasp push `0`, and production reconciliation
or repair `0`. The earlier production-read budget remains unconsumed but is not
authorized by this source audit. No stage, commit, push, deployment, repository
pull, or lifecycle action was performed by this Coder.

## Next direction

CURRENT_PHASE=SGDS_OFFLINE_EXACT17_RECONCILIATION_PLAN_V1
CURRENT_PHASE_STATUS=NON_LIVENESS_REVIEW_CORRECTION_SNAPSHOT_ACTIVE_REVISION_230
PRIOR_PHASE_TERMINAL=WRITERCOMPLETE_REVISION_223_CONTROLLERRELEASE_NONE_REVISION_224_CHECKPOINT_35ae93c6e34d478326c0b78a420c7c5e99188778
PLAN_AUTHORING_TERMINAL=WRITERCOMPLETE_REVISION_227_CONTROLLERRELEASE_NONE_REVISION_228
CORRECTION_LIFECYCLE_EXPECTED_NOT_OBSERVED=WRITERCOMPLETE_REVISION_231_CONTROLLERRELEASE_NONE_REVISION_232
PLAN_RESULT=PLAN_DEFINED_CANDIDATE_NOT_FORMED_ALL_17_HOLD_FOUR_UNKNOWN_HOLD
HARD_STOP=OWNER_BUSINESS_ADJUDICATION_REQUIRED_BEFORE_LOCAL_SOURCE_CANDIDATE
SOURCE_FETCH_BUDGET=CONSUMED_NO_RERUN
CODER_CLOSEOUT=FREEZE_AND_REPORT_NO_WRITERCOMPLETE_NO_CONTROLLERRELEASE
IMMEDIATE_NEXT_SEQUENCE=FRESH_INSPECTWRITER_THEN_ONLY_IF_EXACT_CORRECTION_BINDING_IS_ACTIVE_CONTROLLER_WRITERCOMPLETE_EXPECTED_231_AND_CONTROLLERRELEASE_NONE_EXPECTED_232;IF_INSPECTWRITER_ALREADY_SHOWS_NONE_REVISION_232_DO_NOT_REPLAY_LIFECYCLE_AND_PROCEED_TO_FRESH_ISOLATED_INDEPENDENT_REVIEWER_AND_VERIFIER_AND_CLEANUP_THEN_OWNER_BUSINESS_ADJUDICATION_GATE
NEXT_DIRECTION=OWNER_ADJUDICATES_FIVE_COUPLED_BUSINESS_POLICY_GROUPS_AND_PROVIDES_PROVENANCE_OR_EXPLICIT_KEEP_ADAPT_REMOVE_FOR_FOUR_UNKNOWN_PATHS
NEXT_IMPLEMENTATION_SCOPE=NOT_AUTHORIZED_AND_NOT_FORMED
NEXT_FORBIDDEN=NO_IMPORT_OVERWRITE_SYNC_PRODUCTION_ACCESS_DATA_ACTION_COMMIT_OR_PUSH
