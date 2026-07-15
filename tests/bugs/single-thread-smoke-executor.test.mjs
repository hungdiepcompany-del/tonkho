import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['bundleCSingleThreadSmoke.js', 'hashUtils.js', 'gmailProcessInvoiceXML.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE',
});

const FILES = [
  'config.js',
  'utils.js',
  'normalization.js',
  'stats.js',
  'EmailDedupService.js',
  'gmailCollection.js',
  'gmailLabels.js',
  'xmlParser.js',
  'gmailProcessInvoiceXML.js',
  'sheetHoaDon.js',
  'driveUtils.js',
  'pdfParser.js',
  'hashUtils.js',
  'bundleCSingleThreadSmoke.js',
];

const validXml = fs.readFileSync('fixtures/xml/valid-invoice-in.xml', 'utf8');
const adjustmentXml = fs.readFileSync('fixtures/xml/adjustment-invoice-draft.xml', 'utf8');
const replacementXml = fs.readFileSync('fixtures/xml/replacement-invoice-draft.xml', 'utf8');
const multiLineXml = fs.readFileSync('fixtures/xml/valid-multiple-lines.xml', 'utf8');

function blob(name, text) {
  return {
    name,
    getName() { return this.name; },
    getDataAsString() { return text; },
    copyBlob() { return blob(this.name, text); },
    setName(next) { this.name = next; return this; },
  };
}

function iterator(items) {
  let i = 0;
  return { hasNext: () => i < items.length, next: () => items[i++] };
}

function thread({ id = 'thread_real_value_should_not_leak', attachments = [blob('invoice.xml', validXml)], body = '' } = {}) {
  return {
    labels: [],
    getId: () => id,
    addLabel(label) { this.labels.push(label); },
    removeLabel(label) { this.labels = this.labels.filter(x => x !== label); },
    getMessages: () => [{
      getBody: () => body,
      getAttachments: () => attachments,
    }],
  };
}

function makeSheet(rows = [['invoiceKey', 'XML_id', 'XML_status', 'PDF_id', 'PDF_status']]) {
  return {
    rows,
    getLastRow() { return rows.length; },
    getDataRange() { return { getValues: () => rows }; },
    getRange(row, col, numRows = 1, numCols = 1) {
      return {
        getValues: () => {
          const out = [];
          for (let r = 0; r < numRows; r++) {
            const source = rows[row - 1 + r] || [];
            out.push(source.slice(col - 1, col - 1 + numCols));
          }
          return out;
        },
      };
    },
  };
}

function makeHarness(options = {}) {
  const props = new Map(Object.entries({
    BUNDLE_C_SMOKE_APPROVAL_MARKER: 'OWNER_APPROVE_BUNDLE_C_SINGLE_INVOICE_MUTATION_SMOKE',
    BUNDLE_C_SMOKE_THREAD_ID: 'thread_real_value_should_not_leak',
    BUNDLE_C_SMOKE_NONCE: 'nonce_real_value_should_not_leak',
    BUNDLE_C_SMOKE_STATE: 'READY',
    ...(options.props || {}),
  }));
  const logs = [];
  let released = 0;
  let searchCalls = 0;
  const commitCalls = { count: 0 };
  const batchCalls = { main: 0, inScan: 0, outScan: 0, bqgq: 0, tonKho: 0, drive: 0 };
  const testThread = options.thread === null ? null : (options.thread || thread(options.threadOptions || {}));
  const nhapXuatRows = options.nhapXuatRows || [[]];
  const hoaDonRows = options.hoaDonRows || [['invoiceKey', 'XML_id', 'XML_status', 'PDF_id', 'PDF_status']];
  const itemRows = options.itemRows || [['code', 'name'], ['THEPTAM', 'THEP TAM MAU']];
  const vtRows = [['from', 'to']];
  const sheets = {
    [options.invoiceSheet || 'Nhap-Xuat']: makeSheet(nhapXuatRows),
    'Hoa-Don': makeSheet(hoaDonRows),
    MaHangHoa: makeSheet(itemRows),
    VietTat: makeSheet(vtRows),
  };
  const filesByName = new Set(options.driveFiles || []);
  const yearFolder = {
    getFilesByName: (name) => iterator(filesByName.has(name) ? [{ getId: () => 'existing-file' }] : []),
    createFile: () => ({ setName: () => ({ getId: () => 'new-pdf-file' }) }),
  };
  const parentFolder = {
    getFoldersByName: () => iterator(options.yearFolderMissing ? [] : [yearFolder]),
    createFolder: () => yearFolder,
  };

  const loaded = loadGasSource({
    files: FILES,
    exportNames: ['runApprovedBundleCSingleThreadSmoke'],
    stubs: {
      Logger: { log: (...args) => logs.push(args.join(' ')) },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k) => props.get(k) || null,
          setProperty: (k, v) => props.set(k, String(v)),
          deleteProperty: (k) => props.delete(k),
        }),
      },
      LockService: { getScriptLock: () => ({ tryLock: () => options.lockAvailable !== false, releaseLock: () => { released++; } }) },
      GmailApp: {
        getThreadById: (id) => (id === 'thread_real_value_should_not_leak' ? testThread : null),
        getUserLabelByName: () => ({ addToThread: (t) => t.labels.push('saved'), removeFromThread: () => {} }),
        createLabel: () => ({ addToThread: (t) => t.labels.push('saved'), removeFromThread: () => {} }),
        search: () => { searchCalls++; throw new Error('GLOBAL_SEARCH_SHOULD_NOT_RUN'); },
      },
      SpreadsheetApp: {
        getActive: () => ({
          getSheetByName: (name) => {
            if (!sheets[name]) throw new Error(`missing sheet ${name}`);
            return sheets[name];
          },
        }),
      },
      DriveApp: { getFolderById: () => parentFolder },
    },
  });

  loaded.context.writeInvoicesToSheet_ = (rows) => {
    if (options.writeFails) throw new Error('WRITE_FAILED');
    commitCalls.rows = rows;
  };
  const originalCommit = loaded.context.commitPreparedInvoiceRows_;
  loaded.context.commitPreparedInvoiceRows_ = (processed) => {
    commitCalls.count++;
    return originalCommit(processed);
  };
  loaded.context.saveInvoiceXmlToDrive_ = () => 'new-xml-file';
  loaded.context.upsertHoaDonFile_ = () => {};
  loaded.context.buildVatPdfFileName_ = () => 'invoice.pdf';
  loaded.context.saveInvoicePdfToDrive_ = () => 'new-pdf-file';
  loaded.context.main = () => { batchCalls.main++; };
  loaded.context.scanInvoiceInEmails_ = () => { batchCalls.inScan++; };
  loaded.context.scanInvoiceOutEmails_ = () => { batchCalls.outScan++; };
  loaded.context.capNhatNhapXuatBQGQ = () => { batchCalls.bqgq++; };
  loaded.context.capNhatTonKho = () => { batchCalls.tonKho++; };
  loaded.context.triggerScanInvoiceDriveFolder = () => { batchCalls.drive++; };

  return { loaded, props, logs, released: () => released, searchCalls: () => searchCalls, commitCalls, batchCalls };
}

function run(options) {
  const h = makeHarness(options);
  const result = h.loaded.call('runApprovedBundleCSingleThreadSmoke');
  return { ...h, result };
}

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('missing approval marker blocks', () => {
  const { result } = run({ props: { BUNDLE_C_SMOKE_APPROVAL_MARKER: '' } });
  assert.equal(result.errorCode, 'SMOKE_APPROVAL_MARKER_MISSING');
});

test('wrong approval marker blocks', () => {
  const { result } = run({ props: { BUNDLE_C_SMOKE_APPROVAL_MARKER: 'WRONG' } });
  assert.equal(result.errorCode, 'SMOKE_APPROVAL_MARKER_INVALID');
});

test('missing thread id blocks', () => {
  const { result } = run({ props: { BUNDLE_C_SMOKE_THREAD_ID: '' } });
  assert.equal(result.errorCode, 'SMOKE_THREAD_ID_MISSING');
});

test('missing nonce blocks', () => {
  const { result } = run({ props: { BUNDLE_C_SMOKE_NONCE: '' } });
  assert.equal(result.errorCode, 'SMOKE_NONCE_MISSING');
});

test('state missing blocks', () => {
  const { result } = run({ props: { BUNDLE_C_SMOKE_STATE: '' } });
  assert.equal(result.errorCode, 'SMOKE_STATE_MISSING');
});

for (const state of ['RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED']) {
  test(`state ${state} blocks replay`, () => {
    const { result } = run({ props: { BUNDLE_C_SMOKE_STATE: state } });
    assert.equal(result.errorCode, 'SMOKE_REPLAY_BLOCKED');
  });
}

test('lock unavailable blocks before mutation', () => {
  const h = run({ lockAvailable: false });
  assert.equal(h.result.errorCode, 'SMOKE_LOCK_UNAVAILABLE');
  assert.equal(h.commitCalls.count, 0);
});

test('thread not found blocks', () => {
  const { result } = run({ thread: null });
  assert.equal(result.errorCode, 'SMOKE_THREAD_NOT_FOUND');
});

test('exact thread resolution ignores 10 global candidates', () => {
  const h = run();
  assert.equal(h.searchCalls(), 0);
  assert.equal(h.result.status, 'SUCCEEDED');
});

test('one thread with one XML passes validation and commits', () => {
  const h = run();
  assert.equal(h.result.status, 'SUCCEEDED');
  assert.equal(h.props.get('BUNDLE_C_SMOKE_STATE'), 'SUCCEEDED');
  assert.equal(h.props.get('BUNDLE_C_SMOKE_RESULT_CODE'), 'COMMITTED');
});

test('multiple XML blocks', () => {
  const { result } = run({ threadOptions: { attachments: [blob('a.xml', validXml), blob('b.xml', validXml)] } });
  assert.equal(result.errorCode, 'SMOKE_XML_COUNT_NOT_ONE');
});

test('multiple invoice XML blocks', () => {
  const { result } = run({ threadOptions: { attachments: [blob('a.xml', validXml), blob('b.xml', multiLineXml)] } });
  assert.equal(result.errorCode, 'SMOKE_XML_COUNT_NOT_ONE');
});

test('PDF-only blocks', () => {
  const { result } = run({ threadOptions: { attachments: [blob('a.pdf', 'pdf')] } });
  assert.equal(result.errorCode, 'SMOKE_PDF_ONLY_BLOCKED');
});

test('link-only blocks', () => {
  const { result } = run({ threadOptions: { attachments: [], body: 'https://example.test/invoice.pdf' } });
  assert.equal(result.errorCode, 'SMOKE_LINK_ONLY_BLOCKED');
});

test('adjustment blocks', () => {
  const { result } = run({ threadOptions: { attachments: [blob('a.xml', adjustmentXml)] } });
  assert.equal(result.errorCode, 'SMOKE_NON_ORIGINAL_INVOICE');
});

test('replacement blocks', () => {
  const { result } = run({ threadOptions: { attachments: [blob('a.xml', replacementXml)] } });
  assert.equal(result.errorCode, 'SMOKE_NON_ORIGINAL_INVOICE');
});

test('ambiguous item mapping blocks', () => {
  const { result } = run({ itemRows: [['code', 'name'], ['A', 'THEP'], ['B', 'THEP TAM']] });
  assert.equal(result.errorCode, 'SMOKE_ITEM_MAPPING_AMBIGUOUS');
});

test('existing ledger hash blocks', () => {
  const first = run();
  const hash = first.commitCalls.rows[0][12];
  const { result } = run({ nhapXuatRows: [[], Array(15).fill('').map((v, i) => i === 13 ? hash : v)] });
  assert.equal(result.errorCode, 'SAMPLE_ALREADY_COMMITTED');
});

test('existing invoiceKey blocks', () => {
  const first = run();
  const invoiceKey = first.commitCalls.rows[0][13];
  const row = Array(15).fill('');
  row[14] = invoiceKey;
  const { result } = run({ nhapXuatRows: [[], row] });
  assert.equal(result.errorCode, 'SAMPLE_ALREADY_COMMITTED');
});

test('partial Drive state blocks', () => {
  const { result } = run({ driveFiles: ['20260115_0100000001_CÔNG TY TNHH MẪU A_123.xml'], hoaDonRows: [['invoiceKey', 'XML_id', 'XML_status', 'PDF_id', 'PDF_status']] });
  assert.equal(result.errorCode, 'PREEXISTING_PARTIAL_STATE');
});

test('state moves READY to RUNNING to SUCCEEDED', () => {
  const h = run();
  assert.equal(h.props.get('BUNDLE_C_SMOKE_STATE'), 'SUCCEEDED');
  assert.ok(h.props.get('BUNDLE_C_SMOKE_STARTED_AT'));
  assert.ok(h.props.get('BUNDLE_C_SMOKE_FINISHED_AT'));
});

test('write failure records FAILED', () => {
  const h = run({ writeFails: true });
  assert.equal(h.result.status, 'FAILED');
  assert.equal(h.props.get('BUNDLE_C_SMOKE_STATE'), 'FAILED');
});

test('second invocation is blocked', () => {
  const h = makeHarness();
  const first = h.loaded.call('runApprovedBundleCSingleThreadSmoke');
  const second = h.loaded.call('runApprovedBundleCSingleThreadSmoke');
  assert.equal(first.status, 'SUCCEEDED');
  assert.equal(second.errorCode, 'SMOKE_REPLAY_BLOCKED');
});

test('shared commit core called exactly once', () => {
  const h = run();
  assert.equal(h.commitCalls.count, 1);
});

test('batch scanner and heavy jobs are never called', () => {
  const h = run();
  assert.deepEqual(h.batchCalls, { main: 0, inScan: 0, outScan: 0, bqgq: 0, tonKho: 0, drive: 0 });
});

test('raw thread id and invoice data are not logged or copied to result properties', () => {
  const h = run();
  const joinedLogs = h.logs.join('\n');
  assert.doesNotMatch(joinedLogs, /thread_real_value_should_not_leak|nonce_real_value_should_not_leak|000123|0100000001|MẪU A/);
  const resultProps = [...h.props.entries()]
    .filter(([k]) => k !== 'BUNDLE_C_SMOKE_THREAD_ID' && k !== 'BUNDLE_C_SMOKE_NONCE')
    .map(([, v]) => v)
    .join('\n');
  assert.doesNotMatch(resultProps, /thread_real_value_should_not_leak|nonce_real_value_should_not_leak|000123|0100000001|MẪU A/);
});

test('lock is always released on success and failure', () => {
  assert.equal(run().released(), 1);
  assert.equal(run({ writeFails: true }).released(), 1);
});
