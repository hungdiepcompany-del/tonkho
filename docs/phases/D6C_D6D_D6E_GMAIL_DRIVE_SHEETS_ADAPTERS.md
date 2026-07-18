# D6C-D6D-D6E Gmail Drive Sheets Adapters

PHASE=D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS
STATUS=PASS_LOCAL_APPS_SCRIPT_ADAPTERS_IMPLEMENTED

## Runtime Boundary

PRIMARY_RUNTIME=apps_script
SGDS_RUNTIME_STRATEGY=APPS_SCRIPT_FIRST_NO_BILLING
CONTROL_PLANE=FIRESTORE
FILE_STORE=GOOGLE_DRIVE
BUSINESS_LEDGER=GOOGLE_SHEETS
CLOUD_RUN_PRIMARY_PATH=false
CLOUD_RUN_OPTIONAL_ADAPTER_RETAINED=true
CLOUD_RUN_FALLBACK_AUTOMATIC=false

This phase is local-only. It defines Apps Script-first adapter contracts, fakes, deterministic DTOs, retry/error taxonomy, and local tests. It does not wire production scanners, deploy Apps Script, deploy Firebase, deploy Cloud Run, mutate triggers, call live Gmail, call live Drive, call live Sheets, or write production Firestore.

## D6C Gmail Adapter

GMAIL_EXISTING_CONTRACTS=invoice labels;bounded thread search;thread metadata;message attachment collection;XML/PDF/link classification;saved-label projection after verified ledger commit
GMAIL_REQUIRED_READ_OPERATIONS=searchCandidateThreads;readThreadMetadata;readMessage;listAttachments;readAttachmentContent;readLabels
GMAIL_REQUIRED_WRITE_OPERATIONS=applyProcessingLabel;removeTemporaryLabel
GMAIL_IDEMPOTENCY_REQUIREMENTS=threadId+messageId+attachmentId+contentHash+invoiceKeyV2
GMAIL_CURSOR_OR_CHECKPOINT_MODEL=bounded_query_plus_thread_message_checkpoint

GMAIL_ADAPTER_FILES=sgdsGmailAdapter.js
GMAIL_READ_OPERATIONS=searchCandidateThreads;readThreadMetadata;readMessage;listAttachments;readAttachmentContent;readLabels
GMAIL_MUTATION_OPERATIONS=applyProcessingLabel;removeTemporaryLabel
GMAIL_NORMALIZED_DTO=threadId;messageId;historyId;order;internalDate;sender;recipients;subject;boundedBodyPreview;attachmentMetadata;labelNames
GMAIL_FAKE_ADAPTER=createFakeSgdsGmailAdapter_
GMAIL_ADAPTER_TESTS_PASS=PASS

Read operations return JSON-safe DTOs and do not mutate mailbox state. Mutation operations require explicit idempotency keys. One thread can produce multiple logical invoice candidates. XML candidates remain processable, while PDF-only and link-only candidates are marked review-required.

## D6D Drive Adapter

DRIVE_EXISTING_CONTRACTS=source attachment archive;XML/PDF evidence;Hoa-Don registry references;processing evidence;review artifacts
DRIVE_FOLDER_MODEL=direction/year/artifact-type
DRIVE_FILE_IDENTITY_MODEL=invoiceKeyV2+messageId+attachmentId+contentHash+artifactType
DRIVE_DEDUPLICATION_MODEL=deterministic logical artifact identity, not filename-only
DRIVE_METADATA_MODEL=fileReference;folderReference;logicalFileIdentityHashPrefix;artifactType;mimeType;contentHash;byteSize;boundedMetadata

DRIVE_ADAPTER_FILES=sgdsDriveAdapter.js
DRIVE_READ_OPERATIONS=findFolder;findFileByIdentity;readFileMetadata;readFileBytes;generateDriveReference
DRIVE_MUTATION_OPERATIONS=ensureFolder;createFileIfAbsent;updateBoundedMetadata
DRIVE_FAKE_ADAPTER=createFakeSgdsDriveAdapter_
DRIVE_ADAPTER_TESTS_PASS=PASS

Same artifact replay resolves to the same logical Drive object. Same filename with different content does not merge incorrectly. Replacement, adjustment, and cancellation artifacts remain independently auditable through the logical identity inputs.

## D6E Sheets Ledger Adapter

SHEETS_LEDGER_EXISTING_CONTRACTS=Nhap-Xuat canonical ledger;Hoa-Don file registry;immutable transaction sequence;invoiceKey V2;lineIdentity V2;sourceLineNo;oversell blocking;append-only corrections;rebuild from canonical ledger
SHEETS_REQUIRED_READ_OPERATIONS=readLedgerRows;readConfigurationRows;findTransactionByIdentity;readRowsForRebuild;planRebuildFromEarliestAffected
SHEETS_REQUIRED_MUTATION_OPERATIONS=appendImmutableTransactionsIfAbsent;appendAdjustment;appendReplacement;appendCancellation;replaceDerivedRangeForRebuild
SHEETS_APPEND_MODEL=append_only_transaction_sequence
SHEETS_REBUILD_MODEL=earliest_affected_transaction_or_full_rebuild
SHEETS_IMMUTABILITY_RULES=direct history edit blocked;direct history delete blocked;adjustment/replacement/cancellation append-only

SHEETS_ADAPTER_FILES=sgdsSheetsLedgerAdapter.js
SHEETS_READ_OPERATIONS=readLedgerRows;readConfigurationRows;findTransactionByIdentity;readRowsForRebuild;planRebuildFromEarliestAffected
SHEETS_MUTATION_OPERATIONS=appendImmutableTransactionsIfAbsent;appendAdjustment;appendReplacement;appendCancellation;replaceDerivedRangeForRebuild
SHEETS_FAKE_ADAPTER=createFakeSgdsSheetsLedgerAdapter_
SHEETS_ADAPTER_TESTS_PASS=PASS

DIRECT_HISTORY_EDIT_BLOCKED=true
DIRECT_HISTORY_DELETE_BLOCKED=true
ADJUSTMENT_IS_APPEND_ONLY=true

The adapter exposes no generic unrestricted `updateAnyCell`, `deleteAnyRow`, or `clearSheet` capability. Correction workflows are append-only. Derived range replacement is only available through an explicit rebuild operation.

## Adapter Composition

RUNTIME_ADAPTER_FACTORY=sgdsRuntimeAdapterFactory.js
DEFAULT_PRODUCTION_RUNTIME=apps_script
CLOUD_RUN_FALLBACK_AUTOMATIC=false
ADAPTER_FACTORY_TESTS_PASS=PASS

Apps Script is the production default. Local fake and test modes are explicit. The retained Cloud Run adapter path is optional only and cannot be selected as an automatic fallback.

## Error And Retry Contract

ERROR_TAXONOMY=adapter_auth_error;adapter_permission_error;adapter_not_found;adapter_rate_limited;adapter_transient_error;adapter_contract_error;adapter_conflict;adapter_idempotent_replay
RETRY_CLASSES=retryable;non-retryable;review-required;idempotent-success
GMAIL_MUTATION_IDEMPOTENT=requires_explicit_idempotency_key
DRIVE_MUTATION_IDEMPOTENT=deterministic_identity_plus_idempotency_key
SHEETS_APPEND_IDEMPOTENT=transactionIdentity_plus_idempotency_key
ERROR_CLASSIFICATION_TESTS_PASS=PASS
IDEMPOTENCY_TESTS_PASS=PASS

Business logic should depend on adapter error codes and retry classes, not raw platform-specific exception text.

## Security And Logging

SECRET_AND_PII_BOUNDARY=bounded_identifiers_hash_prefixes_only
RAW_EMAIL_BODY_LOGGED=NO
RAW_ATTACHMENT_CONTENT_LOGGED=NO
RAW_XML_LOGGED=NO
OAUTH_TOKEN_LOGGED=NO
AUTHORIZATION_HEADER_LOGGED=NO

EXPECTED_GMAIL_SCOPES=https://mail.google.com/
EXPECTED_DRIVE_SCOPES=https://www.googleapis.com/auth/drive
EXPECTED_SHEETS_SCOPES=https://www.googleapis.com/auth/spreadsheets
CURRENT_MANIFEST_SCOPE_CHANGE_REQUIRED=NO

The current local `appsscript.json` already contains the broad legacy Gmail, Drive, Sheets, UI, external request, and userinfo scopes. This phase does not change the manifest and does not push Apps Script source.

## Direct Platform Calls

BUSINESS_LOGIC_DIRECT_GMAILAPP_CALLS=9_LEGACY_RUNTIME_OCCURRENCES
BUSINESS_LOGIC_DIRECT_DRIVEAPP_CALLS=5_LEGACY_RUNTIME_OCCURRENCES
BUSINESS_LOGIC_DIRECT_SPREADSHEETAPP_CALLS=30_LEGACY_RUNTIME_OCCURRENCES
REMAINING_DIRECT_PLATFORM_CALLS=LEGACY_RUNTIME_NOT_REFACTORED_IN_D6C_D6E

New D6C-D6E adapter tests do not call or name production Google service globals. Existing legacy scanner, label, Drive, sheet, menu, and rebuild modules still contain direct platform calls and remain out of scope for this local adapter contract phase.

## Local Integration

LOCAL_END_TO_END_ADAPTER_FLOW_PASS=true
PRODUCTION_HTTP_CALL_COUNT=0
PRODUCTION_GOOGLE_API_CALL_COUNT=0

The local end-to-end fixture uses a fake Gmail thread, fake Drive storage, a Firestore gateway with injected local transport, and fake Sheets ledger append. It covers valid XML invoice, PDF-only review, link-only review, duplicate replay, multiple invoices in one thread, oversell block, adjustment, replacement, cancellation, and rebuild planning.

## Validation

D6C_D6E_CHECK=PASS
FIRESTORE_EMULATOR_TESTS=PASS
LOCAL_SERVICE_TESTS=PASS
BUNDLE_C_CHECK=PASS
D5N_CHECK=PASS
D5M_D5R_CHECK=PASS
D5S_D5X_CHECK=PASS
D5Y_D6B_CHECK=PASS
GIT_DIFF_CHECK=PASS

## Prohibited Actions

CLASP_PUSH=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
CLOUD_RUN_DEPLOY=NOT_RUN
TRIGGER_MUTATION=NONE
GMAIL_MUTATION=NONE
DRIVE_MUTATION=NONE
GOOGLE_SHEETS_MUTATION=NONE
PRODUCTION_FIRESTORE_MUTATION=NONE
PRODUCTION_HTTP_CALL_COUNT=0
PRODUCTION_GOOGLE_API_CALL_COUNT=0

## Next

LIVE_VERIFICATION=NOT_RUN
PRODUCTION_SCANNER_WIRING=NOT_STARTED
NEXT_ALLOWED_PHASE=D6F_D6G_LOCAL_SCANNER_COMPOSITION_WITH_ADAPTERS
