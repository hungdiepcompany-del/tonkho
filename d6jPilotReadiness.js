const D6J_A_OWNER_MARKERS_ = Object.freeze([
  'OWNER_APPROVED_D6J_REQUIRED_DEPLOYMENTS',
  'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN',
  'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION',
  'OWNER_APPROVED_D6J_PILOT_ROLLBACK'
]);

const D6J_A_LIMITS_ = Object.freeze({
  gmailMessagesRead: 1,
  attachmentsProcessed: 1,
  driveFilesCreatedMax: 1,
  driveFoldersCreatedPreferred: 0,
  driveFoldersCreatedMaxWithOwnerApproval: 1,
  sheetsRowsInsertedMax: 1,
  sheetsRowsUpdatedMaxDefault: 0,
  firestoreJobsCreatedMax: 1,
  firestoreGmailMessageRecordsCreatedMax: 1,
  firestoreAttachmentRecordsCreatedMax: 1,
  commandDocumentsCreated: 0,
  triggersCreated: 0,
  gmailMutations: 0,
  destructiveOperations: 0
});

const PRIVATE_IDENTIFIER_PATTERNS_ = Object.freeze([
  /\b[a-f0-9]{16,}\b/i,
  /\b1[A-Za-z0-9_-]{20,}\b/,
  /\b[A-Za-z0-9_-]{25,}\b/
]);

function assertD6jA_(condition, code) {
  if (!condition) throw new Error(code);
}

function isOwnerPlaceholderD6jA_(value) {
  return typeof value === 'string'
    && /^<OWNER_CONFIRMED_[A-Z0-9_]+>$/.test(value);
}

function hasPrivateIdentifierShapeD6jA_(value) {
  if (typeof value !== 'string') return false;
  if (isOwnerPlaceholderD6jA_(value)) return false;
  return PRIVATE_IDENTIFIER_PATTERNS_.some(pattern => pattern.test(value));
}

export function getD6jALimitedProductionPilotContract() {
  return {
    phase: 'D6J_A_LIMITED_PRODUCTION_PILOT_READINESS',
    status: 'PASS_READINESS_VALIDATED',
    runtimeStrategy: 'APPS_SCRIPT_FIRST_NO_BILLING',
    primaryWorker: 'GOOGLE_APPS_SCRIPT',
    controlPlane: 'FIRESTORE',
    cloudRunStatus: 'DEFERRED_OPTIONAL',
    ownerMarkers: [...D6J_A_OWNER_MARKERS_],
    limits: { ...D6J_A_LIMITS_ },
    productionMutationCounts: {
      gmail: 0,
      drive: 0,
      sheets: 0,
      firestore: 0,
      httpWrites: 0,
      googleApiWrites: 0
    }
  };
}

export function createD6jAPilotManifestTemplate() {
  return {
    schemaVersion: 'D6J_A_PILOT_MANIFEST_V1',
    pilotId: '<OWNER_CONFIRMED_PILOT_ID>',
    environment: 'production',
    approvedBy: '<OWNER_CONFIRMED_APPROVER>',
    approvalMarker: 'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN',
    gmail: {
      queryShape: {
        from: '<OWNER_CONFIRMED_EXACT_SENDER>',
        subjectPhrase: '<OWNER_CONFIRMED_UNIQUE_SUBJECT_PHRASE>',
        dateWindow: '<OWNER_CONFIRMED_BOUNDED_DATE_WINDOW>',
        hasAttachment: true,
        label: '<OWNER_CONFIRMED_OPTIONAL_LABEL>',
        maxResults: 1
      },
      expectedMessageId: '<OWNER_CONFIRMED_GMAIL_MESSAGE_ID>',
      expectedThreadId: '<OWNER_CONFIRMED_GMAIL_THREAD_ID>',
      expectedAttachmentId: '<OWNER_CONFIRMED_ATTACHMENT_ID>',
      expectedAttachmentMimeType: '<OWNER_CONFIRMED_ATTACHMENT_MIME_TYPE>',
      maximumAttachmentBytes: 5000000
    },
    drive: {
      rootFolderId: '<OWNER_CONFIRMED_DRIVE_ROOT_FOLDER_ID>',
      intendedPath: '<OWNER_CONFIRMED_DRIVE_PILOT_PATH>',
      createFolderAllowed: false,
      maximumFilesCreated: 1
    },
    sheets: {
      spreadsheetId: '<OWNER_CONFIRMED_SPREADSHEET_ID>',
      targetSheetName: '<OWNER_CONFIRMED_SHEET_NAME>',
      businessKeyStrategy: 'invoiceKeyV2',
      maximumInsertedRows: 1,
      maximumUpdatedRows: 0
    },
    firestore: {
      projectId: 'tonkhohd',
      databaseId: '(default)',
      maximumJobsCreated: 1,
      maximumGmailMessageRecordsCreated: 1,
      maximumAttachmentRecordsCreated: 1,
      commandDocumentsCreated: 0
    },
    dryRun: {
      required: true,
      approvalMarker: 'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN',
      mutationAfterDryRunAutomatic: false
    },
    mutationLimits: { ...D6J_A_LIMITS_ },
    rollbackPlan: {
      approvalMarker: 'OWNER_APPROVED_D6J_PILOT_ROLLBACK',
      preserveAuditEvidence: true,
      deletePreExistingData: false,
      requirePilotOwnershipProof: true
    },
    idempotencyVerificationPlan: {
      rerunSameMessageExpected: 'NO_OP_OR_ALREADY_COMMITTED',
      duplicateDriveFile: false,
      duplicateSheetRow: false,
      duplicateActiveJob: false,
      deterministicSourceIdentity: true
    },
    reconciliationRequirements: {
      requirePilotId: true,
      requireCorrelationId: true,
      traceGmailMessage: true,
      traceAttachment: true,
      traceDriveFile: true,
      traceSheetRow: true,
      traceAuditEvent: true
    }
  };
}

export function validateD6jAPilotManifest(manifest) {
  assertD6jA_(manifest && typeof manifest === 'object', 'D6J_A_MANIFEST_REQUIRED');
  assertD6jA_(manifest.schemaVersion === 'D6J_A_PILOT_MANIFEST_V1', 'D6J_A_SCHEMA_VERSION_INVALID');
  assertD6jA_(manifest.environment === 'production', 'D6J_A_ENVIRONMENT_INVALID');
  assertD6jA_(D6J_A_OWNER_MARKERS_.includes(manifest.approvalMarker), 'D6J_A_APPROVAL_MARKER_INVALID');
  assertD6jA_(manifest.gmail?.queryShape?.maxResults === 1, 'D6J_A_GMAIL_QUERY_LIMIT_INVALID');
  assertD6jA_(manifest.gmail?.queryShape?.hasAttachment === true, 'D6J_A_GMAIL_ATTACHMENT_QUERY_REQUIRED');
  assertD6jA_(manifest.drive?.maximumFilesCreated <= 1, 'D6J_A_DRIVE_FILE_LIMIT_INVALID');
  assertD6jA_(manifest.drive?.createFolderAllowed === false, 'D6J_A_DRIVE_FOLDER_CREATION_REQUIRES_OWNER');
  assertD6jA_(manifest.sheets?.maximumInsertedRows <= 1, 'D6J_A_SHEET_INSERT_LIMIT_INVALID');
  assertD6jA_(manifest.sheets?.maximumUpdatedRows === 0, 'D6J_A_SHEET_UPDATE_LIMIT_INVALID');
  assertD6jA_(manifest.firestore?.maximumJobsCreated <= 1, 'D6J_A_FIRESTORE_JOB_LIMIT_INVALID');
  assertD6jA_(manifest.firestore?.commandDocumentsCreated === 0, 'D6J_A_COMMAND_DOCUMENTS_FORBIDDEN');
  assertD6jA_(manifest.dryRun?.required === true, 'D6J_A_DRY_RUN_REQUIRED');
  assertD6jA_(manifest.dryRun?.mutationAfterDryRunAutomatic === false, 'D6J_A_DRY_RUN_MUST_NOT_AUTO_MUTATE');
  assertD6jA_(manifest.rollbackPlan?.deletePreExistingData === false, 'D6J_A_ROLLBACK_MUST_PRESERVE_PREEXISTING');
  assertD6jA_(manifest.rollbackPlan?.requirePilotOwnershipProof === true, 'D6J_A_ROLLBACK_OWNERSHIP_REQUIRED');
  assertD6jA_(manifest.idempotencyVerificationPlan?.duplicateDriveFile === false, 'D6J_A_IDEMPOTENCY_DRIVE_DUPLICATE_INVALID');
  assertD6jA_(manifest.idempotencyVerificationPlan?.duplicateSheetRow === false, 'D6J_A_IDEMPOTENCY_SHEET_DUPLICATE_INVALID');
  assertD6jA_(manifest.reconciliationRequirements?.requireCorrelationId === true, 'D6J_A_RECONCILIATION_CORRELATION_REQUIRED');
  return { ok: true, status: 'PASS_D6J_A_MANIFEST_VALID' };
}

export function evaluateD6jAPilotCandidate(candidate) {
  const messages = Number(candidate?.gmailMessageCount ?? 0);
  const attachments = Number(candidate?.attachmentCount ?? 0);
  const destructive = Number(candidate?.destructiveOperationCount ?? 0);
  const gmailMutation = Number(candidate?.gmailMutationCount ?? 0);
  const driveFiles = Number(candidate?.driveFilesCreated ?? 0);
  const sheetInserted = Number(candidate?.sheetRowsInserted ?? 0);
  const sheetUpdated = Number(candidate?.sheetRowsUpdated ?? 0);
  const commands = Number(candidate?.commandDocumentsCreated ?? 0);
  const blockingCodes = [];

  if (messages !== 1) blockingCodes.push('D6J_A_EXACT_ONE_MESSAGE_REQUIRED');
  if (attachments !== 1) blockingCodes.push('D6J_A_EXACT_ONE_ATTACHMENT_REQUIRED');
  if (gmailMutation !== 0) blockingCodes.push('D6J_A_GMAIL_MUTATION_FORBIDDEN');
  if (driveFiles > 1) blockingCodes.push('D6J_A_DRIVE_FILE_LIMIT_EXCEEDED');
  if (sheetInserted > 1) blockingCodes.push('D6J_A_SHEET_INSERT_LIMIT_EXCEEDED');
  if (sheetUpdated > 0) blockingCodes.push('D6J_A_SHEET_UPDATE_FORBIDDEN_BY_DEFAULT');
  if (commands !== 0) blockingCodes.push('D6J_A_COMMAND_DOCUMENT_FORBIDDEN');
  if (destructive !== 0) blockingCodes.push('D6J_A_DESTRUCTIVE_OPERATION_FORBIDDEN');

  return {
    ok: blockingCodes.length === 0,
    status: blockingCodes.length === 0 ? 'PASS_D6J_A_CANDIDATE_LIMITS' : 'BLOCKED_D6J_A_CANDIDATE_LIMITS',
    blockingCodes
  };
}

export function classifyD6jADeploymentGap(gap) {
  const required = [];
  const optional = [];
  const blockers = [];

  if (gap?.claspPushRequired) required.push('CLASP_PUSH');
  if (gap?.firestoreRulesDeployRequired) required.push('FIRESTORE_RULES_DEPLOY');
  if (gap?.firestoreIndexesDeployRequired) required.push('FIRESTORE_INDEX_DEPLOY');
  if (gap?.authorizedUserProvisioningRequired) required.push('AUTHORIZED_USER_PROVISIONING');
  if (gap?.appsScriptOAuthRequired) required.push('APPS_SCRIPT_OAUTH_AUTHORIZATION');
  if (gap?.firebaseAuthGoogleProviderRequired) required.push('FIREBASE_AUTH_GOOGLE_PROVIDER_ACTIVATION');
  if (gap?.firebaseHostingDeployRequired) optional.push('FIREBASE_HOSTING_DEPLOY_OPTIONAL_UI');
  if (gap?.billingRequired) blockers.push('D6J_A_BILLING_REQUIRED_NOT_ALLOWED');
  if (gap?.cloudRunRequired) blockers.push('D6J_A_CLOUD_RUN_REQUIRED_NOT_ALLOWED');

  return {
    ok: blockers.length === 0,
    required,
    optional,
    blockers,
    cloudRunStatus: 'DEFERRED_OPTIONAL'
  };
}

export function validateD6jAOwnerMarkerSeparation(markers) {
  const markerSet = new Set(markers || []);
  const missing = D6J_A_OWNER_MARKERS_.filter(marker => !markerSet.has(marker));
  assertD6jA_(missing.length === 0, `D6J_A_OWNER_MARKERS_MISSING:${missing.join(',')}`);
  assertD6jA_(markerSet.size === D6J_A_OWNER_MARKERS_.length, 'D6J_A_OWNER_MARKERS_NOT_SEPARATE');
  return { ok: true, markers: [...markerSet] };
}

export function redactD6jAPrivateIdentifiers(value) {
  if (Array.isArray(value)) return value.map(redactD6jAPrivateIdentifiers);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactD6jAPrivateIdentifiers(nested)]));
  }
  if (hasPrivateIdentifierShapeD6jA_(value)) return 'REDACTED_PRIVATE_IDENTIFIER';
  return value;
}

export function classifyD6jALiveBaseline(report) {
  const missing = [];
  if (report?.pilotEmailSelection !== 'CONFIRMED') missing.push('PILOT_EMAIL_SELECTION');
  if (report?.driveRootFolder !== 'CONFIRMED') missing.push('DRIVE_ROOT_FOLDER');
  if (report?.productionSheetTarget !== 'CONFIRMED') missing.push('PRODUCTION_SHEET_TARGET');
  return {
    status: missing.length === 0 ? 'READY_FOR_OWNER_MARKER' : 'OWNER_INPUT_REQUIRED',
    missing,
    mutationCountsZero: report?.productionMutationCounts?.every?.(count => count === 0) === true
  };
}
