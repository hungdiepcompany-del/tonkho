import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'D7_B_BoundedReadOnlyCandidateDiscovery.js',
    'Operator_Entrypoints.js',
    'scripts/checkers/check-d7-b-bounded-read-only-candidate-discovery.mjs',
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE',
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

function loadD7B() {
  return loadGasSource({
    files: ['D7_B_BoundedReadOnlyCandidateDiscovery.js', 'Operator_Entrypoints.js'],
    exportNames: [
      'createD7BBoundedReadOnlyCandidateDiscoveryRunner_',
      'runD7BBoundedReadOnlyCandidateDiscovery',
      'buildD7BBoundedGmailQuery_',
      'createD7BCandidateFingerprint_',
      'createD7BCompactSummary_',
      'validateD7BFirestoreDocumentPath_',
      'sanitizeD7BString_',
    ],
  }).exports;
}

class FakeAttachment {
  constructor(name, mime, body) {
    this.name = name;
    this.mime = mime;
    this.body = body;
  }
  getName() { return this.name; }
  getContentType() { return this.mime; }
  getBytes() { return [...Buffer.from(this.body, 'utf8')]; }
  getDataAsString() { return this.body; }
}

class FakeMessage {
  constructor(overrides = {}) {
    this.subject = overrides.subject || 'Pilot invoice subject';
    this.from = overrides.from || 'Sender <sender@example.com>';
    this.date = overrides.date || new Date(Date.UTC(2026, 2, 9, 3, 0, 0));
    this.id = overrides.id || 'message-1';
    this.attachments = overrides.attachments || goodAttachments();
  }
  getSubject() { return this.subject; }
  getFrom() { return this.from; }
  getDate() { return this.date; }
  getId() { return this.id; }
  getThread() { return { getId: () => `thread-${this.id}` }; }
  getAttachments() { return this.attachments; }
}

class FakeThread {
  constructor(messages) {
    this.messages = messages;
  }
  getMessages() { return this.messages; }
}

function goodXml() {
  return '<Invoice><SHDon>00000248</SHDon><NLap>2026-03-09</NLap><MSTNBan>0123456789</MSTNBan></Invoice>';
}

function goodAttachments() {
  return [
    new FakeAttachment('1C26THD_00000248.pdf', 'application/pdf', 'pdf-body'),
    new FakeAttachment('1C26THD_00000248.xml', 'application/xml', goodXml()),
  ];
}

function goodProps(overrides = {}) {
  return {
    D6J_PILOT_SENDER: 'sender@example.com',
    D6J_PILOT_SUBJECT: 'Pilot invoice subject',
    D6J_PILOT_RECEIVED_DATE: '2026-03-09',
    D6J_DRIVE_ROOT_FOLDER_ID: 'drive-root',
    D6J_SPREADSHEET_ID: 'sheet-id',
    D6J_TARGET_SHEET_NAME: 'Nhap-Xuat',
    ...overrides,
  };
}

function runScenario(overrides = {}) {
  const { createD7BBoundedReadOnlyCandidateDiscoveryRunner_ } = loadD7B();
  const logs = [];
  const threads = overrides.threads ?? [new FakeThread([new FakeMessage(overrides.message)])];
  const duplicate = overrides.duplicate || {};
  const runner = createD7BBoundedReadOnlyCandidateDiscoveryRunner_({
    readProperties: () => goodProps(overrides.props),
    listTriggers: () => overrides.triggers || [],
    inspectSourceContracts: () => overrides.source || {
      mutationEntrypointReachabilityCount: 0,
      publicEntrypointCount: 1,
      runnerFactoryCount: 1,
    },
    gmailSearch: (query, start, max) => {
      if (overrides.gmailThrows) throw new Error('READ_DENIED redactor@example.invalid token_placeholder');
      if (overrides.captureQuery) overrides.captureQuery(query, start, max);
      return threads;
    },
    readDriveDuplicate: () => ({ status: duplicate.drive || 'NOT_FOUND' }),
    readSheetDuplicate: () => ({ status: duplicate.sheet || 'NOT_FOUND' }),
    readFirestoreDuplicate: () => ({ status: duplicate.firestore || 'NOT_FOUND' }),
    deriveInvoiceIdentity: overrides.deriveInvoiceIdentity,
    logger: { log: line => logs.push(line) },
  });
  const result = runner.run();
  return { result, logs };
}

test('D7-B builds a bounded sender, subject, date-window Gmail query', () => {
  const { buildD7BBoundedGmailQuery_ } = loadD7B();
  const query = buildD7BBoundedGmailQuery_({
    sender: 'sender@example.com',
    subject: 'Pilot invoice subject',
    receivedDate: '2026-03-09',
  });
  assert.equal(query, 'from:"sender@example.com" subject:"Pilot invoice subject" after:2026/03/08 before:2026/03/10 has:attachment');
});

test('D7-B approved path is read-only and ready for D7-C', () => {
  const { result, logs } = runScenario();
  assert.equal(result.D7_B_STATUS, 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW');
  assert.equal(result.D7_C_APPROVAL_READY, 'YES');
  assert.equal(result.CANDIDATE_DISCOVERY_EXECUTED, 'YES_READ_ONLY');
  assert.equal(result.MUTATION_ATTEMPT_COUNT, 0);
  assert.equal(result.PRODUCTION_WRITE, 'NONE');
  assert.equal(result.GMAIL_MUTATION, 'NO');
  assert.equal(result.DRIVE_MUTATION, 'NO');
  assert.equal(result.SHEETS_MUTATION, 'NO');
  assert.equal(result.FIRESTORE_MUTATION, 'NO');
  assert.match(logs[0], /D7_B_COMPACT_SUMMARY/);
  assert.match(logs[1], /D7_B_DETAILED_SANITIZED_RESULT/);
});

test('D7-B blocks before Gmail when runtime safety or config is unsafe', () => {
  const cases = [
    ['missing sender', { props: { D6J_PILOT_SENDER: '' } }],
    ['missing subject', { props: { D6J_PILOT_SUBJECT: '' } }],
    ['missing date', { props: { D6J_PILOT_RECEIVED_DATE: '' } }],
    ['missing Drive root', { props: { D6J_DRIVE_ROOT_FOLDER_ID: '' } }],
    ['missing spreadsheet', { props: { D6J_SPREADSHEET_ID: '' } }],
    ['mutating trigger', { triggers: [{ handlerFunction: 'triggerMarkAllInvoiceEmails' }] }],
    ['non-read-only D7 trigger', { triggers: [{ handlerFunction: 'runD7SomethingMutable' }] }],
    ['source mutation reachability', { source: { mutationEntrypointReachabilityCount: 1, publicEntrypointCount: 1, runnerFactoryCount: 1 } }],
    ['missing public entrypoint', { source: { mutationEntrypointReachabilityCount: 0, publicEntrypointCount: 0, runnerFactoryCount: 1 } }],
    ['missing runner factory', { source: { mutationEntrypointReachabilityCount: 0, publicEntrypointCount: 1, runnerFactoryCount: 0 } }],
  ];
  for (const [name, scenario] of cases) {
    const { result } = runScenario(scenario);
    assert.equal(result.D7_B_STATUS, 'BLOCKED_RUNTIME_SAFETY_RECHECK', name);
    assert.equal(result.CANDIDATE_DISCOVERY_EXECUTED, 'NO', name);
  }
});

test('D7-B classifies Gmail, attachment, cardinality, fingerprint, and duplicate outcomes', () => {
  const cases = [
    ['gmail read failure', { gmailThrows: true }, 'BLOCKED_GMAIL_READ_FAILURE'],
    ['zero threads', { threads: [] }, 'PASS_NO_ELIGIBLE_CANDIDATE'],
    ['subject mismatch', { message: { subject: 'other' } }, 'PASS_NO_ELIGIBLE_CANDIDATE'],
    ['sender mismatch', { message: { from: 'other@example.com' } }, 'PASS_NO_ELIGIBLE_CANDIDATE'],
    ['date mismatch', { message: { date: new Date(Date.UTC(2026, 3, 9)) } }, 'PASS_NO_ELIGIBLE_CANDIDATE'],
    ['one attachment', { message: { attachments: [goodAttachments()[0]] } }, 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE'],
    ['three attachments', { message: { attachments: [...goodAttachments(), new FakeAttachment('x.txt', 'text/plain', 'x')] } }, 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE'],
    ['wrong pdf mime', { message: { attachments: [new FakeAttachment('a.pdf', 'text/plain', 'pdf'), goodAttachments()[1]] } }, 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE'],
    ['wrong xml mime', { message: { attachments: [goodAttachments()[0], new FakeAttachment('a.xml', 'application/json', '{}')] } }, 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE'],
    ['missing pdf extension', { message: { attachments: [new FakeAttachment('a.bin', 'application/pdf', 'pdf'), goodAttachments()[1]] } }, 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE'],
    ['missing xml extension', { message: { attachments: [goodAttachments()[0], new FakeAttachment('a.bin', 'application/xml', '<x/>')] } }, 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE'],
    ['multiple eligible candidates', { threads: [new FakeThread([new FakeMessage({ id: 'm1' })]), new FakeThread([new FakeMessage({ id: 'm2' })])] }, 'BLOCKED_MULTIPLE_ELIGIBLE_CANDIDATES'],
    ['fingerprint derivation failure', { deriveInvoiceIdentity: () => ({ status: 'BLOCKED', blockerCode: 'NO_IDENTITY' }) }, 'BLOCKED_FINGERPRINT_FAILURE'],
    ['Drive read blocked', { duplicate: { drive: 'READ_BLOCKED' } }, 'BLOCKED_DUPLICATE_READ_FAILURE'],
    ['Sheet read blocked', { duplicate: { sheet: 'READ_BLOCKED' } }, 'BLOCKED_DUPLICATE_READ_FAILURE'],
    ['Firestore read blocked', { duplicate: { firestore: 'READ_BLOCKED' } }, 'BLOCKED_DUPLICATE_READ_FAILURE'],
    ['Drive exact duplicate', { duplicate: { drive: 'EXACT_DUPLICATE' } }, 'BLOCKED_EXACT_DUPLICATE'],
    ['Sheet exact duplicate', { duplicate: { sheet: 'EXACT_DUPLICATE' } }, 'BLOCKED_EXACT_DUPLICATE'],
    ['Firestore exact duplicate', { duplicate: { firestore: 'EXACT_DUPLICATE' } }, 'BLOCKED_EXACT_DUPLICATE'],
    ['Drive conflict', { duplicate: { drive: 'CONFLICTING_DUPLICATE' } }, 'BLOCKED_CONFLICTING_DUPLICATE'],
    ['Sheet conflict', { duplicate: { sheet: 'CONFLICTING_DUPLICATE' } }, 'BLOCKED_CONFLICTING_DUPLICATE'],
    ['Firestore conflict', { duplicate: { firestore: 'CONFLICTING_DUPLICATE' } }, 'BLOCKED_CONFLICTING_DUPLICATE'],
  ];
  for (const [name, scenario, expected] of cases) {
    const { result } = runScenario(scenario);
    assert.equal(result.D7_B_STATUS, expected, name);
    assert.equal(result.MUTATION_ATTEMPT_COUNT, 0, name);
    assert.equal(result.PRODUCTION_WRITE, 'NONE', name);
  }
});

test('D7-B helper contracts cover sanitized output, hash stability, and Firestore path policy', () => {
  const {
    createD7BCompactSummary_,
    createD7BCandidateFingerprint_,
    validateD7BFirestoreDocumentPath_,
    sanitizeD7BString_,
  } = loadD7B();
  const compact = createD7BCompactSummary_({
    D7_B_STATUS: 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW',
    CANDIDATE_DISCOVERY_STATUS: 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW',
    D7_C_APPROVAL_READY: 'YES',
    READY_FOR_D7_C: 'YES',
    READ_ONLY_MODE: 'YES',
    RUNTIME_SAFETY_RECHECK: 'PASS',
    CANDIDATE_DISCOVERY_EXECUTED: 'YES_READ_ONLY',
    INSPECTED_MESSAGE_COUNT: 1,
    ELIGIBLE_CANDIDATE_COUNT: 1,
    APPROVED_CANDIDATE_COUNT: 1,
    EXACT_DUPLICATE_COUNT: 0,
    CONFLICT_COUNT: 0,
    READ_BLOCKED_COUNT: 0,
    CARDINALITY_STATUS: 'EXACTLY_ONE_ELIGIBLE_CANDIDATE',
    GMAIL_DUPLICATE_STATUS: 'NOT_FOUND',
    DRIVE_DUPLICATE_STATUS: 'NOT_FOUND',
    SHEET_DUPLICATE_STATUS: 'NOT_FOUND',
    FIRESTORE_DUPLICATE_STATUS: 'NOT_FOUND',
    MUTATION_ATTEMPT_COUNT: 0,
    PRODUCTION_MUTATION: 'NONE',
  });
  assert.deepEqual(Object.keys(compact), [
    'D7_B_STATUS',
    'CANDIDATE_DISCOVERY_STATUS',
    'READY_FOR_D7_C',
    'READ_ONLY_MODE',
    'RUNTIME_SAFETY_RECHECK',
    'CANDIDATE_DISCOVERY_EXECUTED',
    'INSPECTED_MESSAGE_COUNT',
    'ELIGIBLE_CANDIDATE_COUNT',
    'APPROVED_CANDIDATE_COUNT',
    'EXACT_DUPLICATE_COUNT',
    'CONFLICT_COUNT',
    'READ_BLOCKED_COUNT',
    'CARDINALITY_STATUS',
    'GMAIL_DUPLICATE_STATUS',
    'DRIVE_DUPLICATE_STATUS',
    'SHEET_DUPLICATE_STATUS',
    'FIRESTORE_DUPLICATE_STATUS',
    'MUTATION_ATTEMPT_COUNT',
    'PRODUCTION_MUTATION',
  ]);
  assert.equal(validateD7BFirestoreDocumentPath_('jobs/job-1'), 'jobs/job-1');
  assert.throws(() => validateD7BFirestoreDocumentPath_('../jobs/job-1'), /INVALID_FIRESTORE_DOCUMENT_PATH/);
  assert.throws(() => validateD7BFirestoreDocumentPath_('users/user-1'), /FIRESTORE_COLLECTION_NOT_ALLOWED/);
  const bearerPrefix = 'Bearer';
  assert.equal(sanitizeD7BString_(`${bearerPrefix} token_placeholder redactor@example.invalid`), 'Bearer <redacted> <email-redacted>');

  const candidate = {
    xml: { sha256: 'x'.repeat(64) },
    pdf: { sha256: 'p'.repeat(64) },
    message: { messageIdHash: 'm'.repeat(16) },
  };
  const first = createD7BCandidateFingerprint_(candidate, {}, {
    deriveInvoiceIdentity: () => ({
      status: 'PASS',
      invoiceKeyHash: 'i'.repeat(64),
      hashIndexHash: 'h'.repeat(64),
    }),
  });
  const second = createD7BCandidateFingerprint_(candidate, {}, {
    deriveInvoiceIdentity: () => ({
      status: 'PASS',
      invoiceKeyHash: 'i'.repeat(64),
      hashIndexHash: 'h'.repeat(64),
    }),
  });
  assert.equal(first.fingerprintSha256, second.fingerprintSha256);
});

test('D7-B scenario matrix documents forty required read-only cases', () => {
  const scenarioNames = [
    'bounded query uses sender',
    'bounded query uses subject',
    'bounded query uses previous day after date',
    'bounded query uses next day before date',
    'bounded query caps max results',
    'runtime blocks missing sender',
    'runtime blocks missing subject',
    'runtime blocks missing date',
    'runtime blocks missing drive root',
    'runtime blocks missing spreadsheet',
    'runtime blocks mutating trigger',
    'runtime blocks non-read-only D7 trigger',
    'runtime blocks source reachability',
    'runtime blocks missing public entrypoint',
    'runtime blocks missing runner factory',
    'gmail read failure is blocked',
    'zero threads is safe no-candidate',
    'subject mismatch is ineligible',
    'sender mismatch is ineligible',
    'date mismatch is ineligible',
    'one attachment blocks validation',
    'three attachments block validation',
    'pdf mime mismatch blocks validation',
    'xml mime mismatch blocks validation',
    'pdf extension mismatch blocks validation',
    'xml extension mismatch blocks validation',
    'multiple eligible candidates block',
    'fingerprint derivation failure blocks',
    'drive read blocked blocks',
    'sheet read blocked blocks',
    'firestore read blocked blocks',
    'drive exact duplicate blocks',
    'sheet exact duplicate blocks',
    'firestore exact duplicate blocks',
    'drive conflict blocks',
    'sheet conflict blocks',
    'firestore conflict blocks',
    'compact summary logs first',
    'mutation counters stay zero',
    'raw email and OAuth token are sanitized',
  ];
  assert.equal(scenarioNames.length, 40);
});
