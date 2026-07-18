# 08 Decision Log

## A00-DEC-001

DECISION=Initialize Git in the target project path because no repository existed.
REASON=Bundle A requires baseline lock and commit history.

## A00-DEC-002

DECISION=Treat Google resource IDs as identifiers, not secrets.
REASON=Bundle prompt explicitly says Drive/Script/Sheet IDs are not automatically secrets, but must be recorded as resource identifiers.

## A00-DEC-003

DECISION=Do not run any clasp, Firebase, GAS, Gmail, Drive, Sheets, or web app mutation command.
REASON=Bundle A is local read-only evidence and documentation only.

## A01-DEC-001

DECISION=Block A01 instead of proceeding to A02/A03 because the workbook snapshot is missing.
REASON=The requested gate requires workbook schema and data integrity evidence. Proceeding would skip a mandatory subphase.

## Architecture Decisions Recorded

- Gmail label is projection only, not source of truth.
- Firestore is not the main ledger in this phase.
- Firebase Storage is not used.
- Remote GAS is not run in Bundle A.


## BUNDLE-B-DEC-001

DECISION=Use Node built-in test runner and standard library only.
REASON=Bundle B can be completed without npm dependencies or network access.

## BUNDLE-B-DEC-002

DECISION=Load GAS source in Node VM rather than modifying runtime files.
REASON=Runtime source is immutable in Bundle B.

## BUNDLE-B-DEC-003

DECISION=Bug reproduction tests pass when they prove the current bug exists.
REASON=Bundle B is a baseline before Bundle C fixes.


## BUNDLE-B-DEC-001

DECISION=Use Node built-in test runner and standard library only.
REASON=Bundle B can be completed without npm dependencies or network access.

## BUNDLE-B-DEC-002

DECISION=Load GAS source in Node VM rather than modifying runtime files.
REASON=Runtime source is immutable in Bundle B.

## BUNDLE-B-DEC-003

DECISION=Bug reproduction tests pass when they prove the current bug exists.
REASON=Bundle B is a baseline before Bundle C fixes.


## BUNDLE-B-DEC-001

DECISION=Use Node built-in test runner and standard library only.
REASON=Bundle B can be completed without npm dependencies or network access.

## BUNDLE-B-DEC-002

DECISION=Load GAS source in Node VM rather than modifying runtime files.
REASON=Runtime source is immutable in Bundle B.

## BUNDLE-B-DEC-003

DECISION=Bug reproduction tests pass when they prove the current bug exists.
REASON=Bundle B is a baseline before Bundle C fixes.


## OWNER-APPROVAL-DEC-001

DECISION=Approve the recommended set of 20 business decisions with owner marker `APPROVE_RECOMMENDED_20`.
REASON=Owner supplied the approval marker and requested data contract/invariant status transition to owner-approved v1.

## OWNER-APPROVAL-DEC-002

DECISION=Use `invoiceKeyV2 = sellerTaxCode + "_" + invoiceSymbol + "_" + normalizedInvoiceNo + "_" + issueDate(yyyyMMdd)`.
REASON=Owner approved invoice symbol as required identity input and excluded buyer/counterparty/type from primary invoice identity.

## OWNER-APPROVAL-DEC-003

DECISION=Block over-sell and route to review; BQGQ ordering is `issueDate`, immutable `transactionSequence`, then `sourceLineNo`.
REASON=Owner approved the recommended inventory policy and removed the policy blocker for Bundle C local fixes.

## OWNER-APPROVAL-DEC-004

DECISION=Correct Bundle B coverage mapping by keeping `SGDS-HIGH-005` as item-code substring mapping and adding `SGDS-HIGH-011` for BQGQ row-order sensitivity.
REASON=The owner approval prompt explicitly identified the previous coverage row as a bad link.


## BUNDLE-C-DEC-001

DECISION=Keep Hash V1 and persisted invoiceKey format unchanged while adding shared local commit preparation.
REASON=Current production data already stores HashIndex and invoiceKey in the existing format; identity migration requires a separate reconciliation phase.

## BUNDLE-C-DEC-002

DECISION=Treat Gmail labels as projections after per-source commit results.
REASON=The owner-approved invariant says saved-sheet labels must only follow verified row commit or idempotent already-committed status.

## BUNDLE-C-DEC-003

DECISION=Remove Bundle B runtime-immutability checks from the aggregate local check and replace them with the Bundle C runtime-fix checker.
REASON=Bundle C explicitly permits local runtime edits while still requiring no production mutation, no workbook mutation, and compatibility with existing identity formats.

## Bundle C-S1 Single-Thread Smoke Executor Local Patch

OWNER_MARKER=OWNER_APPROVE_BUNDLE_C_SINGLE_THREAD_EXECUTOR_LOCAL_PATCH
PREVIOUS_BLOCKER=SCANNER_CANDIDATE_COUNT_NOT_SINGLE
PREVIOUS_GLOBAL_CANDIDATE_COUNT=10
SINGLE_THREAD_EXECUTOR_STATUS=PASS_SINGLE_THREAD_EXECUTOR_LOCAL
SINGLE_THREAD_EXECUTOR_GAS_PUSH_STATUS=BLOCKED_CLASP_REAUTH_REQUIRED
EXACT_THREAD_SCOPE=1
PRODUCTION_MUTATION=NONE
SCRIPT_PROPERTIES_MUTATION=NONE
GAS_PUSH=BLOCKED_BEFORE_UPLOAD
SGDS_CRIT_003_STATUS=NOT_FIXED

## 2026-07-16 - SGDS-CRIT-003 D5M-D5R Split Principal And Scanner Shadow Boundary

DECISION=Add an explicit Firestore runtime identity contract and default-disabled scanner shadow bridge, but do not create service accounts, mutate IAM, deploy infrastructure, or run production scanner shadow without new owner markers.
RATIONALE=The Apps Script scanner owns Workspace access today, while durable Firestore automation needs a separate keyless service-account principal. Local scanner hooks can be prepared safely only when default-disabled and bounded before canonical Gmail, Drive, and Sheets side effects.
SGDS_D5M_D5R_STATUS=PARTIAL_PASS_DESIGN_AND_LOCAL_WIRING_COMPLETE
SELECTED_PRODUCTION_PATTERN=PATTERN_C_HOSTED_DURABLE_ORCHESTRATOR_WITH_ATTACHED_SA_PENDING_INFRASTRUCTURE_APPROVAL
SELECTED_LOCAL_VALIDATION_PATTERN=PATTERN_D_GCLOUD_SA_IMPERSONATION_KEYLESS_PENDING_APPROVAL
SA_ID=sgds-firestore-runtime
SA_CREATED=NO_APPROVAL_MISSING
IAM_BINDINGS_CHANGED=NO_APPROVAL_MISSING
SA_KEY_CREATION=FORBIDDEN
OWNER_PRINCIPAL_IN_PRODUCTION_AUTOMATION=REJECTED
SCANNER_SHADOW_FEATURE_DEFAULT=false
SCANNER_SHADOW_WIRING=PASS_LOCAL_DEFAULT_DISABLED
PRODUCTION_SCANNER_SHADOW_RUN=NOT_RUN_APPROVAL_MISSING
PRODUCTION_MUTATION=NONE
SGDS_CRIT_003_STATUS=BLOCKED_IDENTITY_OR_IAM
NEXT_ALLOWED_PHASE=OWNER_APPROVE_D5N_CREATE_SA_sgds-firestore-runtime_PROJECT_tonkhohd_OR_KEEP_LOCAL_ONLY

## 2026-07-16 - SGDS-CRIT-003 D5N Dedicated Runtime Identity Decision

DECISION=Create a dedicated keyless Firestore runtime identity, grant a project custom role with only reviewed Firestore data-plane permissions, and grant owner impersonation only on the service-account resource.
RATIONALE=D5N removes the owner user account from Firestore data-plane automation while preserving the split between Workspace access and durable Firestore state. The proof is limited to one synthetic identity-smoke job and idempotent replay.
SGDS_D5N_IDENTITY_STATUS=PASS_DEDICATED_KEYLESS_LEAST_PRIVILEGE_IDENTITY
SA_ID=sgds-firestore-runtime
CUSTOM_ROLE_NAME=projects/tonkhohd/roles/sgdsFirestoreRuntime
CUSTOM_ROLE_PERMISSIONS=datastore.databases.get;datastore.databases.getMetadata;datastore.entities.create;datastore.entities.get;datastore.entities.list;datastore.entities.update;resourcemanager.projects.get
DELETE_PERMISSION_INCLUDED=NO
ADMIN_PERMISSION_COUNT=0
TOKEN_CREATOR_SCOPE=SA_RESOURCE_ONLY
KEYLESS_AUTH=PASS
OWNER_USED_AS_DATA_PRINCIPAL=NO
SYNTHETIC_JOB_ID=sgds-d5n-runtime-identity-smoke-v1
IDEMPOTENCY=PASS
PRODUCTION_MUTATION=ONE_SYNTHETIC_FIRESTORE_IDENTITY_JOB_ONLY
GOOGLE_SHEETS_MUTATION=NONE
GMAIL_MESSAGE_MUTATION=NONE
GMAIL_LABEL_MUTATION=NONE
GOOGLE_DRIVE_MUTATION=NONE
HOSTED_RUNTIME_READY=NO_NOT_DEPLOYED
SGDS_CRIT_003_STATUS=PARTIALLY_CLOSED_RUNTIME_HOSTING_PENDING
NEXT_ALLOWED_PHASE=CLOUD_RUN_DURABLE_ORCHESTRATOR_BUILD_AND_DEPLOY_REVIEW

## 2026-07-16 - SGDS-CRIT-003 D5J-I to D5L Partial Close Decision

DECISION=Accept the one fixed production synthetic Firestore shadow job and same-case replay as manual-owner smoke evidence, but do not mark SGDS-CRIT-003 fully closed until a dedicated least-privilege automation principal exists.
RATIONALE=The smoke proved deterministic identity, bounded synthetic Firestore persistence, idempotency, report-only reconciliation, audit markers, and no Gmail, Drive, Sheets, GAS, Hosting, or rules deployment side effects. The write principal is still a user account with roles/owner, so production automation identity remains open.
MANUAL_OWNER_SMOKE=PASS
PRODUCTION_AUTOMATION_PRINCIPAL_READY=NO
LEAST_PRIVILEGE_AUTOMATION=NOT_READY
SGDS_CRIT_003_STATUS=PARTIALLY_CLOSED_PRODUCTION_AUTOMATION_PRINCIPAL_PENDING
NEXT_ALLOWED_PHASE=DEDICATED_FIRESTORE_RUNTIME_IDENTITY_AND_LEAST_PRIVILEGE_IAM

## 2026-07-16 - SGDS-CRIT-003 D5J-P Project Selection Boundary

DECISION=Do not select or configure a Firebase production project for SyncGmailDriveSheet in this phase.
RATIONALE=The review found expected account context and read-only inventories, but no candidate has two independent positive evidence sources tying it to SyncGmailDriveSheet. The repository has no Firebase alias, Web App config, Hosting URL, or production project number.
SGDS_CRIT_003_D5J_PROJECT_CONFIRMATION_STATUS=BLOCKED_NO_UNIQUE_PRODUCTION_PROJECT
D5J_PRODUCTION_EXECUTION=NOT_RUN_BY_SCOPE
PRODUCTION_WRITE_EXECUTED=NO
FIREBASE_ALIAS_ADDED=NO
GCLOUD_CONFIGURATION_PROJECT_SET=NO
DEFAULT_LONGTHAI_CONFIGURATION_MODIFIED=NO
NEXT_ALLOWED_PHASE=OWNER_FIREBASE_PROJECT_SELECTION_OR_PROVISIONING_REVIEW

## 2026-07-16 - SGDS-CRIT-003 D5J Production Gate Boundary

DECISION=Do not execute the D5J production Firestore shadow write until the project, database, and deployed rules are confirmed.
RATIONALE=Firebase CLI is authenticated as the expected account, and gcloud sgds-hungdiep is authenticated as the expected account, but gcloud project is unset and the repository has no Firebase alias. The approved one-job production write requires a uniquely confirmed Firestore target.
D5J_PRODUCTION_GATE=BLOCKED_PRODUCTION_FIRESTORE_PROJECT_UNCONFIRMED
PRODUCTION_WRITE_EXECUTED=NO
DEFAULT_GCLOUD_CONTEXT_TRUSTED=NO
GCLOUD_CONFIGURATION_REQUIRED=sgds-hungdiep
D5K_AND_D5L_CONTINUED_LOCAL=YES
FIREBASE_DEPLOY=NOT_RUN
FIRESTORE_RULES_DEPLOY=NOT_RUN
FIRESTORE_INDEX_DEPLOY=NOT_RUN
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ALLOWED_PHASE=RESUME_SINGLE_THREAD_EXECUTOR_GAS_PUSH_AFTER_CLASP_REAUTH

## BUNDLE-C-S4-DEC-001

DECISION=Remove the temporary single-thread smoke executor after the exact-thread production smoke passed.
REASON=The executor was approved only as a bounded one-thread smoke tool. Keeping it after PASS would preserve an unnecessary production execution surface.

## BUNDLE-C-S4-DEC-002

DECISION=Preserve Bundle C production smoke evidence while removing local executor code, executor-specific tests, executor-specific checker, and package command.
REASON=The evidence remains part of the production verification record, while the temporary tool itself is no longer required.

## BUNDLE-C-S4R-DEC-001

DECISION=Use owner-approved Apps Script editor exact-file deletion to remove the remote temporary executor after normal clasp push left it present.
REASON=The previous phase allowed exactly one normal clasp push attempt and forbade retry or force push. Owner approved manual exact-file deletion for `bundleCSingleThreadSmoke.gs` only.

## BUNDLE-C-S4R-DEC-002

DECISION=Clean only Bundle C smoke result Script Properties after remote executor removal was independently verified by a second read-only clone.
REASON=Result keys were safe cleanup residue from the completed one-thread smoke; input keys remained absent, and unrelated Script Properties were out of scope.

## SGDS-CRIT-003-DEC-001

DECISION=Use durable per-invoice job state and append-only audit as the workflow source of truth, while keeping Google Sheets as the current business ledger.
REASON=SGDS-CRIT-003 is caused by cross-service partial failure. Durable workflow state is needed to resume safely without replacing the Sheet ledger in this phase.

## SGDS-CRIT-003-DEC-002

DECISION=Make reconciliation report-only before any repair write is implemented.
REASON=The system must first prove divergence safely and sanitize evidence. Deleting, overwriting, or repairing production ledger data requires separate owner approval.

## SGDS-CRIT-003-DEC-003

DECISION=Keep legacy `HashIndex` and persisted `InvoiceKey` compatibility during the durable-state implementation slices.
REASON=Bundle C explicitly avoided identity migration. V2 identity can be stored in durable state, but Sheet dedup compatibility remains required until a separate migration plan is approved.

## SGDS-CRIT-003-D1-DEC-001

DECISION=Implement D1 as inert local GAS-compatible primitives plus VM-loaded unit tests before scanner integration.
REASON=The owner approved local implementation only. Keeping the primitives unwired avoids production behavior changes while proving the durable state machine and commit-plan contract locally.

## SGDS-CRIT-003-D1-DEC-002

DECISION=Reject changed commit plans once saved in the local durable store.
REASON=The design requires commit plans to be append-only after creation so retries cannot silently mutate the expected ledger write set.

## SGDS-CRIT-003-D3-DEC-001

DECISION=Implement D3 as a local-only report reconciler over supplied durable job, commit-plan, Drive, Hoa-Don, ledger, and Gmail-label snapshots.
REASON=The owner approved report-only reconciliation before any Firestore adapter, scanner wiring, production read, or repair action.

## SGDS-CRIT-003-D3-DEC-002

DECISION=Keep all D3 findings sanitized and owner-review/report-only, with no automatic repair functions or production entrypoint wiring.
REASON=SGDS-CRIT-003 remains open until durable persistence and approved production reconciliation/repair phases exist.

## SGDS-CRIT-003-D2-DEC-001

DECISION=Implement the Firestore durable job adapter as a local-only store over an injected transport and injected clock.
REASON=The owner approved adapter contract and fake/emulator-compatible boundary only; production Firestore access and scanner wiring remain separate phases.

## SGDS-CRIT-003-D2-DEC-002

DECISION=Use expected-version optimistic concurrency and idempotency keys instead of last-write-wins.
REASON=Durable invoice processing must distinguish confirmed not-written, confirmed written, and unknown write outcome without silently overwriting job state.

## SGDS-CRIT-003-D4-DEC-001

DECISION=Select Drive -> Hoa-Don -> Nhap-Xuat -> Gmail saved-label projection as the durable mutation order.
REASON=This order best matches current production behavior, preserves evidence before ledger mutation, and keeps Gmail saved label as the final projection after verified ledger commit.

## SGDS-CRIT-003-D4-DEC-002

DECISION=Treat unknown external write outcomes and partial multi-line ledger commits as reconciliation-required states, not automatic retry or repair.
REASON=The system must distinguish confirmed not-written from unknown or conflicting external state before any future scanner integration.
## 2026-07-15 - SGDS-CRIT-003 D5A Local Orchestration Boundary

DECISION=Implement local durable orchestration with injected fake adapters only.
RATIONALE=D5A proves stepwise idempotency, immutable commit-plan use, unknown-outcome handoff, and saved-label-last behavior without touching production scanners or production Firestore.
D4_GITHUB_PUSH=PASS
PRODUCTION_FIRESTORE_ACCESS=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
BATCH_SCANNER_ACTIVATION=NOT_APPROVED
HISTORICAL_BACKFILL=NOT_APPROVED
PRODUCTION_MUTATION=NONE
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5B_SHADOW_MODE_DESIGN_OR_LOCAL_ADAPTERS

## 2026-07-15 - SGDS-CRIT-003 D5B Local Shadow Runner Boundary

DECISION=Implement a local-only shadow runner with injected fake Gmail and Drive candidate adapters.
RATIONALE=D5B proves deterministic candidate ordering, Gmail/Drive source convergence, commit-plan preview, and report-only reconciliation preview without reading production systems or mutating production state.
D5A_GITHUB_PUSH=PASS
D5B_MODE=LOCAL_SHADOW_ONLY
EXECUTION_MODE=SHADOW
PRODUCTION_READ=NONE
PRODUCTION_WRITE=NONE
PRODUCTION_FIRESTORE_ACCESS=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
BATCH_SCANNER_ACTIVATION=NOT_APPROVED
HISTORICAL_BACKFILL=NOT_APPROVED
PRODUCTION_MUTATION=NONE
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5C_PRODUCTION_READ_ONLY_SNAPSHOT_ADAPTERS

## 2026-07-15 - SGDS-CRIT-003 D5C Production Read-Only Snapshot Boundary

DECISION=Implement production-compatible read-only snapshot adapters as local source with injected dependencies and no runtime wiring.
RATIONALE=D5C prepares exact-reference Gmail, Drive, Hoa-Don, and Nhap-Xuat read snapshots for future owner-approved read-only shadow smoke while proving locally that no write-shaped APIs are called.
D5B_GITHUB_PUSH=PASS
D5C_IMPLEMENTATION_STATUS=LOCAL_ONLY
PRODUCTION_COMPATIBLE_READERS=IMPLEMENTED_NOT_EXECUTED
DEPENDENCY_INJECTION=YES
EXACT_REFERENCE_POLICY=YES
READ_LIMIT_POLICY=YES
SANITIZATION_POLICY=YES
PRODUCTION_READ=NONE
PRODUCTION_WRITE=NONE
PRODUCTION_FIRESTORE_ACCESS=NONE
PUBLIC_GAS_ENTRYPOINT=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
GAS_PUSH=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
PRODUCTION_MUTATION=NONE
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5D_PRODUCTION_READ_ONLY_SHADOW_SMOKE

## 2026-07-15 - SGDS-CRIT-003 D5D Exact-Reference Read-Only Smoke Boundary

DECISION=Implement a temporary exact-reference Apps Script read-only smoke entrypoint that blocks before reads unless the owner-approved Script Properties are present.
RATIONALE=D5D must verify one known invoice through Gmail, Drive, Hoa-Don, and Nhap-Xuat snapshots without scanner wiring, production writes, Firestore access, triggers, menus, or automatic repair.
D5D_MODE=EXACT_REFERENCE_PRODUCTION_READ_ONLY
PRODUCTION_READ_SCOPE=ONE_KNOWN_INVOICE
EXACT_REFERENCE_CONFIG=SCRIPT_PROPERTIES_REQUIRED_AT_RUNTIME
SMOKE_FUNCTION=runSgdsCrit003D5dProductionReadOnlyShadowSmoke
PUBLIC_GAS_ENTRYPOINT=TEMPORARY_READ_ONLY_SMOKE_FUNCTION
PRODUCTION_WRITE=NONE
PRODUCTION_FIRESTORE_ACCESS=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
PRODUCTION_MUTATION=NONE
NEXT_ALLOWED_PHASE=GAS_SOURCE_PUSH_AND_OWNER_MANUAL_D5D_READ_ONLY_SMOKE

## 2026-07-15 - SGDS-CRIT-003 D5D-R Simplified Input Boundary

DECISION=Simplify the D5D read-only smoke to require only `SGDS_D5D_GMAIL_THREAD_ID` and derive XML/PDF file IDs, invoice identity hash, expected line count, line hashes, invoice key hash, and commit plan hash in memory.
RATIONALE=The owner should not supply derived hashes or Drive IDs. The smoke can derive them from the exact Gmail thread, parsed XML, Hoa-Don, Nhap-Xuat, and runtime helper contracts while preserving a read-only mutation boundary.
REQUIRED_PROPERTY_COUNT=1
DERIVED_PROPERTY_COUNT=7
OLD_DERIVED_PROPERTIES_REQUIRED=NO
FIRST_20_50_ROW_LIMIT_REMOVED=YES
PRODUCTION_WRITE=NONE
PRODUCTION_FIRESTORE_ACCESS=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
PRODUCTION_MUTATION=NONE
NEXT_ALLOWED_PHASE=GAS_SOURCE_PUSH_AND_D5D_R_EXACT_THREAD_READ_ONLY_SMOKE

## 2026-07-15 - SGDS-CRIT-003 D5E Local Shadow Durable State Boundary

DECISION=Integrate durable shadow state locally by composing the D2 job store, D3 report-only reconciler, and D5B shadow runner.
RATIONALE=D5E proves durable shadow job persistence, immutable commit-plan reuse, append-only audit, report-only reconciliation, source convergence, and idempotent rerun behavior without production Firestore, scanner wiring, production reads, or repair.
D5D_R_PRODUCTION_SMOKE=POSTPONED_BY_OWNER
D5E_DOES_NOT_DEPEND_ON_D5D_R_PRODUCTION_EXECUTION=YES
PRODUCTION_FIRESTORE_ACCESS=NONE
PRODUCTION_FIRESTORE_WRITE=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
PRODUCTION_MUTATION=NONE
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5F_PRODUCTION_FIRESTORE_SHADOW_WRITE_REVIEW

## SGDS-CRIT-003 D5F-D5I Decisions

SGDS_CRIT_003_D5F_D5I_BUNDLE_STATUS=PASS_LOCAL_FIRESTORE_SHADOW_READINESS
D5F_D5I_BUNDLE=LOCAL_AND_EMULATOR_ONLY
PRODUCTION_FIRESTORE_PROJECT_ID=UNCONFIRMED
FIRESTORE_EMULATOR_PROJECT_ID=demo-sgds-local
FIRESTORE_RULES_POLICY=DENY_ALL_CLIENT_READS_AND_WRITES_BY_DEFAULT
ADMIN_SDK_RULES_BYPASS_ACKNOWLEDGED=YES
BACKEND_ALLOWLIST_ENFORCEMENT_REQUIRED=YES
FUTURE_PRODUCTION_SMOKE_SCOPE=ONE_JOB_ONLY
ROLLBACK_POLICY_RECOMMENDATION=KEEP_AS_AUDIT_EVIDENCE
DELETE_EXACT_TEST_JOB_POLICY=OWNER_APPROVAL_REQUIRED
LONG_LIVED_CREDENTIAL_ARTIFACT_CREATION=NOT_APPROVED
PRODUCTION_WRITE_EXECUTED=NO
SGDS_CRIT_003_STATUS=NOT_FIXED
## 2026-07-17 - SGDS D5S-D5X Cloud Run Orchestrator Review Decision

DECISION=Build and validate the private Cloud Run durable orchestrator locally, but do not deploy in D5S-D5X.
SELECTED_BUILD_STRATEGY=EXPLICIT_CLOUD_BUILD_TO_ARTIFACT_REGISTRY_THEN_CLOUD_RUN_BY_DIGEST
AUTH_DECISION=Cloud Run IAM authentication plus application-level Google ID token validation.
RUNTIME_IDENTITY_DECISION=Use attached service identity sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com; no runtime gcloud impersonation and no key file mode.
APPS_SCRIPT_CALLER_DECISION=Feature-gated caller default false using ScriptApp.getIdentityToken and UrlFetchApp after future custom audience configuration.
DEPLOYMENT_DECISION=BLOCKED until billing and required APIs are enabled, Docker local validation or equivalent build validation is available, and owner provides exact deploy approval marker.

## 2026-07-18 - SGDS D5Y Apps Script First No-Billing Runtime Decision

DECISION=Lock the active product roadmap to Apps Script first with Firestore as the control plane and no Billing requirement.
RATIONALE=D5S-D5X kept Cloud Run viable as optional future infrastructure, but Billing/API/Docker blockers should not block the main Gmail, Drive, Sheets, Firestore, Firebase Hosting, and Firebase Authentication roadmap.
SGDS_RUNTIME_STRATEGY=APPS_SCRIPT_FIRST_NO_BILLING
PRIMARY_WORKER=GOOGLE_APPS_SCRIPT
BILLING_REQUIRED=NO
CLOUD_RUN_STATUS=DEFERRED_OPTIONAL
CLOUD_RUN_PRIMARY_PATH=NO
CLOUD_RUN_CODE_RETAINED=YES_OPTIONAL_ADAPTER
RESTORE_CLOUD_RUN_AS_PRIMARY_REQUIRES_OWNER_DECISION=YES
NEXT_ALLOWED_PHASE=D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS
