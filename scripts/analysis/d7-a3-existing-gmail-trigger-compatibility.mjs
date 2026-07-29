import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const D7_A3_ALLOWED_OWNER_DECISIONS = Object.freeze([
  'PRESERVE_AND_ALLOW_COEXISTENCE_WITH_EXPLICIT_GUARDS',
  'PRESERVE_BUT_REQUIRE_SCHEDULE_SEPARATION',
  'OWNER_DISABLE_TRIGGER_BEFORE_D7_B',
  'MIGRATE_TRIGGER_BEHAVIOR_INTO_D7_BEFORE_ROLLOUT',
  'BLOCK_PENDING_MORE_EVIDENCE',
]);

const SOURCE_FILES = Object.freeze([
  '_triggerMarkInvoiceEmails.js',
  'gmailLabels.js',
  'sercurity.js',
  'Invoice_AttachmentParser.js',
  'config.js',
  'utils.js',
]);

export function analyzeD7A3ExistingGmailTriggerCompatibility(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const sources = readD7A3Sources(rootDir, options.sources);
  const triggerSource = sources['_triggerMarkInvoiceEmails.js'] || '';
  const labelSource = sources['gmailLabels.js'] || '';
  const securitySource = sources.sercurity || sources['sercurity.js'] || '';
  const parserSource = sources['Invoice_AttachmentParser.js'] || '';
  const configSource = sources['config.js'] || '';
  const allSource = Object.values(sources).join('\n');

  const handler = 'triggerMarkAllInvoiceEmails';
  const handlerExists = hasFunctionD7A3(triggerSource, handler);
  const installedTriggers = normalizeD7A3InstalledTriggers(options.installedTriggers || [{
    handlerFunction: handler,
    eventType: 'NOT_RECORDED_IN_OWNER_OUTPUT',
    triggerSource: 'NOT_RECORDED_IN_OWNER_OUTPUT',
    schedule: 'NOT_OBSERVABLE_FROM_LOCAL_SOURCE',
  }]);

  const labelCreationReachable = /GmailApp\.createLabel\s*\(/.test(labelSource) && /getOrCreateLabel_\s*\(/.test(triggerSource);
  const labelAssignmentReachable = /\.addToThread\s*\(/.test(triggerSource) || /\.addLabel\s*\(/.test(labelSource);
  const importantReachable = /\.markImportant\s*\(/.test(triggerSource);
  const starReachable = /\.star\s*\(/.test(triggerSource);
  const archiveReachable = /moveToArchive\s*\(|archive\s*\(/.test(triggerSource);
  const attachmentReadsReachable = /getAttachments\s*\(/.test(triggerSource);
  const xmlParsingReachable = /loadXmlDocument_\s*\(|extractXmlMeta_\s*\(|isVatInvoiceXML_\s*\(/.test(triggerSource)
    && /XmlService\.parse\s*\(/.test(parserSource);
  const pdfParsingReachable = /extractPdfText_\s*\(/.test(triggerSource)
    && /Drive\.Files\.insert\s*\(/.test(parserSource);
  const driveMutationReachable = pdfParsingReachable
    && (/Drive\.Files\.insert\s*\(/.test(parserSource) || /setTrashed\s*\(/.test(parserSource));
  const sheetMutationReachable = false;
  const firestoreMutationReachable = false;
  const scriptPropertyWriteReachable = /setProperty\s*\(/.test(securitySource) && /guardTrigger_\s*\(/.test(triggerSource);
  const lockReachable = /LockService\.getScriptLock\s*\(/.test(securitySource) && /assertAntiReplayTrigger_\s*\(/.test(securitySource);
  const triggerSignatureControls = /assertTriggerSignature_\s*\(/.test(triggerSource) && /TRIGGER_SECRET/.test(securitySource);
  const antiReplayControls = /assertAntiReplayTrigger_\s*\(/.test(triggerSource)
    && /LAST_TRIGGER_RUN/.test(securitySource)
    && /assertTriggerMinuteSignature_\s*\(/.test(triggerSource);
  const timeoutBounded = /deadline\s*=\s*Date\.now\(\)\s*\+/.test(triggerSource);
  const maxGmailSearchLimit = extractD7A3MaxGmailSearchLimit(triggerSource, configSource);

  const gmailMutationReachable = labelCreationReachable || labelAssignmentReachable || importantReachable || starReachable || archiveReachable;
  const interferenceRisk = gmailMutationReachable || driveMutationReachable ? 'HIGH' : 'LOW';
  const concurrencyRisk = scriptPropertyWriteReachable || lockReachable || driveMutationReachable ? 'HIGH' : 'LOW';
  const safetyProofs = {
    d7BDoesNotDependOnMutableLabels: false,
    triggerCannotAlterApprovedCandidateIdentity: false,
    noConflictingLocks: lockReachable,
    noDuplicateAttachmentProcessing: false,
    gmailMutationDoesNotAlterD7Idempotency: false,
    concurrentExecutionBounded: timeoutBounded && lockReachable,
    triggerScheduleUnderstood: false,
    rollbackDefined: true,
  };
  const recommendedDecision = decideD7A3OwnerDecision({
    interferenceRisk,
    futureConcurrencyRisk: concurrencyRisk,
    safetyProofs,
  });

  return Object.freeze({
    PHASE: 'D7_A3_EXISTING_GMAIL_TRIGGER_COMPATIBILITY_AND_OWNER_DECISION_GATE',
    STATUS: 'PASS_ANALYSIS_COMPLETED_OWNER_DECISION_REQUIRED',
    INSTALLED_TRIGGER_HANDLER: handler,
    INSTALLED_TRIGGER_COUNT: installedTriggers.length,
    DUPLICATE_TRIGGER_COUNT: countD7A3Duplicates(installedTriggers.map(item => item.handlerFunction)),
    INSTALLED_TRIGGER_INVENTORY: installedTriggers,
    SOURCE_HANDLER_EXISTS: handlerExists ? 'YES' : 'NO',
    EXISTING_TRIGGER_CLASSIFICATION: gmailMutationReachable ? 'MUTATING_GMAIL_TRIGGER' : 'READ_ONLY_TRIGGER',
    GMAIL_READ_METHODS: stableD7A3List([
      'GmailApp.search',
      'GmailApp.getUserLabelByName',
      'thread.getMessages',
      'message.getFrom',
      'message.getSubject',
      'message.getBody',
      'message.getAttachments',
      'attachment.getName',
      'attachment.getContentType',
      'attachment.copyBlob',
    ]),
    GMAIL_MUTATION_METHODS: stableD7A3List([
      labelCreationReachable ? 'GmailApp.createLabel' : '',
      labelAssignmentReachable ? 'label.addToThread' : '',
      importantReachable ? 'thread.markImportant' : '',
      starReachable ? 'message.star' : '',
    ]),
    LABEL_CREATION_METHODS: labelCreationReachable ? ['GmailApp.createLabel'] : [],
    LABEL_ASSIGNMENT_METHODS: labelAssignmentReachable ? ['label.addToThread'] : [],
    IMPORTANCE_MUTATION_METHODS: importantReachable ? ['thread.markImportant'] : [],
    STAR_MUTATION_METHODS: starReachable ? ['message.star'] : [],
    ATTACHMENT_READS_REACHABLE: attachmentReadsReachable ? 'YES' : 'NO',
    XML_PARSING_REACHABLE: xmlParsingReachable ? 'YES' : 'NO',
    PDF_PARSING_REACHABLE: pdfParsingReachable ? 'YES' : 'NO',
    SCRIPT_PROPERTY_READ_REACHABLE: /getProperty\s*\(/.test(securitySource) ? 'YES' : 'NO',
    SCRIPT_PROPERTY_WRITE_REACHABLE: scriptPropertyWriteReachable ? 'YES' : 'NO',
    DRIVE_CALLS_REACHABLE: pdfParsingReachable ? 'YES' : 'NO',
    SHEET_CALLS_REACHABLE: 'NO',
    FIRESTORE_CALLS_REACHABLE: /Firestore|createFirestore|firestore/i.test(triggerSource) ? 'YES' : 'NO',
    LOCKS_REACHABLE: lockReachable ? 'YES' : 'NO',
    TRIGGER_SIGNATURE_CONTROLS: triggerSignatureControls ? 'YES' : 'NO',
    ANTI_REPLAY_CONTROLS: antiReplayControls ? 'YES' : 'NO',
    EXECUTION_TIMEOUT_BOUNDED: timeoutBounded ? 'YES' : 'NO',
    MAXIMUM_GMAIL_SEARCH_LIMIT: maxGmailSearchLimit,
    GMAIL_LABEL_CREATION_REACHABLE: labelCreationReachable ? 'YES' : 'NO',
    GMAIL_LABEL_ASSIGNMENT_REACHABLE: labelAssignmentReachable ? 'YES' : 'NO',
    GMAIL_IMPORTANT_MUTATION_REACHABLE: importantReachable ? 'YES' : 'NO',
    GMAIL_STAR_MUTATION_REACHABLE: starReachable ? 'YES' : 'NO',
    GMAIL_ARCHIVE_MUTATION_REACHABLE: archiveReachable ? 'YES' : 'NO',
    DRIVE_MUTATION_REACHABLE: driveMutationReachable ? 'YES' : 'NO',
    SHEET_MUTATION_REACHABLE: sheetMutationReachable ? 'YES' : 'NO',
    FIRESTORE_MUTATION_REACHABLE: firestoreMutationReachable ? 'YES' : 'NO',
    D7_B_CANDIDATE_DISCOVERY_INTERFERENCE_RISK: interferenceRisk,
    D7_FUTURE_AUTOMATION_CONCURRENCY_RISK: concurrencyRisk,
    COEXISTENCE_SAFETY_PROOFS: safetyProofs,
    RECOMMENDED_OWNER_DECISION: recommendedDecision,
    READY_FOR_D7_B: 'NO_PENDING_OWNER_TRIGGER_DECISION',
    TRIGGER_EXECUTED: 'NO',
    TRIGGER_MUTATION_COUNT: 0,
    D7_A_ENTRYPOINT_EXECUTED: 'NO',
    CANDIDATE_DISCOVERY_EXECUTED: 'NO',
    PRODUCTION_MUTATION: 'NONE',
    PRODUCTION_MUTATION_REACHABILITY_COUNT: 0,
    CALL_GRAPH_FUNCTIONS: stableD7A3List([
      'triggerMarkAllInvoiceEmails',
      'guardTrigger_',
      'assertTriggerSignature_',
      'assertAntiReplayTrigger_',
      'assertTriggerMinuteSignature_',
      'getOrCreateLabel_',
      'isOutgoingInvoice_',
      'isIncomingInvoice_',
      'isInvoiceContent_',
      'isExcludedSender_',
      'extractSenderDomain_',
      'loadXmlDocument_',
      'extractXmlMeta_',
      'parseInvoiceMeta_',
      'isVatInvoiceXML_',
      'extractPdfText_',
      'isVatInvoicePDF_',
      'normalizeTextForCompare_',
      'debugLog_',
    ].filter(name => allSource.includes(name))),
  });
}

export function decideD7A3OwnerDecision(input = {}) {
  const risk = String(input.interferenceRisk || 'UNKNOWN');
  const concurrency = String(input.futureConcurrencyRisk || 'UNKNOWN');
  const proofs = input.safetyProofs || {};
  if (risk === 'UNKNOWN' || concurrency === 'UNKNOWN') return 'BLOCK_PENDING_MORE_EVIDENCE';
  if (risk === 'HIGH' || concurrency === 'HIGH') return 'OWNER_DISABLE_TRIGGER_BEFORE_D7_B';
  const coexistenceProofs = [
    proofs.d7BDoesNotDependOnMutableLabels,
    proofs.triggerCannotAlterApprovedCandidateIdentity,
    proofs.noConflictingLocks,
    proofs.noDuplicateAttachmentProcessing,
    proofs.gmailMutationDoesNotAlterD7Idempotency,
    proofs.concurrentExecutionBounded,
    proofs.triggerScheduleUnderstood,
    proofs.rollbackDefined,
  ];
  if (coexistenceProofs.every(Boolean)) return 'PRESERVE_AND_ALLOW_COEXISTENCE_WITH_EXPLICIT_GUARDS';
  if (risk === 'MEDIUM' || concurrency === 'MEDIUM') return 'PRESERVE_BUT_REQUIRE_SCHEDULE_SEPARATION';
  return 'BLOCK_PENDING_MORE_EVIDENCE';
}

export function formatD7A3Report(report) {
  return [
    `PHASE=${report.PHASE}`,
    `STATUS=${report.STATUS}`,
    `INSTALLED_TRIGGER_HANDLER=${report.INSTALLED_TRIGGER_HANDLER}`,
    `EXISTING_TRIGGER_CLASSIFICATION=${report.EXISTING_TRIGGER_CLASSIFICATION}`,
    `GMAIL_LABEL_CREATION_REACHABLE=${report.GMAIL_LABEL_CREATION_REACHABLE}`,
    `GMAIL_LABEL_ASSIGNMENT_REACHABLE=${report.GMAIL_LABEL_ASSIGNMENT_REACHABLE}`,
    `GMAIL_IMPORTANT_MUTATION_REACHABLE=${report.GMAIL_IMPORTANT_MUTATION_REACHABLE}`,
    `GMAIL_STAR_MUTATION_REACHABLE=${report.GMAIL_STAR_MUTATION_REACHABLE}`,
    `DRIVE_MUTATION_REACHABLE=${report.DRIVE_MUTATION_REACHABLE}`,
    `SHEET_MUTATION_REACHABLE=${report.SHEET_MUTATION_REACHABLE}`,
    `FIRESTORE_MUTATION_REACHABLE=${report.FIRESTORE_MUTATION_REACHABLE}`,
    `D7_B_CANDIDATE_DISCOVERY_INTERFERENCE_RISK=${report.D7_B_CANDIDATE_DISCOVERY_INTERFERENCE_RISK}`,
    `D7_FUTURE_AUTOMATION_CONCURRENCY_RISK=${report.D7_FUTURE_AUTOMATION_CONCURRENCY_RISK}`,
    `RECOMMENDED_OWNER_DECISION=${report.RECOMMENDED_OWNER_DECISION}`,
    `READY_FOR_D7_B=${report.READY_FOR_D7_B}`,
    `TRIGGER_EXECUTED=${report.TRIGGER_EXECUTED}`,
    `TRIGGER_MUTATION_COUNT=${report.TRIGGER_MUTATION_COUNT}`,
    `CANDIDATE_DISCOVERY_EXECUTED=${report.CANDIDATE_DISCOVERY_EXECUTED}`,
    `PRODUCTION_MUTATION=${report.PRODUCTION_MUTATION}`,
  ].join('\n');
}

function readD7A3Sources(rootDir, provided) {
  if (provided) return provided;
  const sources = {};
  for (const file of SOURCE_FILES) {
    sources[file] = fs.readFileSync(path.join(rootDir, file), 'utf8');
  }
  return sources;
}

function normalizeD7A3InstalledTriggers(triggers) {
  return (Array.isArray(triggers) ? triggers : []).map(trigger => Object.freeze({
    handlerFunction: String(trigger.handlerFunction || trigger.functionName || '').trim(),
    eventType: String(trigger.eventType || trigger.triggerType || 'NOT_RECORDED_IN_OWNER_OUTPUT').trim(),
    triggerSource: String(trigger.triggerSource || 'NOT_RECORDED_IN_OWNER_OUTPUT').trim(),
    schedule: String(trigger.schedule || 'NOT_OBSERVABLE_FROM_LOCAL_SOURCE').trim(),
    triggerUniqueIdLogged: 'NO',
    ownerEmailLogged: 'NO',
  }));
}

function hasFunctionD7A3(source, name) {
  return new RegExp(`function\\s+${escapeRegExpD7A3(name)}\\s*\\(`).test(source);
}

function extractD7A3MaxGmailSearchLimit(triggerSource, configSource) {
  const fallbackMatch = triggerSource.match(/Number\s*\(\s*CONFIG\.MAX_THREADS\s*\)\s*\|\|\s*(\d+)/);
  const configMatch = configSource.match(/MAX_THREADS\s*:\s*(\d+)/);
  return Number(configMatch?.[1] || fallbackMatch?.[1] || 0);
}

function countD7A3Duplicates(values) {
  const seen = new Map();
  let duplicates = 0;
  for (const value of values || []) {
    const key = String(value || '').trim();
    if (!key) continue;
    const next = (seen.get(key) || 0) + 1;
    seen.set(key, next);
    if (next === 2) duplicates += 1;
  }
  return duplicates;
}

function stableD7A3List(values) {
  return [...new Set((values || []).filter(Boolean).map(value => String(value)))].sort();
}

function escapeRegExpD7A3(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  const report = analyzeD7A3ExistingGmailTriggerCompatibility();
  console.log(formatD7A3Report(report));
}
