import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const audit = read('D7_OperationalReadinessAudit.js');
const operator = read('Operator_Entrypoints.js');

function fail(code) {
  console.error(`D7_A_OPERATIONAL_AUTOMATION_READINESS_READ_ONLY_AUDIT_CHECK=FAIL`);
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function assertIncludes(text, pattern, code) {
  if (typeof pattern === 'string') {
    if (!text.includes(pattern)) fail(code);
  } else if (!pattern.test(text)) {
    fail(code);
  }
}

assertIncludes(operator, /function\s+runD7AOperationalAutomationReadinessReadOnly\s*\(\)\s*\{[\s\S]*createD7AOperationalAutomationReadinessAuditRunner_\s*\(/, 'ENTRYPOINT_OR_DELEGATION_MISSING');
assertIncludes(audit, /function\s+createD7AOperationalAutomationReadinessAuditRunner_\s*\(/, 'INTERNAL_RUNNER_MISSING');

const forbiddenDirectCalls = [
  /GmailApp\.(?:addLabel|removeLabel|markRead|markUnread|moveTo|trash)/,
  /DriveApp\.(?:createFile|makeCopy|setName|setTrashed|removeFile|addFile)/,
  /\.(?:setValue|setValues|appendRow|insertRow|deleteRow|clear)\s*\(/,
  /PropertiesService[\s\S]{0,120}\.(?:setProperty|deleteProperty)\s*\(/,
  /ScriptApp\.(?:newTrigger|deleteTrigger)\s*\(/,
  /UrlFetchApp\.fetch[\s\S]{0,220}method\s*:\s*['"](?:post|put|patch|delete)['"]/i,
  /\b(?:createDocument|patchDocument|deleteDocument|appendDocument|updateDocument)\s*\(/
];
for (const pattern of forbiddenDirectCalls) {
  if (pattern.test(audit)) fail('MUTATION_METHOD_REACHABLE_FROM_AUDIT_SOURCE');
}

const forbiddenEntrypointCalls = [
  'runD6jCOneRecordProductionMutation',
  'runD6jDRepairSingleMalformedPilotRow',
  'runD6jD4CFirestoreEvidenceDiagnosticsReadOnly',
  'runD6jD4DReconciliationPreviewReadOnly',
  'runD6jD4DRecordPostHocReconciliationEvidenceOnce',
  'runD6jD4PostRepairVerificationReadOnly',
  'runD6jBProductionDryRunReadOnly',
  'runD6jDInspectMalformedPilotRowReadOnly'
];
for (const name of forbiddenEntrypointCalls) {
  const callPattern = new RegExp(`${name}\\s*\\(`);
  if (callPattern.test(audit)) fail(`FORBIDDEN_ENTRYPOINT_CALL_${name}`);
}

assertIncludes(audit, 'D7_A_KILL_SWITCH_PROPERTY_', 'KILL_SWITCH_CONTRACT_MISSING');
assertIncludes(audit, 'AUTOMATION_CURRENTLY_ENABLED', 'AUTOMATION_ENABLEMENT_AUDIT_MISSING');
assertIncludes(audit, 'UNKNOWN', 'UNKNOWN_STATE_NOT_REPRESENTED');
assertIncludes(audit, /READINESS_GAP_COUNT\s*===\s*0[\s\S]*PASS_READY_FOR_D7_B_READ_ONLY_CANDIDATE_DISCOVERY/, 'UNKNOWN_OR_GAP_CAN_PASS');
assertIncludes(audit, 'GMAIL_MUTATION_REACHABLE: \'NO\'', 'GMAIL_MUTATION_BOUNDARY_MISSING');
assertIncludes(audit, 'DRIVE_WRITE_ACCESS_NOT_PROBED: \'YES\'', 'DRIVE_WRITE_PROBE_BOUNDARY_MISSING');
assertIncludes(audit, 'SHEET_WRITE_EXECUTED: \'NO\'', 'SHEET_WRITE_BOUNDARY_MISSING');
assertIncludes(audit, 'FIRESTORE_WRITE_PROBE_EXECUTED: \'NO\'', 'FIRESTORE_WRITE_PROBE_BOUNDARY_MISSING');
assertIncludes(audit, 'TRIGGER_MUTATION_COUNT: 0', 'TRIGGER_MUTATION_COUNTER_MISSING');
assertIncludes(audit, 'CANDIDATE_DISCOVERY_EXECUTED: \'NO\'', 'CANDIDATE_DISCOVERY_BOUNDARY_MISSING');
assertIncludes(audit, 'logD7ASanitizedResult_', 'SANITIZED_LOGGING_MISSING');
assertIncludes(audit, 'SECRET_VALUE_LOG_COUNT: 0', 'SECRET_LOG_COUNTER_MISSING');
assertIncludes(audit, 'DURABLE_JOB_COLLECTION: \'invoiceJobs\'', 'DURABLE_JOB_COLLECTION_NOT_CANONICAL');
assertIncludes(audit, 'LEGACY_JOB_COLLECTION_USED_FOR_RUNTIME', 'LEGACY_COLLECTION_DECISION_MISSING');
assertIncludes(audit, 'FROZEN_D6J_MUTATION_REACHABILITY_COUNT: 0', 'FROZEN_D6J_REACHABILITY_GUARD_MISSING');

console.log('D7_A_OPERATIONAL_AUTOMATION_READINESS_READ_ONLY_AUDIT_CHECK=PASS');
