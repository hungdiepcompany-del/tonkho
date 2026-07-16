import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const docPath = 'docs/phases/SGDS_CRIT_003_D5N_DEDICATED_FIRESTORE_IDENTITY.md';
const runnerPath = 'scripts/production/run-sgds-crit-003-d5n-runtime-identity-smoke.mjs';
const packageJson = JSON.parse(read('package.json'));
const doc = read(docPath);
const runner = read(runnerPath);

function requireMarker(text, marker, label) {
  assert.match(text, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} missing marker: ${marker}`);
}

for (const marker of [
  'SGDS_D5N_IDENTITY_STATUS=PASS_DEDICATED_KEYLESS_LEAST_PRIVILEGE_IDENTITY',
  'D5N_A_PREFLIGHT=PASS',
  'D5N_B_PERMISSION_DERIVATION=PASS',
  'D5N_C_SA=PASS_CREATED',
  'D5N_D_CUSTOM_ROLE=PASS_CREATED',
  'D5N_E_IAM_BINDINGS=PASS',
  'D5N_F_KEYLESS_READ=PASS',
  'D5N_G_IDENTITY_WRITE=PASS',
  'D5N_H_IDEMPOTENCY_REPLAY=PASS',
  'D5N_I_NEGATIVE_PERMISSIONS=PASS',
  'SA_ID=sgds-firestore-runtime',
  'SA_EMAIL=sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com',
  'SA_CREATED=YES',
  'SA_DISABLED=NO',
  'USER_MANAGED_KEY_COUNT=0',
  'LONG_LIVED_CREDENTIAL_CREATED=NO',
  'KEYLESS_AUTH=PASS',
  'CUSTOM_ROLE_NAME=projects/tonkhohd/roles/sgdsFirestoreRuntime',
  'CUSTOM_ROLE_STAGE=GA',
  'CUSTOM_ROLE_WILDCARD_COUNT=0',
  'DELETE_PERMISSION_INCLUDED=NO',
  'ADMIN_PERMISSION_COUNT=0',
  'DATASTORE_USER_FALLBACK_GRANTED=NO',
  'OWNER_ROLE_GRANTED_TO_RUNTIME=NO',
  'EDITOR_ROLE_GRANTED_TO_RUNTIME=NO',
  'TOKEN_CREATOR_SCOPE=SA_RESOURCE_ONLY',
  'PROJECT_WIDE_TOKEN_CREATOR_BINDING=NO',
  'ACTUAL_READ_PRINCIPAL=sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com',
  'ACTUAL_WRITE_PRINCIPAL=sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com',
  'OWNER_USED_AS_DATA_PRINCIPAL=NO',
  'TOKEN_MATERIAL_LOGGED=NO',
  'SYNTHETIC_CASE_ID=EXACT_OWNER_APPROVED_D5N_IDENTITY_SMOKE_CASE',
  'SYNTHETIC_JOB_ID=sgds-d5n-runtime-identity-smoke-v1',
  'INITIAL_JOB_COUNT=1',
  'JOB_COUNT_AFTER_REPLAY=1',
  'DUPLICATE_JOB_COUNT=0',
  'IDEMPOTENCY=PASS',
  'FIRESTORE_DOCUMENTS_CREATED=6',
  'FIRESTORE_DOCUMENTS_UPDATED=1',
  'FIRESTORE_DOCUMENTS_DELETED=0',
  'REAL_FIRESTORE_DOCUMENTS_MUTATED=0',
  'GOOGLE_SHEETS_MUTATION=NONE',
  'GMAIL_MESSAGE_MUTATION=NONE',
  'GMAIL_LABEL_MUTATION=NONE',
  'GOOGLE_DRIVE_MUTATION=NONE',
  'DELETE_PERMISSION=DENIED',
  'DATABASE_ADMIN_PERMISSION=DENIED',
  'INDEX_ADMIN_PERMISSION=DENIED',
  'RULES_ADMIN_PERMISSION=DENIED',
  'IAM_ADMIN_PERMISSION=DENIED',
  'KEY_CREATION_PERMISSION=DENIED',
  'NEGATIVE_PERMISSION_ALLOWED_COUNT=0',
  'REVIEWED_PERMISSION_ALLOWED_COUNT=7',
  'CLOUD_RUN_DEPLOY=NOT_RUN',
  'CLOUD_FUNCTIONS_DEPLOY=NOT_RUN',
  'GAS_DEPLOY=NOT_RUN',
  'FIREBASE_DEPLOY=NOT_RUN',
  'HOSTED_RUNTIME_READY=NO_NOT_DEPLOYED',
  'SGDS_CRIT_003_STATUS=PARTIALLY_CLOSED_RUNTIME_HOSTING_PENDING',
  'NEXT_ALLOWED_ACTION=CLOUD_RUN_DURABLE_ORCHESTRATOR_BUILD_AND_DEPLOY_REVIEW'
]) {
  requireMarker(doc, marker, docPath);
}

for (const permission of [
  'datastore.databases.get',
  'datastore.databases.getMetadata',
  'datastore.entities.get',
  'datastore.entities.list',
  'datastore.entities.create',
  'datastore.entities.update',
  'resourcemanager.projects.get'
]) {
  requireMarker(doc, permission, docPath);
}

for (const forbidden of [
  'datastore.entities.delete',
  'datastore.databases.create',
  'datastore.databases.delete',
  'datastore.indexes.create',
  'firebaserules.rulesets.create',
  'resourcemanager.projects.setIamPolicy',
  ['service', 'account'].join('_'),
  ['private', 'key'].join('_'),
  ['BEGIN', 'PRIVATE', 'KEY'].join(' '),
  ['ya29', '.'].join(''),
  `refresh_${'token'}`
]) {
  assert.equal(doc.includes(forbidden), false, `D5N doc contains forbidden token: ${forbidden}`);
}

for (const marker of [
  'D5N_OWNER_APPROVAL',
  'D5N_RUNTIME_PRINCIPAL',
  'D5N_SYNTHETIC_CASE_ID',
  'D5N_SYNTHETIC_JOB_ID',
  'D5N_EXISTING_D5J_JOB_ID',
  '--impersonate-service-account=',
  'tokenMaterialLogged',
  'firestoreDocumentsDeleted'
]) {
  requireMarker(runner, marker, runnerPath);
}

for (const forbidden of [
  'recursiveDelete',
  "'DELETE'",
  '"DELETE"',
  'collectionGroup',
  ':runQuery',
  'firebase deploy',
  'clasp push',
  'gcloud run deploy'
]) {
  assert.equal(runner.includes(forbidden), false, `D5N runner contains forbidden operation: ${forbidden}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5n'],
  'node scripts/checkers/check-sgds-crit-003-d5n-runtime-identity.mjs',
  'package command check:sgds-crit-003-d5n missing or changed'
);

assert.equal(
  packageJson.scripts['check:sgds-d5m-d5r'],
  'node scripts/checkers/check-sgds-crit-003-d5m-d5r-runtime-identity-shadow.mjs',
  'package alias check:sgds-d5m-d5r missing or changed'
);

console.log('SGDS_CRIT_003_D5N_CHECK=PASS');
