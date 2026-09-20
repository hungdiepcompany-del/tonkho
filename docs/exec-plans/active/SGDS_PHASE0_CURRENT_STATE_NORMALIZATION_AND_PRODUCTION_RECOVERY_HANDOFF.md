# Exact17 local source candidate plan V1

PHASE_ID=SGDS_EXACT17_LOCAL_CANDIDATE_PLAN_V1
TASK_ID=01a0508a-ca2d-72b0-8138-e60315864d31
WRITER_ID=01a0508a-ca2d-72b0-8138-e60315864d31
STATUS=ACTIVE
OWNER_AUTHORITY=DIRECT_OWNER_DELEGATED_TO_PHASE_CONTROLLER
AUTHORITY_ID=OWNER_GO_EXACT17_LOCAL_CANDIDATE_PLAN_RECOMMENDED_POLICY_V1_20260920
CURRENT_AUTHORITY_ASSIGNMENT_ID=SGDS_EXACT17_LOCAL_CANDIDATE_PLAN_REVIEW_CORRECTION_V2_01a0508a
CURRENT_AUTHORITY_CODER_THREAD_ID=01a0508a-ca2d-72b0-8138-e60315864d31
CURRENT_AUTHORITY_CODER_ROLE=SOLE_LOCAL_CANDIDATE_PLAN_REVIEW_CORRECTION_CODER
CURRENT_AUTHORITY_ASSIGN_OPERATION_ID=exact17-local-candidate-plan-review-correction-assign-01a0508a
CURRENT_AUTHORITY_VERIFY_OPERATION_ID=exact17-local-candidate-plan-review-correction-verify-01a0508a
CURRENT_AUTHORITY_COMPLETE_OPERATION_ID=exact17-local-candidate-plan-review-correction-complete-01a0508a
CURRENT_AUTHORITY_RELEASE_OPERATION_ID=exact17-local-candidate-plan-review-correction-release-01a0508a
AUTHORITY_PREDECESSOR=OFFLINE_EXACT17_PLAN_REVIEW_CORRECTION_CLOSED_NONE_REVISION_232_CHECKPOINT_0141c113be8a85ef04c98f96fc15aae8bd1610b6
OWNER_GO_RECEIVED=GO_IN_REPLY_TO_OWNER_ADJUDICATION_RECOMMENDED_POLICY_FOUR_UNKNOWN_HOLD_FORM_LOCAL_CANDIDATE_PLAN_ONLY_NO_SYNC_NO_PRODUCTION
OWNER_BOOTSTRAP_EXCEPTION=NONE_CURRENT_ASSIGNMENT_WAS_CREATED_FROM_NONE_REVISION_224_BEFORE_DOCUMENT_MUTATION
RISK_CLASS=HIGH_SOURCE_CANDIDATE_DESIGN_WITH_LOCAL_ONLY_DOCUMENTATION
CURRENT_AUTHORITY_RULE=THE_TITLE_TO_FIRST_SECTION_PREAMBLE_IS_THE_ONLY_AUTHORITY_SOURCE_FOR_AUTHORITY_ID_CURRENT_AUTHORITY_ASSIGNMENT_ID_AND_CURRENT_AUTHORITY_CODER_THREAD_ID
CURRENT_AUTHORITY_BOUNDARY=OWNER_APPROVED_POLICY_TO_EXACT17_LOCAL_OPERATION_MATRIX_CLUSTERED_IMPLEMENTATION_ACCEPTANCE_AND_ROLLBACK_PLAN_THEN_GOVERNED_FIVE_DOCUMENT_CLOSEOUT
READ_ONLY_SOURCE_SCOPE=D7_E4B_ExactFirestoreReconciliationRuntime.js;gmailLabels.js;gmailProcessInvoiceXML.js;gmailSearch.js;hashUtils.js;Invoice_AttachmentParser.js;main.js;sheetHoaDon.js;sheetMenu.js;sheetNhapXuat.js;sheetSidebar.html;sheetTonKho.js;sheetUtils.js;triggers.js;D7_E4C_ExactPreconditionDiagnostic.js;invoiceCanonical.js;SKU_ENGINE.js
MODEL_ROUTING=CANDIDATE_ARCHITECTURE_SOL_HIGH;BASELINE_HASH_INSPECTION_LUNA_MEDIUM;CODER_TERRA_HIGH;REVIEWER_TERRA_HIGH;VERIFIER_TERRA_HIGH
AUTONOMOUS_ACTIONS=READ_LOCAL_APPROVED_ARCHITECTURE_DATA_CONTRACT_OWNER_DECISIONS_AND_SEALED_PROVENANCE;DEFINE_EXACT17_LOCAL_OPERATION_MATRIX_CLUSTERED_FUTURE_IMPLEMENTATION_ACCEPTANCE_AND_ROLLBACK;NORMAL_HELPER_ISOLATION_CREATE_VALIDATE_CLEANUP;NORMAL_EXACT_CONTROLLER_WRITER_LIFECYCLE;ONE_CODER_FIVE_DOCUMENT_RECORD_AND_SAME_SCOPE_CORRECTIONS;INDEPENDENT_REVIEW_VERIFY
DOCUMENTATION_WRITE_SCOPE=docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md;docs/12_AI_WORK_LOG.md;docs/13_DECISION_LOG.md;docs/99_NEXT_AI_HANDOFF.md;docs/FILE_MANIFEST.md
REMOTE_PROVENANCE_READ_BUDGET=CONSUMED_BY_ONE_SUCCESSFUL_FRESH_CLONE_ATTEMPT_NO_RETRY_NO_SECOND_FETCH_NO_RERUN
EXACT_SCRIPT_ID=19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM
PRODUCTION_READ_ONLY_INVOCATION_BUDGET=PRIOR_UNCONSUMED_NOT_AUTHORIZED_BY_THIS_SOURCE_AUDIT
PRODUCTION_READ_LIMITS=GMAIL_ONE_EXACT_MESSAGE;DRIVE_MAX_TWO_FILES_PER_ARTIFACT;SHEETS_MAX_TWO_EXACT_ROWS;FIRESTORE_MAX_FIVE_EXACT_DOCUMENT_READS
HARD_STOPS=AMBIGUOUS_AUTHORITY_IDENTITY_SECOND_WRITER_SCOPE_EXPANSION_NEW_FETCH_NETWORK_OR_PRODUCTION_ACCESS_UNEXPECTED_DRIFT_OUTSIDE_FROZEN_SCOPE_ANY_APPLICATION_SOURCE_TEST_CHECKER_IMPORT_OVERWRITE_SYNC_RECONCILIATION_OR_DATA_MUTATION_REQUEST_ABNORMAL_RECOVERY_CHECKPOINT_COMMIT_PUSH
FORBIDDEN=NO_APPLICATION_SOURCE_TEST_CHECKER_OR_NONLISTED_DOCUMENT_EDIT_NO_NEW_FETCH_NETWORK_SOURCE_IMPORT_OVERWRITE_SYNC_CLASP_PUSH_OR_REPOSITORY_PULL_NO_RECONCILIATION_REPAIR_OR_PRODUCTION_ACCESS_OR_MUTATION_NO_GMAIL_DRIVE_SHEETS_FIRESTORE_SCRIPT_PROPERTY_MARKER_TRIGGER_IAM_ACL_CREDENTIAL_DEPLOY_GIT_STAGE_COMMIT_PUSH_NO_MANUAL_WRITER_OR_ISOLATION_STATE_MUTATION_NO_PROTECTED_W_W1_CHANGE

## Current authority and authoring state

This section records a non-liveness authoring snapshot for the local candidate
plan review correction. Initial candidate-plan authoring reached WriterComplete
revision `235` and ControllerRelease slot `NONE` revision `236`. Fresh
InspectWriter observed that terminal state before ControllerAssign and
ControllerVerify established the exact correction binding
`authority_id=OWNER_GO_EXACT17_LOCAL_CANDIDATE_PLAN_RECOMMENDED_POLICY_V1_20260920`,
`assignment_id=SGDS_EXACT17_LOCAL_CANDIDATE_PLAN_REVIEW_CORRECTION_V2_01a0508a`,
and `writer_id=01a0508a-ca2d-72b0-8138-e60315864d31` as `ACTIVE`, revision `238`.
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

The offline planning baseline was checkpoint
`35ae93c6e34d478326c0b78a420c7c5e99188778`. That planning statement is
superseded by the Owner-approved local candidate baseline below. Both are
local-source references only and imply no GAS or production rollback authority.

## Owner-approved local candidate operation matrix

The Owner's `go` adopts the repository's already-approved 20 business
decisions as the candidate policy: InvoiceKeyV2 and LineIdentityV2, append-only
history with audited corrections, per-invoice completion, blocked oversell,
`issueDate` then immutable `transactionSequence` then `sourceLineNo`, and no
SKU extension. `ADAPT_FROM_LOCAL` means implement from the local baseline and
approved contracts; it never means copy fetched remote bytes. Baseline hashes
below are raw SHA-256 at checkpoint `0141c113...`.

| Path | Provenance | Candidate operation | Local baseline SHA-256 | Required outcome |
| --- | --- | --- | --- | --- |
| D7_E4B_ExactFirestoreReconciliationRuntime.js | K | KEEP_LOCAL | `e129f31da8871ec8439429e1f0736242e9a2bb58c510c6d53526adbd725459e8` | Preserve atomic E4B/E4C strict evidence contract |
| D7_E4C_ExactPreconditionDiagnostic.js | A | KEEP_LOCAL | `6d8e397c737ecbf880bfc239255ef2f5f8521f394dba5ea1e847b907255c245e` | Preserve PASS/FAIL/NOT_PROVEN dependency |
| Invoice_AttachmentParser.js | K | ADAPT_FROM_LOCAL | `99524c63be0ad7423409e240f7fc0a8dde3448e3522b76f51625b4071dc91c82` | Strict XML identity; PDF/OCR review-only; content-bound association |
| SKU_ENGINE.js | U | EXCLUDE_REMOTE_ONLY | ABSENT | Do not add SKU schemas, writes, commands, or menu exposure |
| gmailLabels.js | K | ADAPT_FROM_LOCAL | `a1c3e9c9c1d1e031225c7fe11d9305e66dcc0d22a34718d19a367a15dc35bc8a` | Labels remain projection; PENDING survives until each invoice completes |
| gmailProcessInvoiceXML.js | K | ADAPT_FROM_LOCAL | `c607ed7e87374008881b27a17a20fce58a21ad95d49a7bc9204a659799946729` | Emit V2 invoice/line identity and immutable sourceLineNo |
| gmailSearch.js | K | ADAPT_FROM_LOCAL | `49afbf5477d7770112e6f8ad39338ba755e6dfb880ea789abdf4bc72464f45c8` | Rediscover partial PENDING work without reopening completed jobs |
| hashUtils.js | K | ADAPT_FROM_LOCAL | `d90fe6c8f4a4e6f6d9cbcd361594e0596017a8940fae2509a4e2b423c3e1b621` | Use LineIdentityV2 and preserve distinct economic lines/collisions |
| invoiceCanonical.js | K | EXCLUDE_REMOTE_ONLY | ABSENT | Do not add legacy O/P history rewrite module |
| main.js | K | ADAPT_FROM_LOCAL | `cc6a8cfc060e9ec5371fba94ce41aa780c232c937806219f47340a13455e8b71` | Per-invoice commit result; append-only audited reconciliation; no silent history rewrite |
| sheetHoaDon.js | K | ADAPT_FROM_LOCAL | `c40b750381209ec4d3426cea7fe2b212e66a385d924dbfadc412c87243de0b15` | V2 registry validation; preserve original artifacts; no destructive repair |
| sheetMenu.js | U | KEEP_LOCAL | `6d7557a20aa6388cb25ba737781589e740a7bb21727138508324c7d6c39b59a2` | Keep SKU commands absent |
| sheetNhapXuat.js | U | ADAPT_FROM_LOCAL | `3cf29728afdf6f9096d998839f203d5abb2e61f7b263e78c61b8f170e89d5c66` | Append-only sequence/order validation; block oversell; audited rebuild |
| sheetSidebar.html | K | ADAPT_FROM_LOCAL | `cee02ec030eb2ce8762d1716a5c32f7587c35165afef5132e0bdf1f3e1b88677` | Bind progress and terminal state to exact run ID; failure cannot start downstream work |
| sheetTonKho.js | U | ADAPT_FROM_LOCAL | `6c3a87e1f1ace9d5ffad8be76da23c66762b244230fb799995dc4b3df20d2a26` | Rebuild canonical ledger order; reject oversell/invalid dates; atomic run completion |
| sheetUtils.js | K | ADAPT_FROM_LOCAL | `ae44577646e6776dbbb11d2a2749cd7a38ba943738d71608055a8b0f8648f8b1` | Run-ID-bound progress; TTL is cache policy only, never completion proof |
| triggers.js | K | ADAPT_FROM_LOCAL | `0fdd9481507bd897fdd37f2a688c621593b5ce6b758449f3f20bf492fcc05e6a` | Block direct historical edits; route audited V2 reconciliation commands |

The matrix has exactly 12 `ADAPT_FROM_LOCAL`, three `KEEP_LOCAL`, and two
`EXCLUDE_REMOTE_ONLY` operations. The remote UNKNOWN byte identities remain
quarantined and must never be copied or treated as implementation input:

- `SKU_ENGINE.js` remote SHA-256 `4879f2ea2bd713c0272ba746c77b7c150e2ba2fd4afb5d87d23ecde7cc8dfebb`;
- `sheetMenu.js` remote SHA-256 `89aab56ed5ee61b74d6bffa00074a04f798dbdfa4a06104ef4ff64747031eb62`;
- `sheetNhapXuat.js` remote SHA-256 `eccb36d9827489e049b8ade3f83da9f78f7f87c6a2169134bc175bae79467967`;
- `sheetTonKho.js` remote SHA-256 `0cba78a63caf5ba3d4ea9326a376380d0400ed0bc1431c204ac0ba9433ab7165`.

### Proposed future implementation clusters

1. Identity and immutable commit core: parser, XML processor, hash utilities,
   registry, main, and triggers. Prove V2 identity, append-only writes,
   per-invoice result isolation, and audit before proceeding.
2. Gmail retry projection: labels, search, and main integration. Prove PENDING
   discoverability without duplicate commits or false thread completion.
3. Inventory and terminal protocol: Nhap-Xuat, TonKho, sidebar, and utilities.
   Prove immutable ordering, oversell rejection, rebuild boundary, run identity,
   and failure-safe sequencing.
4. Integration freeze: E4B/E4C unchanged, SKU and invoiceCanonical absent,
   exact17 hashes frozen, full acceptance, independent review and rollback.

The exact17 matrix is a policy/disposition plan, not a closed implementation
scope. Reviewer call-graph inspection found approved V2 and append-only behavior
in files outside exact17, including `durableJobState.js`,
`sgdsSheetsLedgerAdapter.js`, `durableReconciliation.js`, `gmailScanner.js`,
`_triggerDriveScanner.js`, `sheetWriter.js`, and `Shared_Hashing.js`. This list
is evidence of scope incompleteness, not a proposed mutation allowlist and not
an assertion that dependency closure is complete.

No implementation envelope may therefore be formed from the twelve
`ADAPT_FROM_LOCAL` rows alone. A fresh bounded read-only dependency-closure
phase must inspect the complete identity, Gmail/Drive ingestion, commit,
reconciliation, inventory, progress, trigger, and test/checker call graph. It
must return one exact minimal source/test/checker/document scope and cluster
boundaries before any source-writing GO. This phase authorizes none of those
reads outside the evidence already inspected by Reviewer and none of those
writes.

### Candidate acceptance and rollback

- All 17 final candidate states must match this operation matrix, and every
  present path must have a frozen final SHA-256 before source checkpoint.
- No candidate byte may equal any quarantined UNKNOWN remote hash above unless
  separately proven as an independently authored result and explicitly
  adjudicated; direct import remains forbidden.
- Identity fixtures must cover symbol-bearing InvoiceKeyV2, economic
  LineIdentityV2, same quantity with different price, multi-invoice thread,
  adjustment/replacement/cancellation, and collision-safe replay.
- History fixtures must prove no direct edit/delete, audited correction,
  earliest-affected rebuild, concurrent edit preservation, and zero silent O/P
  rewrite.
- Retry fixtures must prove partial completion, PENDING rediscovery,
  per-invoice projection, idempotent replay, and no false completed thread.
- Inventory fixtures must prove immutable order, invalid-date rejection,
  oversell block/review, exact run-ID terminal state, and no failed NX to TK
  chaining.
- Governance A-Q must be `17/0/0/0`; focused and aggregate checks must have zero
  failure; scope/hash/diff checks and independent Reviewer/Verifier must PASS.
- Rollback baseline is checkpoint
  `0141c113be8a85ef04c98f96fc15aae8bd1610b6`. Each implementation cluster must
  carry an exact inverse patch or exact-path restore plan before mutation.
- Source sync, production reads/writes, commit, push, deployment, marker, IAM,
  trigger, Gmail, Drive, Sheets, and Firestore operations remain separate gates.

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

CURRENT_PHASE=SGDS_EXACT17_LOCAL_CANDIDATE_PLAN_V1
CURRENT_PHASE_STATUS=NON_LIVENESS_REVIEW_CORRECTION_SNAPSHOT_ACTIVE_REVISION_238
PRIOR_PHASE_TERMINAL=WRITERCOMPLETE_REVISION_231_CONTROLLERRELEASE_NONE_REVISION_232_CHECKPOINT_0141c113be8a85ef04c98f96fc15aae8bd1610b6
PLAN_AUTHORING_TERMINAL=WRITERCOMPLETE_REVISION_235_CONTROLLERRELEASE_NONE_REVISION_236
CORRECTION_LIFECYCLE_EXPECTED_NOT_OBSERVED=WRITERCOMPLETE_REVISION_239_CONTROLLERRELEASE_NONE_REVISION_240
PLAN_RESULT=EXACT17_POLICY_OPERATION_MATRIX_FORMED_IMPLEMENTATION_SCOPE_NOT_CLOSED_NO_SOURCE_BYTES_12_ADAPT_3_KEEP_2_EXCLUDE_FOUR_REMOTE_UNKNOWN_QUARANTINED
HARD_STOP=NO_APPLICATION_SOURCE_IMPLEMENTATION_UNTIL_FRESH_BOUNDED_READ_ONLY_WHOLE_PATH_DEPENDENCY_CLOSURE_AND_LATER_EXACT_OWNER_ENVELOPE
SOURCE_FETCH_BUDGET=CONSUMED_NO_RERUN
CODER_CLOSEOUT=FREEZE_AND_REPORT_NO_WRITERCOMPLETE_NO_CONTROLLERRELEASE
IMMEDIATE_NEXT_SEQUENCE=FRESH_INSPECTWRITER_THEN_ONLY_IF_EXACT_CORRECTION_BINDING_IS_ACTIVE_CONTROLLER_WRITERCOMPLETE_EXPECTED_239_AND_CONTROLLERRELEASE_NONE_EXPECTED_240;IF_INSPECTWRITER_ALREADY_SHOWS_NONE_REVISION_240_DO_NOT_REPLAY_LIFECYCLE_AND_PROCEED_TO_FRESH_ISOLATED_INDEPENDENT_REVIEWER_AND_VERIFIER_AND_CLEANUP_THEN_OWNER_CHECKPOINT_GATE
NEXT_DIRECTION=AFTER_CHECKPOINT_REQUEST_FRESH_BOUNDED_READ_ONLY_WHOLE_PATH_DEPENDENCY_CLOSURE_TO_PRODUCE_ONE_MINIMAL_EXACT_SOURCE_TEST_CHECKER_DOCUMENT_SCOPE_AND_CLUSTER_PLAN
NEXT_IMPLEMENTATION_SCOPE=NOT_AUTHORIZED_PLAN_ONLY
NEXT_FORBIDDEN=NO_IMPORT_OVERWRITE_SYNC_PRODUCTION_ACCESS_DATA_ACTION_COMMIT_OR_PUSH
