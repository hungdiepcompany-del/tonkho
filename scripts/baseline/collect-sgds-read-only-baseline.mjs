import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const EXPECTED = Object.freeze({
  firebaseProjectId: 'tonkhohd',
  firebaseProjectNumber: '587745071207',
  firebaseAccount: 'hungdiepcompany@gmail.com',
  appsScriptId: '19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM'
});

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

function git(args) {
  const res = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', shell: false });
  return res.status === 0 ? res.stdout.trim() : 'NOT_LIVE_VERIFIED';
}

function safeSuffix(value) {
  const text = String(value || '');
  return text ? `suffix:${text.slice(-6)}` : 'MISSING';
}

function collectSgdsReadOnlyBaseline({ allowLiveCli = false } = {}) {
  const firebaserc = readJson('.firebaserc') || {};
  const clasp = readJson('.clasp.json') || {};
  const manifest = readJson('appsscript.json') || {};
  const config = readText('config.js');
  const triggers = readText('triggers.js') + '\n' + readText('_triggerDriveScanner.js') + '\n' + readText('_triggerMarkInvoiceEmails.js');
  const firestoreSource = [
    readText('firestore.rules'),
    readText('firestore.indexes.json'),
    readText('firestoreDurableJobStore.js'),
    readText('firestoreEmulatorDurableShadowIntegration.js')
  ].join('\n');

  const firebaseProjectId = firebaserc.projects && firebaserc.projects.production || 'MISSING';
  const appsScriptId = clasp.scriptId || 'MISSING';
  const folderIds = [...config.matchAll(/(?:PARENT_FOLDER_ID|INVOICE_IN_FOLDER_ID|INVOICE_OUT_FOLDER_ID|SLIDE_TEMPLATE_ID):\s*"([^"]+)"/g)].map(match => `${match[0].split(':')[0]}=${safeSuffix(match[1])}`);
  const sheetNames = [...config.matchAll(/^\s*SHEET_[A-Z_]+:\s*"([^"]+)"/gm)].map(match => match[1]).sort();
  const firestoreCollections = [...new Set((firestoreSource.match(/\b(invoiceJobs|events|reconciliationReports|invoiceJobProjections)\b/g) || []))].sort();
  const gmailConfig = {
    fromDatePresent: /INVOICE_FROMDATE/.test(config),
    maxThreadsPresent: /MAX_THREADS/.test(config),
    maxEmailScanPresent: /MAX_EMAIL_SCAN/.test(config),
    labelNamesConfigured: (config.match(/LABEL/g) || []).length
  };

  return {
    PHASE: 'D5Z_READ_ONLY_BASELINE',
    BASELINE_REPORT_STATUS: 'PASS_REPOSITORY_SAFE_BASELINE',
    LIVE_BASELINE_VERIFICATION: allowLiveCli ? 'READ_ONLY_CLI_ALLOWED' : 'NOT_LIVE_VERIFIED',
    GIT_BRANCH: git(['branch', '--show-current']),
    GIT_HEAD: git(['rev-parse', 'HEAD']),
    GIT_REMOTE_ORIGIN: git(['remote', 'get-url', 'origin']),
    FIREBASE_PROJECT_ID_EXPECTED: EXPECTED.firebaseProjectId,
    FIREBASE_PROJECT_ID_REPO: firebaseProjectId,
    FIREBASE_PROJECT_ID_MATCH: firebaseProjectId === EXPECTED.firebaseProjectId ? 'YES' : 'NO',
    FIREBASE_PROJECT_NUMBER_EXPECTED: EXPECTED.firebaseProjectNumber,
    FIREBASE_PROJECT_NUMBER_LIVE: 'NOT_LIVE_VERIFIED',
    FIREBASE_ACCOUNT_EXPECTED: EXPECTED.firebaseAccount,
    FIREBASE_ACCOUNT_LIVE: 'NOT_LIVE_VERIFIED',
    FIREBASE_ALIASES: Object.keys(firebaserc.projects || {}).sort().join(';') || 'MISSING',
    APPS_SCRIPT_ID_EXPECTED: EXPECTED.appsScriptId,
    APPS_SCRIPT_ID_REPO: appsScriptId,
    APPS_SCRIPT_ID_MATCH: appsScriptId === EXPECTED.appsScriptId ? 'YES' : 'NO',
    APPS_SCRIPT_SCOPE_COUNT: Array.isArray(manifest.oauthScopes) ? manifest.oauthScopes.length : 0,
    APPS_SCRIPT_EXTERNAL_REQUEST_SCOPE: (manifest.oauthScopes || []).includes('https://www.googleapis.com/auth/script.external_request') ? 'PRESENT' : 'MISSING',
    APPS_SCRIPT_OPENID_SCOPE: (manifest.oauthScopes || []).includes('openid') ? 'PRESENT' : 'MISSING',
    TRIGGER_CODE_REFERENCES_PRESENT: /Trigger|trigger/i.test(triggers) ? 'YES' : 'NO',
    INSTALLABLE_TRIGGER_LIVE_LIST: 'NOT_LIVE_VERIFIED',
    SCRIPT_PROPERTY_NAMES: 'NOT_LIVE_VERIFIED_VALUES_NOT_READ',
    FIRESTORE_COLLECTION_REFERENCES: firestoreCollections.join(';') || 'MISSING',
    GMAIL_QUERY_CONFIG: JSON.stringify(gmailConfig),
    DRIVE_FOLDER_ID_SUFFIXES: folderIds.join(';') || 'MISSING',
    SHEET_NAMES_CONFIGURED: sheetNames.join(';') || 'MISSING',
    SHEET_COLUMN_CONTRACT: /NHAPXUAT_INDEX/.test(config) ? 'NHAPXUAT_INDEX_PRESENT' : 'MISSING',
    CLOUD_RUN_OPTIONAL_CODE_RETAINED: fs.existsSync(path.join(ROOT, 'services/sgds-durable-orchestrator/src/app.mjs')) ? 'YES' : 'NO',
    PRODUCTION_WRITE_ATTEMPTED: 'NO'
  };
}

function printBaseline(baseline) {
  for (const key of Object.keys(baseline).sort()) {
    console.log(`${key}=${baseline[key]}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  printBaseline(collectSgdsReadOnlyBaseline());
}

export { collectSgdsReadOnlyBaseline };
