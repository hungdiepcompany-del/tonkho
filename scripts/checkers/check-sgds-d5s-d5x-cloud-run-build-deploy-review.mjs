import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const docPath = 'docs/phases/SGDS_D5S_D5X_CLOUD_RUN_BUILD_DEPLOY_REVIEW.md';
const serviceFiles = [
  'services/sgds-durable-orchestrator/src/app.mjs',
  'services/sgds-durable-orchestrator/src/server.mjs',
  'services/sgds-durable-orchestrator/src/constants.mjs',
  'services/sgds-durable-orchestrator/src/durable-shadow.mjs',
  'services/sgds-durable-orchestrator/src/auth.mjs',
  'services/sgds-durable-orchestrator/src/config.mjs',
  'services/sgds-durable-orchestrator/src/principal.mjs'
];
const serviceTest = 'services/sgds-durable-orchestrator/test/service-contract.test.mjs';
const httpTest = 'services/sgds-durable-orchestrator/test/http-smoke.test.mjs';
const dockerfilePath = 'services/sgds-durable-orchestrator/Dockerfile';
const callerPath = 'cloudRunShadowCaller.js';
const callerTestPath = 'tests/unit/cloud-run-shadow-caller.test.mjs';
const deployPlanPath = 'deploy/cloud-run/SGDS_D5S_D5X_DEPLOY_PLAN_REVIEW.md';
const packageJson = JSON.parse(read('package.json'));

for (const file of [docPath, serviceTest, httpTest, dockerfilePath, '.dockerignore', '.gcloudignore', callerPath, callerTestPath, deployPlanPath, ...serviceFiles]) {
  assert.equal(exists(file), true, `missing D5S-D5X file: ${file}`);
}

const doc = read(docPath);
const service = serviceFiles.map(read).join('\n');
const dockerfile = read(dockerfilePath);
const dockerignore = read('.dockerignore');
const gcloudignore = read('.gcloudignore');
const caller = read(callerPath);
const deployPlan = read(deployPlanPath);

function requireText(text, marker, label) {
  assert.equal(text.includes(marker), true, `${label} missing marker: ${marker}`);
}

for (const marker of [
  'SGDS_CLOUD_RUN_BUILD_DEPLOY_REVIEW_STATUS=PARTIAL_PASS_LOCAL_IMPLEMENTATION_VALIDATED_INFRASTRUCTURE_BLOCKED',
  'D5S_A_PREFLIGHT=PASS',
  'D5S_B_SERVICE_CONTRACT=PASS',
  'D5T_A_SERVICE_IMPLEMENTATION=PASS',
  'D5T_B_AUTH_PRINCIPAL_BOUNDARY=PASS_LOCAL_DESIGN',
  'D5T_C_FIRESTORE_INTEGRATION=PASS_EMULATOR',
  'D5U_A_CONTAINER_HARDENING=PASS_STATIC',
  'D5U_B_LOCAL_CONTAINER_BUILD=BLOCKED_DOCKER_UNAVAILABLE',
  'D5V_A_BILLING_API_RESOURCE_INSPECTION=BLOCKED_BILLING_AND_REQUIRED_APIS',
  'D5V_C_DEPLOYMENT_PLAN=PASS_NOT_EXECUTED',
  'D5W_A_APPS_SCRIPT_AUTH_DESIGN=PASS',
  'D5W_B_APPS_SCRIPT_LOCAL_WIRING=PASS',
  'BILLING_ENABLED=NO',
  'RUN_API=DISABLED',
  'ARTIFACT_REGISTRY_API=DISABLED',
  'CLOUD_BUILD_API=DISABLED',
  'IAM_CREDENTIALS_API=DISABLED',
  'DOCKER_CLI_AVAILABLE=NO',
  'CLOUD_RUN_DEPLOY=NOT_RUN_APPROVAL_AND_INFRASTRUCTURE_PREREQUISITES_MISSING',
  'PRODUCTION_HTTP_CALL_COUNT=0',
  'PRODUCTION_FIRESTORE_MUTATION=NONE',
  'NEXT_ALLOWED_ACTION=OWNER_ENABLE_BILLING_AND_REQUIRED_CLOUD_RUN_BUILD_APIS_OR_INSTALL_DOCKER_FOR_LOCAL_CONTAINER_VALIDATION'
]) {
  requireText(doc, marker, docPath);
}

for (const marker of [
  'sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com',
  'SGDS_MAX_CANDIDATES = 1',
  'SGDS_CANONICAL_WRITES_ENABLED',
  'SGDS_GMAIL_MUTATIONS_ENABLED',
  'SGDS_DRIVE_MUTATIONS_ENABLED',
  'SGDS_SHEETS_MUTATIONS_ENABLED',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'createMetadataAccessTokenProvider',
  'createMetadataPrincipalInspector',
  'GET',
  '/healthz',
  '/readyz',
  '/v1/shadow/plan',
  '/v1/shadow/submit'
]) {
  requireText(service, marker, 'Cloud Run service source');
}

for (const forbidden of [
  'execFileSync',
  'gcloud.cmd',
  'firebase deploy',
  'clasp push',
  'GmailApp',
  'DriveApp',
  'SpreadsheetApp',
  'recursiveDelete',
  '"DELETE"',
  "'DELETE'"
]) {
  assert.equal(service.includes(forbidden), false, `Cloud Run service contains forbidden runtime dependency: ${forbidden}`);
}

requireText(dockerfile, 'FROM node:22-bookworm-slim', dockerfilePath);
requireText(dockerfile, 'RUN npm ci --omit=dev', dockerfilePath);
requireText(dockerfile, 'USER node', dockerfilePath);
requireText(dockerfile, 'ENV PORT=8080', dockerfilePath);
requireText(dockerfile, 'COPY services/sgds-durable-orchestrator/src ./src', dockerfilePath);
assert.equal(dockerfile.includes('gcloud'), false, 'Dockerfile must not install gcloud');
assert.equal(dockerfile.includes('firebase'), false, 'Dockerfile must not install Firebase CLI');
assert.equal(dockerfile.includes('clasp'), false, 'Dockerfile must not install clasp');

for (const marker of ['.git', '.clasp.json', '.env', '*.key', '*.pem', '*.p12', 'artifacts', 'docs', 'tests', 'fixtures', 'node_modules', '*.xlsx']) {
  requireText(dockerignore, marker, '.dockerignore');
}
for (const marker of ['.git', '.clasp.json', '.env', '*.key', '*.pem', '*.p12', 'artifacts/**', 'docs/**', 'tests/**', 'fixtures/**', 'node_modules/**', '*.xlsx']) {
  requireText(gcloudignore, marker, '.gcloudignore');
}

for (const marker of [
  'SGDS_CLOUD_RUN_SHADOW_FEATURE_DEFAULT_ = false',
  'SGDS_CLOUD_RUN_SHADOW_MAX_CANDIDATES_ = 1',
  'ScriptApp.getIdentityToken',
  'UrlFetchApp.fetch',
  'muteHttpExceptions: true',
  'canonicalWriteAllowed: false',
  'gmailMutationAllowed: false',
  'driveMutationAllowed: false',
  'sheetsMutationAllowed: false'
]) {
  requireText(caller, marker, callerPath);
}

for (const forbidden of [
  'getOAuthToken',
  'API_KEY',
  'Bearer <',
  ['private', 'key'].join('_'),
  ['refresh', 'token'].join('_'),
  ['client', 'secret'].join('_'),
  ['BEGIN', 'PRIVATE', 'KEY'].join(' ')
]) {
  assert.equal((caller + service + doc + deployPlan).includes(forbidden), false, `forbidden secret/deploy token marker present: ${forbidden}`);
}

for (const forbidden of [
  'gcloud.cmd run deploy',
  'gcloud.cmd builds submit',
  'gcloud.cmd services enable',
  'allUsers',
  '--allow-unauthenticated'
]) {
  assert.equal(service.includes(forbidden), false, `runtime service must not contain deploy command: ${forbidden}`);
}
requireText(deployPlan, 'PLAN_MODE=REVIEW_ONLY', deployPlanPath);
requireText(deployPlan, 'DEPLOY_EXECUTED=NO', deployPlanPath);
requireText(deployPlan, '--no-allow-unauthenticated', deployPlanPath);

assert.equal(
  packageJson.scripts['test:sgds-cloud-run-service'],
  'node --test "services/sgds-durable-orchestrator/test/**/*.test.mjs"',
  'missing service test script'
);
assert.equal(
  packageJson.scripts['check:sgds-d5s-d5x'],
  'node scripts/checkers/check-sgds-d5s-d5x-cloud-run-build-deploy-review.mjs',
  'missing D5S-D5X checker alias'
);
assert.equal(
  packageJson.scripts['check:sgds-cloud-run-build-deploy-review'],
  'node scripts/checkers/check-sgds-d5s-d5x-cloud-run-build-deploy-review.mjs',
  'missing requested D5S-D5X checker script'
);

console.log('SGDS_D5S_D5X_CLOUD_RUN_BUILD_DEPLOY_REVIEW_CHECK=PASS');
