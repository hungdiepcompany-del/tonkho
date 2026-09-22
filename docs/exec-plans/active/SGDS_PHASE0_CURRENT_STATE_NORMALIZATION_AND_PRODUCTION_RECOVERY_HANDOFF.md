# D7-E4D aggregate compatibility correction V1

PHASE_ID=SGDS_D7_E4D_AGGREGATE_COMPATIBILITY_CORRECTION_V1
TASK_ID=01a0508a-ca2d-72b0-8138-e60315864d31
WRITER_ID=01a0508a-ca2d-72b0-8138-e60315864d31
STATUS=ACTIVE
OWNER_AUTHORITY=DIRECT_OWNER_DELEGATED_TO_PHASE_CONTROLLER
AUTHORITY_ID=OWNER_GO_D7_E4D_AGGREGATE_COMPATIBILITY_CORRECTION_V1_20260921
CURRENT_AUTHORITY_ASSIGNMENT_ID=SGDS_D7_E4D_AGGREGATE_COMPATIBILITY_CORRECTION_V1_01a0508a
CURRENT_AUTHORITY_CODER_THREAD_ID=01a0508a-ca2d-72b0-8138-e60315864d31
CURRENT_AUTHORITY_CODER_ROLE=SOLE_D7_E4D_AGGREGATE_COMPATIBILITY_CODER
CURRENT_AUTHORITY_ASSIGN_OPERATION_ID=d7-e4d-aggregate-compat-assign-01a0508a
CURRENT_AUTHORITY_VERIFY_OPERATION_ID=d7-e4d-aggregate-compat-verify-01a0508a
CURRENT_AUTHORITY_COMPLETE_OPERATION_ID=d7-e4d-aggregate-compat-complete-01a0508a
CURRENT_AUTHORITY_RELEASE_OPERATION_ID=d7-e4d-aggregate-compat-release-01a0508a
AUTHORITY_PREDECESSOR=D7_E4D_ELIGIBILITY_COMPLETED_REVISION_255_RELEASED_NONE_REVISION_256_UNCOMMITTED_CANDIDATE
PREDECESSOR_AUTHORITY_ID=OWNER_GO_D7_E4D_LOCAL_ONLY_SAME_JOB_RECOVERY_ELIGIBILITY_V1_20260921
OWNER_GO_RECEIVED=GO_D7_E4D_AGGREGATE_COMPATIBILITY_CORRECTION_EXACT_7_PATHS
OWNER_BOOTSTRAP_EXCEPTION=OWNER_AUTHORIZED_CONTROL_PATCH_ACTIVE_CONTRACT_PREAMBLE_ONLY_FROM_PROVEN_NONE_REVISION_256_NO_WRITER_STATE_LOCK_LEASE_OR_ISOLATION_FABRICATION
RISK_CLASS=MEDIUM_LOCAL_GOVERNANCE_AGGREGATE_COMPATIBILITY
CURRENT_AUTHORITY_RULE=THE_TITLE_TO_FIRST_SECTION_PREAMBLE_IS_THE_ONLY_AUTHORITY_SOURCE_FOR_AUTHORITY_ID_CURRENT_AUTHORITY_ASSIGNMENT_ID_AND_CURRENT_AUTHORITY_CODER_THREAD_ID
CURRENT_AUTHORITY_BOUNDARY=OWNER_APPROVED_EXACT_7_PATH_LOCAL_ONLY_AGGREGATE_COMPATIBILITY_NO_APPLICATION_LOGIC_CHANGE
READ_ONLY_SOURCE_SCOPE=scripts/test/run-all-checks.mjs;scripts/checkers/check-ai-governance-bootstrap.mjs;tests/unit/ai-governance-bootstrap.test.mjs;package.json
MODEL_ROUTING=PLAN_SOL_HIGH;CODER_TERRA_HIGH;REVIEWER_SOL_HIGH;TESTER_LUNA_MEDIUM
AUTONOMOUS_ACTIONS=READ_LOCAL_EVIDENCE;NORMAL_EXACT_CONTROLLER_WRITER_LIFECYCLE;ONE_CODER_EXACT_7_PATH_CHECKER_COMPATIBILITY_CORRECTION;LOCAL_TEST_AND_STATIC_ACCEPTANCE;NORMAL_HELPER_ISOLATION_CREATE_VALIDATE_CLEANUP;INDEPENDENT_REVIEW_AND_TEST;GOVERNED_DOCUMENT_CLOSEOUT
ALLOWED_MUTATION_SCOPE=scripts/checkers/check-exact17-local-candidate-implementation.mjs;scripts/checkers/check-source-assembly-reconciliation.mjs;docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md;docs/12_AI_WORK_LOG.md;docs/13_DECISION_LOG.md;docs/99_NEXT_AI_HANDOFF.md;docs/FILE_MANIFEST.md
PRODUCTION_EVIDENCE_BASELINE=FRESH_EDITOR_D7_E3I_20260921_GMAIL_VERIFIED_DRIVE_XML_PDF_NOT_FOUND_SHEET_CANONICAL_ROW_ABSENT_FIRESTORE_JOB_VALIDATED_RECONCILIATION_REQUIRED_ZERO_MUTATION
EXACT_SCRIPT_ID=19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM
PRODUCTION_READ_ONLY_INVOCATION_BUDGET=CONSUMED_ONE_EDITOR_EXECUTION_NO_RERUN
PRODUCTION_MUTATION_AUTHORITY=NONE
HARD_STOPS=AMBIGUOUS_AUTHORITY_IDENTITY_SECOND_WRITER_SCOPE_EXPANSION_DRIFT_OUTSIDE_EXACT_7_PATHS_ANY_REMOTE_PULL_SOURCE_SYNC_OR_PRODUCTION_ACCESS_APPLICATION_LOGIC_CHANGE_ABNORMAL_RECOVERY_ACCEPTANCE_BELOW_17_PASS_0_FAIL_0_SKIP_0_TODO_CHECKPOINT_COMMIT_PUSH
FORBIDDEN=NO_NONLISTED_PATH_EDIT_NO_REMOTE_PULL_NO_CLASP_PUSH_NO_GAS_EXECUTION_NO_PRODUCTION_ACCESS_OR_MUTATION_NO_GMAIL_DRIVE_SHEETS_FIRESTORE_SCRIPT_PROPERTY_MARKER_TRIGGER_IAM_ACL_CREDENTIAL_DEPLOY_NO_GIT_STAGE_COMMIT_PUSH_NO_MANUAL_WRITER_OR_ISOLATION_STATE_MUTATION_NO_PROTECTED_W_W1_CHANGE

## Current aggregate compatibility correction

The first post-release Reviewer isolation proved that the D7-E4D implementation
and all `791` local tests passed, but aggregate acceptance stopped because two
inherited checkers still required an exact `76`-path candidate scope. The
canonical scope is now `80` paths and had already passed governance A-Q.

The correction removes only those stale numeric assumptions. Both checkers now
compare the parsed contract list directly with `phase0CandidateScope`, retain a
duplicate check, and bind the predecessor authority to its explicit historical
record rather than depending on stale preamble text. The source-assembly safety
check also verifies the current production and Git prohibitions as separate
tokens. No application runtime file or production boundary changes.

`ControllerAssign` and `ControllerVerify` established the exact correction
binding at revisions `257` and `258`, state hash
`sha256:119972fa38c48137d9a8d353ccd7b901989408cc1ecb7fc0cc732f6e14feb6dc`.
Focused checkers pass, governance A-Q is `17/17`, and the full local suite is
`791` total, `790` pass, `0` fail, `1` expected skip, and `0` todo.

## Current D7-E4D authority and authoring state

Owner authorized the local-only D7-E4D bootstrap after the prior source
assembly assignment completed at revision `251` and released to `NONE` at
revision `252`. `ControllerAssign` and `ControllerVerify` established the exact
binding in the preamble as `ACTIVE` at revision `254`, state hash
`sha256:8d4ca68f84027c798f411e39aff5e5bbf4e53110daba162eee7238feccc72e8f`.
The Owner subsequently approved the exact two-path governance scope correction,
expanding this phase from 14 to 16 mutation paths without changing its
production boundary.

The Coder implements one pure deterministic eligibility evaluator. It contains
no Apps Script service call, public production entrypoint, marker operation,
lock, remote synchronization, or production mutation. The fresh D7-E3I result
is input evidence only: Gmail verified, exact Drive artifacts absent, canonical
Sheet row absent, the exact Firestore job still `VALIDATED` version `4` with
reconciliation-required evidence, and zero mutation during the read.

The current evidence passes all 27 recovery-scope predicates and selects
`PRESERVE_EXISTING_JOB_ID`. Runtime readiness remains blocked on seven explicit
capabilities: same-job validated resume, current identity, Hoa-Don, inventory,
Gmail projection, an exact write budget, and one-shot marker lifecycle. The
required future state path includes `INVENTORY_PENDING`; the historical D7-E
pilot and consumed D7-E4B operation are not reusable.

## Historical predecessor source assembly state

Fresh `InspectWriter`, `ControllerAssign`, and `ControllerVerify` established
the exact local source-assembly binding
`authority_id=OWNER_GO_LOCAL_SOURCE_ASSEMBLY_RECONCILIATION_INVOICECANONICAL_SKUENGINE_SHEETMENU_V1_20260920`,
`assignment_id=SGDS_LOCAL_SOURCE_ASSEMBLY_RECONCILIATION_V1_01a0508a`, and
`writer_id=01a0508a-ca2d-72b0-8138-e60315864d31` as `ACTIVE`, revision `250`,
state hash
`sha256:e1246419b31d9aed8cc371f729dfe086cd9f79e2f436105a93e6e5775296ecae`.
The Exact17 checkpoint was committed and pushed as `241e3b31...`, with the
writer slot released to `NONE`, revision `248`, before this assignment.

The sole Coder may change only the 17 source-assembly paths authorized here.
The candidate allowlist expands from 71 to 76 paths solely for the two missing
modules, their menu call site, and their test/checker. The imported module bytes
must retain the hashes proven by the fresh temporary parity snapshot. This phase
does not authorize source synchronization, GAS execution, production access or
mutation, staging, commit, Git push, deployment, manual lifecycle state edits,
or protected `w`/`w1` changes.

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

## Source assembly mutation scope

The current authority permits changes to exactly these 17 paths:

- `invoiceCanonical.js`
- `SKU_ENGINE.js`
- `sheetMenu.js`
- `tests/unit/source-assembly-reconciliation.test.mjs`
- `scripts/checkers/check-source-assembly-reconciliation.mjs`
- `scripts/checkers/check-ai-governance-bootstrap.mjs`
- `tests/unit/ai-governance-bootstrap.test.mjs`
- `scripts/checkers/check-exact17-local-candidate-implementation.mjs`
- `scripts/test/run-all-checks.mjs`
- `docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md`
- `docs/02_TARGET_ARCHITECTURE.md`
- `docs/03_DATA_CONTRACT.md`
- `docs/04_MASTER_PLAN.md`
- `docs/12_AI_WORK_LOG.md`
- `docs/13_DECISION_LOG.md`
- `docs/99_NEXT_AI_HANDOFF.md`
- `docs/FILE_MANIFEST.md`

## Correction mutation scope

Only these 11 paths may be edited by the current correction writer:

- `scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs`
- `tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs`
- `scripts/checkers/check-ai-governance-bootstrap.mjs`
- `tests/unit/ai-governance-bootstrap.test.mjs`
- `scripts/checkers/check-exact17-local-candidate-implementation.mjs`
- `docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md`
- `docs/04_MASTER_PLAN.md`
- `docs/12_AI_WORK_LOG.md`
- `docs/13_DECISION_LOG.md`
- `docs/99_NEXT_AI_HANDOFF.md`
- `docs/FILE_MANIFEST.md`

## Allowed mutation scope

This exact 80-path list is the complete local candidate allowlist. No path
outside this section may be mutated by the current authority.

- `config.js`
- `Shared_Normalization.js`
- `Shared_Hashing.js`
- `Invoice_AttachmentParser.js`
- `gmailProcessInvoiceXML.js`
- `sheetHoaDon.js`
- `hashUtils.js`
- `sheetWriter.js`
- `invoiceCanonical.js`
- `SKU_ENGINE.js`
- `sheetMenu.js`
- `main.js`
- `_triggerDriveScanner.js`
- `driveUtils.js`
- `gasSheetsReadOnlyReader.js`
- `sgdsSheetsLedgerAdapter.js`
- `gmailCollection.js`
- `gmailSearch.js`
- `gmailLabels.js`
- `gmailScanner.js`
- `durableScannerShadowBridge.js`
- `durableJobState.js`
- `durableInvoiceOrchestrator.js`
- `durableReconciliation.js`
- `durableShadowStateIntegration.js`
- `firestoreShadowStateValidator.js`
- `sheetNhapXuat.js`
- `sheetTonKho.js`
- `sheetUtils.js`
- `sheetSidebar.html`
- `sheetFileLog.js`
- `triggers.js`
- `tests/unit/xml-parser.test.mjs`
- `tests/unit/invoice-key.test.mjs`
- `tests/unit/hash.test.mjs`
- `tests/unit/d6k-shared-foundation-consolidation.test.mjs`
- `tests/bugs/hash-identity.test.mjs`
- `tests/bugs/body-dedup-attachment.test.mjs`
- `tests/bugs/xml-first-only.test.mjs`
- `tests/bugs/batch-state.test.mjs`
- `tests/bugs/drive-dedup-bypass.test.mjs`
- `tests/bugs/bqgq-ordering.test.mjs`
- `tests/bugs/oversell-display.test.mjs`
- `tests/bugs/progress-state.test.mjs`
- `tests/bugs/filelog-competition.test.mjs`
- `tests/unit/durable-job-state.test.mjs`
- `tests/unit/durable-invoice-orchestrator.test.mjs`
- `tests/unit/durable-reconciliation.test.mjs`
- `tests/unit/apps-script-adapters.test.mjs`
- `tests/unit/durable-scanner-shadow-bridge.test.mjs`
- `tests/unit/durable-shadow-state-integration.test.mjs`
- `tests/emulator/firestore-shadow-emulator.test.mjs`
- `tests/schema/sheet-contract.test.mjs`
- `tests/static/static-source-safety.test.mjs`
- `tests/unit/ai-governance-bootstrap.test.mjs`
- `tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs`
- `tests/unit/exact17-local-candidate-integration.test.mjs`
- `tests/unit/source-assembly-reconciliation.test.mjs`
- `tests/unit/d7-e4d-validated-job-recovery-eligibility.test.mjs`
- `fixtures/durable-orchestration/fake-durable-orchestration.mjs`
- `fixtures/xml/valid-invoice-v2-multiline.xml`
- `package.json`
- `scripts/test/run-all-checks.mjs`
- `scripts/checkers/check-ai-governance-bootstrap.mjs`
- `scripts/checkers/check-bundle-c-critical-runtime-fixes.mjs`
- `scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs`
- `scripts/checkers/check-sgds-crit-003-d5a-local-orchestration.mjs`
- `scripts/checkers/check-exact17-local-candidate-implementation.mjs`
- `scripts/checkers/check-source-assembly-reconciliation.mjs`
- `scripts/checkers/check-d7-e4d-validated-job-recovery-eligibility.mjs`
- `D7_E4D_ValidatedJobRecoveryEligibility.js`
- `docs/phases/D7_E4D_VALIDATED_JOB_RECOVERY_ELIGIBILITY.md`
- `docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md`
- `docs/02_TARGET_ARCHITECTURE.md`
- `docs/03_DATA_CONTRACT.md`
- `docs/04_MASTER_PLAN.md`
- `docs/12_AI_WORK_LOG.md`
- `docs/13_DECISION_LOG.md`
- `docs/99_NEXT_AI_HANDOFF.md`
- `docs/FILE_MANIFEST.md`

## Production boundary and disposition

No source synchronization, production data access, or production mutation is
authorized or performed. Fresh-phase counters are Gmail/Drive/Sheets/Firestore
reads `0/0/0/0`, source sync `0`, clasp push `0`, and production reconciliation
or repair `0`. The prior exact production-read invocation was consumed and is
not reusable. No stage, commit, push, deployment, or repository pull was
performed by this Coder; only the normal exact assign/verify lifecycle preceded
authoring.

## Next direction

CURRENT_PHASE=SGDS_D7_E4D_AGGREGATE_COMPATIBILITY_CORRECTION_V1
CURRENT_PHASE_STATUS=CODER_CORRECTION_FROZEN_ACTIVE_REVISION_258
PREDECESSOR_TERMINAL=D7_E4D_ELIGIBILITY_WRITERCOMPLETE_REVISION_255_CONTROLLERRELEASE_SLOT_NONE_REVISION_256_UNCOMMITTED_CANDIDATE
CURRENT_WRITER_SNAPSHOT=ACTIVE_REVISION_258_STATE_HASH_sha256_119972fa38c48137d9a8d353ccd7b901989408cc1ecb7fc0cc732f6e14feb6dc
IMPLEMENTATION_RESULT=TWO_INHERITED_CHECKERS_BOUND_TO_CANONICAL_80_PATH_SCOPE_NO_APPLICATION_LOGIC_CHANGE
CURRENT_DECISION=PRESERVE_D7_E4D_ELIGIBILITY_RESULT_AND_REMOVE_STALE_AGGREGATE_ASSUMPTIONS
ACCEPTANCE_STATUS=FOCUSED_CHECKERS_PASS;GOVERNANCE_A_Q_17_PASS_0_FAIL_0_SKIP_0_TODO;FULL_LOCAL_791_TOTAL_790_PASS_0_FAIL_1_EXPECTED_SKIP_0_TODO
CODER_CLOSEOUT=FROZEN_PENDING_WRITERCOMPLETE_REVISION_259_AND_CONTROLLERRELEASE_NONE_REVISION_260
IMMEDIATE_NEXT_SEQUENCE=GIT_DIFF_CHECK;MANIFEST_HASH;WRITERCOMPLETE;CONTROLLERRELEASE_NONE;SOL_REVIEWER_ISOLATION;LUNA_TESTER_ISOLATION;OWNER_CHECKPOINT_GATE
NEXT_DIRECTION=AFTER_VERIFIED_CHECKPOINT_PREPARE_A_SEPARATE_LOCAL_RUNTIME_PHASE_FOR_THE_SEVEN_MISSING_CAPABILITIES
NEXT_FORBIDDEN=NO_STAGE_COMMIT_GIT_PUSH_CLASP_PUSH_GAS_EXECUTION_PRODUCTION_ACCESS_MUTATION_MARKER_OR_DEPLOY
