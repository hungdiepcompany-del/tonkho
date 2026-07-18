const SGDS_D6C_D6E_SCHEMA_VERSION_ = 'SGDS_D6C_D6E_LOCAL_ADAPTERS_V1';

const SGDS_D6C_D6E_LOCAL_COMPONENTS_ = Object.freeze({
  D6C: Object.freeze([
    'GmailDiscoveryService',
    'GmailQueryBuilder',
    'GmailMessageNormalizer',
    'GmailAttachmentNormalizer',
    'GmailClassificationEngine',
    'GmailFingerprintService',
    'GmailDiscoveryCursor',
    'GmailTransport interface',
    'FakeGmailTransport',
    'GmailDiscoveryDryRunPlanner'
  ]),
  D6D: Object.freeze([
    'DriveEvidenceStore',
    'DrivePathPlanner',
    'DriveFileNameSanitizer',
    'DriveFolderResolver',
    'DriveDuplicateDetector',
    'DriveMetadataBuilder',
    'DriveReconciliationService',
    'DriveTransport interface',
    'FakeDriveTransport',
    'DriveWriteDryRunPlanner'
  ]),
  D6E: Object.freeze([
    'SheetsLedgerAdapter',
    'SheetSchemaRegistry',
    'SheetRowNormalizer',
    'SheetBusinessKeyBuilder',
    'SheetRecordMatcher',
    'SheetUpsertPlanner',
    'SheetColumnOwnershipPolicy',
    'SheetConflictDetector',
    'SheetReconciliationService',
    'SheetsTransport interface',
    'FakeSheetsTransport',
    'SheetWriteDryRunPlanner'
  ]),
  shared: Object.freeze([
    'SharedIdempotencyContract',
    'SharedNormalizationContract',
    'SharedDryRunPlanner',
    'SharedReconciliationContract'
  ])
});

const SGDS_D6_DEFAULT_CLASSIFICATION_ = 'unknown';
const SGDS_D6_CLASSIFICATIONS_ = Object.freeze([
  'invoice',
  'quotation',
  'purchase_order',
  'delivery_note',
  'report',
  'spreadsheet',
  'image',
  'pdf_document',
  'unknown'
]);

const SGDS_D6_DRIVE_RECONCILIATION_STATES_ = Object.freeze([
  'planned_new_file',
  'existing_exact_match',
  'existing_source_identity_match',
  'conflicting_hash',
  'conflicting_metadata',
  'missing_source_attachment',
  'invalid_path',
  'requires_review'
]);

function createD6AdapterConfig_(overrides) {
  const source = overrides || {};
  const config = {
    dryRun: source.dryRun !== false,
    maxThreads: Math.min(Math.max(Number(source.maxThreads || 10), 1), 50),
    maxMessagesPerThread: Math.min(Math.max(Number(source.maxMessagesPerThread || 5), 1), 20),
    allowWholeMailbox: source.allowWholeMailbox === true,
    allowTrustedRawQuery: source.allowTrustedRawQuery === true,
    timezone: normalizeD6String_(source.timezone || 'Asia/Ho_Chi_Minh'),
    rootFolderName: normalizeD6String_(source.rootFolderName || 'SyncGmailDriveSheet'),
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
  validateD6AdapterConfig_(config);
  return Object.freeze(config);
}

function validateD6AdapterConfig_(config) {
  if (!config || config.dryRun !== true) {
    throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'D6 adapters default to dry-run only');
  }
  if (!Number.isFinite(config.maxThreads) || config.maxThreads < 1 || config.maxThreads > 50) {
    throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'bounded Gmail maxThreads required');
  }
  if (config.allowWholeMailbox === true) {
    throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'whole mailbox discovery is blocked');
  }
  return true;
}

function createGmailQueryBuilder_(config) {
  return Object.freeze({
    build(filters) {
      return buildGmailDiscoveryQuery_(filters || {}, config);
    }
  });
}

function buildGmailDiscoveryQuery_(filters, configInput) {
  const config = createD6AdapterConfig_(configInput || {});
  const source = filters || {};
  const tokens = [];
  const add = (prefix, value) => {
    const normalized = normalizeD6String_(value);
    if (normalized) tokens.push(prefix + ':' + escapeGmailQueryValue_(normalized));
  };
  if (source.rawQuery) {
    if (source.trustedRaw !== true || config.allowTrustedRawQuery !== true) {
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'unsafe raw Gmail query rejected');
    }
    tokens.push(normalizeD6String_(source.rawQuery));
  }
  add('from', source.from);
  add('to', source.to);
  add('subject', source.subject);
  if (source.hasAttachment === true) tokens.push('has:attachment');
  if (source.unread === true) tokens.push('is:unread');
  if (source.after) tokens.push('after:' + normalizeD6Date_(source.after).compactDate);
  if (source.before) tokens.push('before:' + normalizeD6Date_(source.before).compactDate);
  (Array.isArray(source.labels) ? source.labels : []).forEach(label => add('label', label));
  if (!tokens.length) {
    throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'bounded Gmail discovery filter required');
  }
  const maxResults = Math.min(Math.max(Number(source.maxResults || config.maxThreads), 1), config.maxThreads);
  return {
    query: tokens.join(' '),
    maxResults,
    cursor: normalizeD6String_(source.cursor || ''),
    dryRunSummary: {
      bounded: true,
      wholeMailbox: false,
      filterCount: tokens.length,
      maxResults,
      schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
    },
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function escapeGmailQueryValue_(value) {
  const text = normalizeD6String_(value).replace(/["\\]/g, ' ');
  return /\s/.test(text) ? '"' + text.trim() + '"' : text.trim();
}

function createGmailMessageNormalizer_(options) {
  return Object.freeze({
    normalize(message) {
      return normalizeGmailMessageForDiscovery_(message || {}, options || {});
    }
  });
}

function normalizeGmailMessageForDiscovery_(message, options) {
  const source = message || {};
  const gmailMessageId = normalizeD6String_(source.gmailMessageId || source.messageId);
  const threadId = normalizeD6String_(source.threadId);
  const sender = parseD6EmailAddress_(source.from || source.sender || source.senderEmail);
  const receivedAt = normalizeD6Timestamp_(source.receivedAt || source.internalDate || source.date);
  const sentAt = normalizeD6Timestamp_(source.sentAt || source.date || receivedAt);
  const attachments = (Array.isArray(source.attachments) ? source.attachments : []).map(att =>
    normalizeGmailAttachmentForDiscovery_({ ...att, gmailMessageId }, options || {})
  );
  const dto = {
    gmailMessageId,
    threadId,
    senderEmail: sender.email,
    senderDisplayName: sender.displayName,
    recipientEmails: normalizeD6EmailList_(source.to || source.recipients || source.recipientEmails),
    ccEmails: normalizeD6EmailList_(source.cc || source.ccEmails),
    subject: normalizeD6String_(source.subject),
    receivedAt,
    sentAt,
    snippet: normalizeD6String_(source.snippet || source.bodyPreview || '').slice(0, 180),
    normalizedHeaders: normalizeD6Headers_(source.headers || source.normalizedHeaders),
    attachmentCandidates: attachments,
    labelIds: normalizeD6StringList_(source.labelIds),
    labelNames: normalizeD6StringList_(source.labels || source.labelNames),
    sourceAccount: normalizeD6Email_(source.sourceAccount || source.mailbox || ''),
    sourceMailbox: normalizeD6String_(source.sourceMailbox || source.mailbox || 'primary'),
    messageFingerprint: '',
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
  dto.messageFingerprint = fingerprintGmailMessage_(dto);
  return dto;
}

function normalizeGmailAttachmentForDiscovery_(attachment, options) {
  const source = attachment || {};
  const originalFilename = normalizeD6String_(source.originalFilename || source.fileName || source.name);
  const bytes = source.bytes || source.fixtureBytes || '';
  const expectedSha256 = normalizeD6String_(source.expectedSha256 || source.sha256 || source.contentHash);
  const computedSha256 = bytes && options && typeof options.sha256Provider === 'function'
    ? normalizeD6String_(options.sha256Provider(bytes))
    : '';
  const dto = {
    gmailMessageId: normalizeD6String_(source.gmailMessageId || source.messageId),
    attachmentId: normalizeD6String_(source.attachmentId || source.id || originalFilename),
    originalFilename,
    normalizedFilename: normalizeD6FileName_(originalFilename),
    mimeType: normalizeD6String_(source.mimeType || 'application/octet-stream').toLowerCase(),
    sizeBytes: Number(source.sizeBytes || source.byteSize || source.size || 0),
    inline: source.inline === true,
    contentId: normalizeD6String_(source.contentId || ''),
    attachmentFingerprint: '',
    expectedSha256: computedSha256 || expectedSha256,
    computedSha256,
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
  dto.attachmentFingerprint = fingerprintGmailAttachment_(dto);
  return dto;
}

function classifyGmailCandidate_(candidate) {
  const source = candidate || {};
  const attachment = source.attachment || source;
  const name = normalizeD6String_(attachment.normalizedFilename || attachment.originalFilename || attachment.fileName).toLowerCase();
  const mime = normalizeD6String_(attachment.mimeType).toLowerCase();
  const subject = normalizeD6String_(source.subject || '').toLowerCase();
  const rules = [];
  const reasons = [];
  let classification = SGDS_D6_DEFAULT_CLASSIFICATION_;
  let score = 0;
  const match = (id, type, points) => {
    rules.push(id);
    classification = type;
    score += points;
  };
  if (name.endsWith('.xml') || mime.includes('xml')) match('attachment_xml_invoice_source', 'invoice', 80);
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('spreadsheet')) match('attachment_spreadsheet', 'spreadsheet', 60);
  if (/bao gia|quotation|quote/.test(subject + ' ' + name)) match('subject_quotation', 'quotation', 70);
  if (/purchase.?order|don dat hang|po[-_\s]?/.test(subject + ' ' + name)) match('subject_purchase_order', 'purchase_order', 70);
  if (/delivery|giao hang/.test(subject + ' ' + name)) match('subject_delivery_note', 'delivery_note', 70);
  if (/report|bao cao/.test(subject + ' ' + name)) match('subject_report', 'report', 55);
  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/.test(name)) match('attachment_image', 'image', 40);
  if ((name.endsWith('.pdf') || mime.includes('pdf')) && !rules.length) match('attachment_pdf_document', 'pdf_document', 45);
  if (/invoice|hoa.?don|hddt|xml/.test(subject + ' ' + name)) match('semantic_invoice', 'invoice', 30);
  if (!rules.length) reasons.push('NO_CLASSIFICATION_RULE_MATCHED');
  if (!attachment.attachmentId) reasons.push('MISSING_ATTACHMENT_ID');
  if (!attachment.expectedSha256 && !attachment.computedSha256) reasons.push('MISSING_ATTACHMENT_HASH');
  return {
    classification: SGDS_D6_CLASSIFICATIONS_.includes(classification) ? classification : 'unknown',
    score: Math.min(score, 100),
    matchedRuleIds: rules,
    unmatchedReasons: reasons,
    requiresReview: classification === 'unknown' || reasons.length > 0,
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function fingerprintGmailMessage_(message) {
  return sgdsD6Hash_([
    'gmail-message',
    message.threadId,
    message.gmailMessageId,
    message.senderEmail,
    message.subject,
    message.receivedAt,
    (message.attachmentCandidates || []).map(att => att.attachmentFingerprint || att.attachmentId).join(',')
  ].join('|'));
}

function fingerprintGmailAttachment_(attachment) {
  return sgdsD6Hash_([
    'gmail-attachment',
    attachment.gmailMessageId,
    attachment.attachmentId,
    attachment.normalizedFilename,
    attachment.mimeType,
    attachment.sizeBytes,
    attachment.expectedSha256 || attachment.computedSha256
  ].join('|'));
}

function createGmailDiscoveryCursor_(input) {
  return {
    lastThreadId: normalizeD6String_(input && input.lastThreadId),
    lastMessageId: normalizeD6String_(input && input.lastMessageId),
    lastReceivedAt: normalizeD6Timestamp_(input && input.lastReceivedAt),
    pageTokenHashPrefix: sgdsD6HashPrefix_(input && input.pageToken),
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function serializeGmailDiscoveryCursor_(cursor) {
  return JSON.stringify(createGmailDiscoveryCursor_(cursor || {}));
}

function createGmailDiscoveryDryRunPlanner_(config) {
  return Object.freeze({
    plan(input) {
      return planGmailDiscoveryDryRun_(input || {}, config || {});
    }
  });
}

function planGmailDiscoveryDryRun_(input, configInput) {
  const queryPlan = buildGmailDiscoveryQuery_(input.filters || {}, configInput || {});
  const messages = (Array.isArray(input.messages) ? input.messages : []).slice(0, queryPlan.maxResults)
    .map(message => normalizeGmailMessageForDiscovery_(message, input));
  const candidates = [];
  messages.forEach(message => {
    message.attachmentCandidates.forEach(attachment => {
      const classification = classifyGmailCandidate_({ ...message, attachment });
      candidates.push({
        gmailMessageId: message.gmailMessageId,
        threadId: message.threadId,
        attachmentId: attachment.attachmentId,
        normalizedFilename: attachment.normalizedFilename,
        classification: classification.classification,
        classificationScore: classification.score,
        requiresReview: classification.requiresReview,
        messageFingerprint: message.messageFingerprint,
        attachmentFingerprint: attachment.attachmentFingerprint,
        expectedSha256: attachment.expectedSha256,
        schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
      });
    });
  });
  return {
    queryPlan,
    cursor: createGmailDiscoveryCursor_(input.cursor || {}),
    normalizedMessages: messages,
    candidates,
    dryRun: true,
    productionMutation: 'NONE',
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function planDrivePath_(input, configInput) {
  const config = createD6AdapterConfig_(configInput || {});
  const classification = normalizeD6Classification_(input && input.classification);
  const received = normalizeD6Date_((input && (input.receivedAt || input.documentDate)) || new Date().toISOString().slice(0, 10));
  const segments = [
    config.rootFolderName,
    String(received.year),
    padD6_(received.month),
    classification
  ];
  if (input && input.senderBusinessFolder) segments.push(normalizeDrivePathSegment_(input.senderBusinessFolder));
  segments.forEach(segment => {
    if (!segment || segment === '.' || segment === '..' || segment.includes('..')) {
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'invalid Drive evidence path segment');
    }
  });
  return {
    path: segments.join('/'),
    segments,
    timezone: config.timezone,
    classification,
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function sanitizeDriveFileName_(fileName, options) {
  const original = normalizeD6String_(fileName);
  if (!original) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'Drive filename required');
  if (/[\\/]/.test(original) || original.includes('..')) {
    throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'Drive filename traversal rejected');
  }
  const maxLength = Math.min(Math.max(Number(options && options.maxLength || 120), 32), 180);
  let sanitized = original
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  sanitized = sanitized.replace(/^\.+/, '').replace(/\.+$/, '');
  const parts = sanitized.split('.');
  if (parts.length > 2 && ['exe', 'bat', 'cmd', 'js', 'vbs'].includes(parts[parts.length - 2].toLowerCase())) {
    parts.splice(parts.length - 2, 1);
    sanitized = parts.join('.');
  }
  if (sanitized.length > maxLength) {
    const extension = getD6Extension_(sanitized);
    const base = extension ? sanitized.slice(0, -extension.length - 1) : sanitized;
    sanitized = base.slice(0, maxLength - (extension.length ? extension.length + 1 : 0)) + (extension ? '.' + extension : '');
  }
  if (!sanitized) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'Drive filename sanitized empty');
  return {
    originalFilename: original,
    sanitizedFilename: sanitized,
    extension: getD6Extension_(sanitized),
    changed: original !== sanitized,
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function buildDriveEvidenceMetadata_(input) {
  const source = input || {};
  return {
    sourceSystem: 'gmail',
    gmailMessageIdHashPrefix: sgdsD6HashPrefix_(source.gmailMessageId),
    gmailThreadIdHashPrefix: sgdsD6HashPrefix_(source.threadId),
    attachmentIdHashPrefix: sgdsD6HashPrefix_(source.attachmentId),
    sourceSha256: normalizeD6String_(source.expectedSha256 || source.sourceSha256 || source.contentHash),
    messageFingerprint: normalizeD6String_(source.messageFingerprint),
    attachmentFingerprint: normalizeD6String_(source.attachmentFingerprint),
    classification: normalizeD6Classification_(source.classification),
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function detectDriveDuplicate_(candidate, existingFiles) {
  const source = candidate || {};
  const files = Array.isArray(existingFiles) ? existingFiles : [];
  const sourceSha = normalizeD6String_(source.expectedSha256 || source.sourceSha256 || source.contentHash);
  const sourceIdentity = [source.gmailMessageId, source.threadId, source.attachmentId].map(normalizeD6String_).join('|');
  const exact = files.find(file => normalizeD6String_(file.sourceSha256 || file.contentHash) && normalizeD6String_(file.sourceSha256 || file.contentHash) === sourceSha);
  if (exact) return { status: 'existing_exact_match', existingReference: safeDriveReference_(exact), writeRequired: false };
  const identityMatch = files.find(file => [file.gmailMessageId, file.threadId, file.attachmentId].map(normalizeD6String_).join('|') === sourceIdentity);
  if (identityMatch) {
    const existingHash = normalizeD6String_(identityMatch.sourceSha256 || identityMatch.contentHash);
    return {
      status: existingHash && sourceSha && existingHash !== sourceSha ? 'conflicting_hash' : 'existing_source_identity_match',
      existingReference: safeDriveReference_(identityMatch),
      writeRequired: false
    };
  }
  return { status: 'planned_new_file', existingReference: '', writeRequired: true };
}

function reconcileDriveEvidence_(input) {
  const source = input || {};
  if (!source.attachmentId) return { state: 'missing_source_attachment', requiresReview: true };
  if (source.invalidPath) return { state: 'invalid_path', requiresReview: true };
  if (source.duplicateStatus === 'conflicting_hash') return { state: 'conflicting_hash', requiresReview: true };
  if (source.duplicateStatus === 'existing_exact_match') return { state: 'existing_exact_match', requiresReview: false };
  if (source.duplicateStatus === 'existing_source_identity_match') return { state: 'existing_source_identity_match', requiresReview: false };
  if (source.metadataConflict) return { state: 'conflicting_metadata', requiresReview: true };
  return { state: 'planned_new_file', requiresReview: false };
}

function planDriveWriteDryRun_(candidate, existingFiles, configInput) {
  const safeName = sanitizeDriveFileName_(candidate && (candidate.originalFilename || candidate.normalizedFilename || candidate.fileName));
  const pathPlan = planDrivePath_(candidate || {}, configInput || {});
  const duplicate = detectDriveDuplicate_(candidate || {}, existingFiles || []);
  const reconciliation = reconcileDriveEvidence_({ ...(candidate || {}), duplicateStatus: duplicate.status });
  const idempotencyKey = sgdsD6Hash_([
    'drive-plan',
    pathPlan.path,
    safeName.sanitizedFilename,
    candidate && (candidate.expectedSha256 || candidate.sourceSha256 || candidate.contentHash),
    candidate && candidate.attachmentFingerprint
  ].join('|'));
  return {
    action: duplicate.writeRequired && reconciliation.requiresReview === false ? 'DRY_RUN_CREATE_FILE' : 'DRY_RUN_NO_WRITE',
    pathPlan,
    fileNamePlan: safeName,
    duplicate,
    metadata: buildDriveEvidenceMetadata_(candidate || {}),
    reconciliation,
    idempotencyKey,
    productionMutation: 'NONE',
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function getSheetSchemaRegistry_() {
  return Object.freeze({
    sheetName: 'Hoa-Don',
    keyField: 'businessKey',
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_,
    fields: Object.freeze([
      'recordId',
      'businessKey',
      'documentType',
      'documentNumber',
      'documentDate',
      'senderSupplier',
      'subject',
      'amount',
      'currency',
      'gmailMessageId',
      'gmailThreadId',
      'attachmentId',
      'driveFileId',
      'driveFileUrl',
      'sourceSha256',
      'processingStatus',
      'reviewStatus',
      'createdAt',
      'updatedAt',
      'schemaVersion'
    ])
  });
}

function normalizeSheetRecord_(record) {
  const source = record || {};
  const date = normalizeD6Date_(source.documentDate || source.date || '');
  const amount = normalizeD6Decimal_(source.amount);
  const normalized = {
    recordId: normalizeD6String_(source.recordId),
    businessKey: normalizeD6String_(source.businessKey),
    documentType: normalizeD6String_(source.documentType || 'invoice').toLowerCase(),
    documentNumber: normalizeD6DocumentNumber_(source.documentNumber || source.invoiceNumber),
    documentDate: date.isoDate,
    senderSupplier: normalizeD6String_(source.senderSupplier || source.supplier || source.senderEmail),
    subject: normalizeD6String_(source.subject),
    amount: amount.value,
    currency: normalizeD6Currency_(source.currency || 'VND'),
    gmailMessageId: normalizeD6String_(source.gmailMessageId),
    gmailThreadId: normalizeD6String_(source.gmailThreadId || source.threadId),
    attachmentId: normalizeD6String_(source.attachmentId),
    driveFileId: normalizeD6String_(source.driveFileId),
    driveFileUrl: normalizeD6Url_(source.driveFileUrl),
    sourceSha256: normalizeD6String_(source.sourceSha256 || source.expectedSha256),
    processingStatus: normalizeD6String_(source.processingStatus || 'planned'),
    reviewStatus: normalizeD6String_(source.reviewStatus || (date.ambiguous || amount.invalid ? 'HOLD_FOR_REVIEW' : 'READY')),
    createdAt: normalizeD6Timestamp_(source.createdAt),
    updatedAt: normalizeD6Timestamp_(source.updatedAt),
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
  normalized.businessKey = normalized.businessKey || buildSheetBusinessKey_(normalized).businessKey;
  return normalized;
}

function buildSheetBusinessKey_(record) {
  const source = record || {};
  const parts = [
    normalizeD6String_(source.documentType || 'invoice').toLowerCase(),
    normalizeD6DocumentNumber_(source.documentNumber),
    normalizeD6Date_(source.documentDate).isoDate,
    normalizeD6String_(source.senderSupplier || source.senderEmail).toLowerCase(),
    normalizeD6String_(source.sourceSha256)
  ].filter(Boolean);
  return {
    businessKey: parts.join('|'),
    priority: ['documentType', 'documentNumber', 'documentDate', 'senderSupplier', 'sourceSha256'],
    rowNumberUsed: false,
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function matchSheetRecords_(candidate, rows) {
  const normalized = normalizeSheetRecord_(candidate || {});
  const records = Array.isArray(rows) ? rows.map(normalizeSheetRecord_) : [];
  const byBusinessKey = records.filter(row => row.businessKey === normalized.businessKey);
  if (byBusinessKey.length) return { status: byBusinessKey.length > 1 ? 'MULTIPLE_MATCHES' : 'MATCHED_BY_BUSINESS_KEY', matches: byBusinessKey };
  const byHash = records.filter(row => row.sourceSha256 && row.sourceSha256 === normalized.sourceSha256);
  if (byHash.length) return { status: 'MATCHED_BY_SOURCE_HASH', matches: byHash };
  return { status: 'NO_MATCH', matches: [] };
}

function getSheetColumnOwnershipPolicy_() {
  return Object.freeze({
    systemOwned: Object.freeze([
      'recordId',
      'businessKey',
      'gmailMessageId',
      'gmailThreadId',
      'attachmentId',
      'driveFileId',
      'driveFileUrl',
      'sourceSha256',
      'processingStatus',
      'createdAt',
      'updatedAt',
      'schemaVersion'
    ]),
    userEditable: Object.freeze([
      'documentType',
      'documentNumber',
      'documentDate',
      'senderSupplier',
      'subject',
      'amount',
      'currency',
      'reviewStatus'
    ])
  });
}

function detectSheetConflict_(candidate, existing) {
  const policy = getSheetColumnOwnershipPolicy_();
  const next = normalizeSheetRecord_(candidate || {});
  const current = normalizeSheetRecord_(existing || {});
  const systemChanges = [];
  const userEditableChanges = [];
  policy.systemOwned.forEach(field => {
    if (normalizeD6String_(next[field]) !== normalizeD6String_(current[field])) systemChanges.push(field);
  });
  policy.userEditable.forEach(field => {
    if (normalizeD6String_(next[field]) !== normalizeD6String_(current[field])) userEditableChanges.push(field);
  });
  return {
    systemOwnedChanges: systemChanges,
    userEditableConflicts: userEditableChanges,
    requiresReview: userEditableChanges.length > 0,
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function planSheetUpsert_(candidate, existingRows) {
  const normalized = normalizeSheetRecord_(candidate || {});
  const validation = validateSheetRecord_(normalized);
  if (validation.length) {
    return buildSheetPlan_('REJECT_INVALID', normalized, [], validation, true);
  }
  if (normalized.reviewStatus === 'HOLD_FOR_REVIEW') {
    return buildSheetPlan_('HOLD_FOR_REVIEW', normalized, [], ['AMBIGUOUS_OR_REVIEW_STATUS'], true);
  }
  const match = matchSheetRecords_(normalized, existingRows || []);
  if (match.status === 'MULTIPLE_MATCHES') {
    return buildSheetPlan_('HOLD_FOR_REVIEW', normalized, match.matches, ['MULTIPLE_EXISTING_SHEET_MATCHES'], true);
  }
  if (!match.matches.length) return buildSheetPlan_('INSERT', normalized, [], [], false);
  const conflict = detectSheetConflict_(normalized, match.matches[0]);
  if (conflict.requiresReview) {
    return buildSheetPlan_('HOLD_FOR_REVIEW', normalized, match.matches, ['USER_EDITABLE_CONFLICT'], true, conflict);
  }
  if (!conflict.systemOwnedChanges.length) return buildSheetPlan_('NO_OP', normalized, match.matches, [], false, conflict);
  return buildSheetPlan_('UPDATE', normalized, match.matches, [], false, conflict);
}

function buildSheetPlan_(action, record, matches, reasons, requiresReview, conflict) {
  return {
    action,
    record,
    matches,
    reasons,
    requiresReview,
    conflict: conflict || { systemOwnedChanges: [], userEditableConflicts: [], requiresReview: false },
    idempotencyKey: sgdsD6Hash_(['sheet-plan', action, record.businessKey, record.sourceSha256].join('|')),
    productionMutation: 'NONE',
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function reconcileSheetLinks_(input) {
  const source = input || {};
  const missing = [];
  ['gmailMessageId', 'gmailThreadId', 'attachmentId', 'driveFileId', 'sourceSha256'].forEach(field => {
    if (!normalizeD6String_(source[field])) missing.push(field);
  });
  return {
    status: missing.length ? 'REQUIRES_REVIEW_MISSING_LINKS' : 'LINKS_CONSISTENT',
    missingFields: missing,
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function planSheetWriteDryRun_(candidate, existingRows) {
  return planSheetUpsert_(candidate || {}, existingRows || []);
}

function createD6CombinedDryRunPlanner_(config) {
  return Object.freeze({
    plan(input) {
      return planD6CombinedDryRun_(input || {}, config || {});
    }
  });
}

function planD6CombinedDryRun_(input, configInput) {
  const gmailPlan = planGmailDiscoveryDryRun_(input.gmail || {}, configInput || {});
  const candidates = gmailPlan.candidates.map(candidate => {
    const driveCandidate = { ...candidate, originalFilename: candidate.normalizedFilename, receivedAt: input.receivedAt || '' };
    const drivePlan = planDriveWriteDryRun_(driveCandidate, input.driveExistingFiles || [], configInput || {});
    const businessRecord = normalizeSheetRecord_({
      ...(input.businessRecord || {}),
      gmailMessageId: candidate.gmailMessageId,
      gmailThreadId: candidate.threadId,
      attachmentId: candidate.attachmentId,
      driveFileId: drivePlan.duplicate.existingReference || 'planned_drive_' + candidate.attachmentFingerprint.slice(0, 8),
      sourceSha256: candidate.expectedSha256,
      processingStatus: 'dry_run_planned'
    });
    const sheetPlan = planSheetWriteDryRun_(businessRecord, input.sheetRows || []);
    return {
      candidate,
      drivePlan,
      sheetPlan,
      reconciliation: reconcileSheetLinks_(businessRecord),
      jobPlan: {
        action: 'DRY_RUN_CREATE_FIRESTORE_JOB',
        jobIdHashPrefix: sgdsD6HashPrefix_(candidate.messageFingerprint + candidate.attachmentFingerprint),
        auditEvent: 'D6C_D6E_LOCAL_DRY_RUN_PLANNED',
        productionFirestoreAccess: 'NONE'
      }
    };
  });
  return {
    gmailPlan,
    candidates,
    dryRun: true,
    productionMutation: 'NONE',
    productionGoogleApiCallCount: 0,
    deterministicPlanHash: sgdsD6Hash_(JSON.stringify(candidates.map(item => ({
      candidate: item.candidate.attachmentFingerprint,
      drive: item.drivePlan.idempotencyKey,
      sheet: item.sheetPlan.idempotencyKey
    })))),
    schemaVersion: SGDS_D6C_D6E_SCHEMA_VERSION_
  };
}

function normalizeD6String_(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function normalizeD6StringList_(value) {
  return (Array.isArray(value) ? value : normalizeD6String_(value).split(/[;,]/))
    .map(normalizeD6String_)
    .filter(Boolean);
}

function normalizeD6Email_(value) {
  return normalizeD6String_(value).toLowerCase();
}

function normalizeD6EmailList_(value) {
  return normalizeD6StringList_(value).map(normalizeD6Email_).filter(Boolean);
}

function parseD6EmailAddress_(value) {
  const text = normalizeD6String_(value);
  const match = text.match(/^(.*)<([^>]+)>$/);
  if (!match) return { displayName: '', email: normalizeD6Email_(text) };
  return { displayName: normalizeD6String_(match[1]).replace(/^"|"$/g, ''), email: normalizeD6Email_(match[2]) };
}

function normalizeD6Headers_(headers) {
  const source = headers || {};
  const out = {};
  Object.keys(source).sort().forEach(key => {
    out[normalizeD6String_(key).toLowerCase()] = normalizeD6String_(source[key]);
  });
  return out;
}

function normalizeD6FileName_(value) {
  return normalizeD6String_(value).replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ');
}

function normalizeD6Classification_(value) {
  const normalized = normalizeD6String_(value).toLowerCase();
  return SGDS_D6_CLASSIFICATIONS_.includes(normalized) ? normalized : SGDS_D6_DEFAULT_CLASSIFICATION_;
}

function normalizeD6DocumentNumber_(value) {
  return normalizeD6String_(value).toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9._/-]/g, '');
}

function normalizeD6Date_(value) {
  const text = normalizeD6String_(value);
  if (!text) return { isoDate: '', compactDate: '', year: '', month: '', ambiguous: true };
  let iso = '';
  let ambiguous = false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    iso = text;
  } else {
    const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (match) {
      ambiguous = Number(match[1]) <= 12 && Number(match[2]) <= 12;
      iso = match[3] + '-' + padD6_(match[2]) + '-' + padD6_(match[1]);
    } else {
      ambiguous = true;
    }
  }
  return {
    isoDate: iso,
    compactDate: iso.replace(/-/g, ''),
    year: iso ? iso.slice(0, 4) : '',
    month: iso ? iso.slice(5, 7) : '',
    ambiguous
  };
}

function normalizeD6Timestamp_(value) {
  const text = normalizeD6String_(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text;
  const date = normalizeD6Date_(text);
  return date.isoDate ? date.isoDate + 'T00:00:00.000Z' : '';
}

function normalizeD6Decimal_(value) {
  const text = normalizeD6String_(value).replace(/,/g, '');
  const number = Number(text);
  return { value: Number.isFinite(number) ? number : 0, invalid: text !== '' && !Number.isFinite(number) };
}

function normalizeD6Currency_(value) {
  const text = normalizeD6String_(value || 'VND').toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : 'VND';
}

function normalizeD6Boolean_(value) {
  if (value === true || value === false) return value;
  return ['true', 'yes', '1', 'y'].includes(normalizeD6String_(value).toLowerCase());
}

function normalizeD6Url_(value) {
  const text = normalizeD6String_(value);
  return /^https:\/\/[^\s]+$/i.test(text) ? text : '';
}

function validateSheetRecord_(record) {
  const missing = [];
  ['documentType', 'documentNumber', 'documentDate', 'senderSupplier', 'sourceSha256'].forEach(field => {
    if (!normalizeD6String_(record[field])) missing.push('MISSING_' + field.toUpperCase());
  });
  return missing;
}

function normalizeDrivePathSegment_(value) {
  return normalizeD6String_(value).replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g, '_').slice(0, 80);
}

function safeDriveReference_(file) {
  return normalizeD6String_(file && (file.driveFileId || file.fileReference || file.id));
}

function getD6Extension_(value) {
  const match = normalizeD6String_(value).match(/\.([A-Za-z0-9]{1,10})$/);
  return match ? match[1].toLowerCase() : '';
}

function padD6_(value) {
  return String(value).padStart(2, '0');
}

function sgdsD6HashPrefix_(value) {
  return sgdsD6Hash_(value || '').slice(0, 12);
}

function sgdsD6Hash_(value) {
  const text = normalizeD6String_(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ text.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
}
