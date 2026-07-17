import {
  SGDS_DATABASE_ID,
  SGDS_MAX_CANDIDATES,
  SGDS_PROJECT_ID,
  SGDS_RUNTIME_ENV,
  SGDS_RUNTIME_MODE,
  SGDS_RUNTIME_PRINCIPAL
} from './constants.mjs';
import { sgdsError } from './errors.mjs';
import { safeString } from './json.mjs';

export function loadRuntimeConfig(env = process.env) {
  const config = {
    runtimeEnv: safeString(env.SGDS_RUNTIME_ENV),
    runtimeMode: safeString(env.SGDS_RUNTIME_MODE),
    projectId: safeString(env.SGDS_FIRESTORE_PROJECT_ID),
    databaseId: safeString(env.SGDS_FIRESTORE_DATABASE_ID),
    expectedRuntimePrincipal: safeString(env.SGDS_EXPECTED_RUNTIME_PRINCIPAL),
    maxCandidates: Number(env.SGDS_MAX_CANDIDATES_PER_REQUEST),
    canonicalWritesEnabled: parseBool(env.SGDS_CANONICAL_WRITES_ENABLED),
    gmailMutationsEnabled: parseBool(env.SGDS_GMAIL_MUTATIONS_ENABLED),
    driveMutationsEnabled: parseBool(env.SGDS_DRIVE_MUTATIONS_ENABLED),
    sheetsMutationsEnabled: parseBool(env.SGDS_SHEETS_MUTATIONS_ENABLED),
    allowedCallerEmails: parseList(env.SGDS_ALLOWED_CALLER_EMAILS),
    allowedCallerAudiences: parseList(env.SGDS_ALLOWED_CALLER_AUDIENCES),
    firestoreReadinessReadEnabled: parseBool(env.SGDS_FIRESTORE_READINESS_READ_ENABLED)
  };
  validateRuntimeConfig(config, env);
  return Object.freeze(config);
}

export function testRuntimeConfig(overrides = {}) {
  return loadRuntimeConfig({
    SGDS_RUNTIME_ENV,
    SGDS_RUNTIME_MODE,
    SGDS_FIRESTORE_PROJECT_ID: SGDS_PROJECT_ID,
    SGDS_FIRESTORE_DATABASE_ID: SGDS_DATABASE_ID,
    SGDS_EXPECTED_RUNTIME_PRINCIPAL: SGDS_RUNTIME_PRINCIPAL,
    SGDS_MAX_CANDIDATES_PER_REQUEST: String(SGDS_MAX_CANDIDATES),
    SGDS_CANONICAL_WRITES_ENABLED: 'false',
    SGDS_GMAIL_MUTATIONS_ENABLED: 'false',
    SGDS_DRIVE_MUTATIONS_ENABLED: 'false',
    SGDS_SHEETS_MUTATIONS_ENABLED: 'false',
    SGDS_ALLOWED_CALLER_EMAILS: 'hungdiepcompany@gmail.com',
    SGDS_ALLOWED_CALLER_AUDIENCES: 'https://sgds-durable-orchestrator.local',
    ...overrides
  });
}

export function validateRuntimeConfig(config, env = process.env) {
  if (config.runtimeEnv !== SGDS_RUNTIME_ENV) throw sgdsError('BLOCKED_RUNTIME_ENV_INVALID', 500);
  if (config.runtimeMode !== SGDS_RUNTIME_MODE) throw sgdsError('BLOCKED_RUNTIME_MODE_INVALID', 500);
  if (config.projectId !== SGDS_PROJECT_ID) throw sgdsError('BLOCKED_PROJECT_ID_INVALID', 500);
  if (config.databaseId !== SGDS_DATABASE_ID) throw sgdsError('BLOCKED_DATABASE_ID_INVALID', 500);
  if (config.expectedRuntimePrincipal !== SGDS_RUNTIME_PRINCIPAL) throw sgdsError('BLOCKED_EXPECTED_RUNTIME_PRINCIPAL_INVALID', 500);
  if (config.maxCandidates !== SGDS_MAX_CANDIDATES) throw sgdsError('BLOCKED_MAX_CANDIDATES_INVALID', 500);
  if (config.canonicalWritesEnabled) throw sgdsError('BLOCKED_CANONICAL_WRITES_ENABLED', 500);
  if (config.gmailMutationsEnabled) throw sgdsError('BLOCKED_GMAIL_MUTATIONS_ENABLED', 500);
  if (config.driveMutationsEnabled) throw sgdsError('BLOCKED_DRIVE_MUTATIONS_ENABLED', 500);
  if (config.sheetsMutationsEnabled) throw sgdsError('BLOCKED_SHEETS_MUTATIONS_ENABLED', 500);
  if (env.GOOGLE_APPLICATION_CREDENTIALS) throw sgdsError('BLOCKED_KEY_FILE_MODE_FOUND', 500);
  return true;
}

function parseBool(value) {
  return safeString(value).toLowerCase() === 'true';
}

function parseList(value) {
  return safeString(value).split(',').map(part => part.trim()).filter(Boolean);
}
