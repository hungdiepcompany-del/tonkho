const SGDS_SHEETS_LEDGER_ADAPTER_CONTRACT_ = Object.freeze({
  D6E: 'SHEETS_LEDGER_ADAPTER',
  readOperations: Object.freeze([
    'readLedgerRows',
    'readConfigurationRows',
    'findTransactionByIdentity',
    'readRowsForRebuild',
    'planRebuildFromEarliestAffected'
  ]),
  mutationOperations: Object.freeze([
    'appendImmutableTransactionsIfAbsent',
    'appendAdjustment',
    'appendReplacement',
    'appendCancellation',
    'replaceDerivedRangeForRebuild'
  ]),
  appendModel: 'append_only_transaction_sequence',
  rebuildModel: 'earliest_affected_transaction_or_full_rebuild',
  immutabilityRules: Object.freeze({
    DIRECT_HISTORY_EDIT_BLOCKED: true,
    DIRECT_HISTORY_DELETE_BLOCKED: true,
    ADJUSTMENT_IS_APPEND_ONLY: true
  })
});

function createSgdsSheetsLedgerReadAdapter_(deps) {
  const source = requireSgdsAdapterMethod_(deps && deps.source, 'sheetsLedgerSource', [
    'readLedgerRows',
    'readConfigurationRows',
    'findTransactionByIdentity',
    'readRowsForRebuild'
  ]);
  return Object.freeze({
    async readLedgerRows(request) {
      return (await source.readLedgerRows(cloneSgdsAdapterJson_(request || {}))).map(normalizeSgdsLedgerRow_);
    },
    async readConfigurationRows(request) {
      return cloneSgdsAdapterJson_(await source.readConfigurationRows(cloneSgdsAdapterJson_(request || {})));
    },
    async findTransactionByIdentity(request) {
      return normalizeSgdsLedgerFindResult_(await source.findTransactionByIdentity(cloneSgdsAdapterJson_(request || {})));
    },
    async readRowsForRebuild(request) {
      return (await source.readRowsForRebuild(cloneSgdsAdapterJson_(request || {}))).map(normalizeSgdsLedgerRow_);
    },
    async planRebuildFromEarliestAffected(request) {
      const rows = (await source.readRowsForRebuild(cloneSgdsAdapterJson_(request || {}))).map(normalizeSgdsLedgerRow_);
      const identities = new Set((request && request.affectedTransactionIdentities || []).map(safeSgdsAdapterString_));
      const affected = rows.filter(row => identities.has(row.transactionIdentity));
      const startSequence = affected.length ? Math.min(...affected.map(row => row.transactionSequence)) : 1;
      return { startSequence, mode: startSequence === 1 ? 'FULL_REBUILD' : 'PARTIAL_REBUILD', rowCount: rows.filter(row => row.transactionSequence >= startSequence).length };
    }
  });
}

function createSgdsSheetsLedgerMutationAdapter_(deps) {
  const source = requireSgdsAdapterMethod_(deps && deps.source, 'sheetsLedgerMutationSource', [
    'appendImmutableTransactionsIfAbsent',
    'replaceDerivedRangeForRebuild'
  ]);
  return Object.freeze({
    async appendImmutableTransactionsIfAbsent(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsLedgerMutationResult_(await source.appendImmutableTransactionsIfAbsent(cloneSgdsAdapterJson_(request || {})));
    },
    async appendAdjustment(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsLedgerMutationResult_(await source.appendImmutableTransactionsIfAbsent({ ...cloneSgdsAdapterJson_(request || {}), transactionKind: 'ADJUSTMENT' }));
    },
    async appendReplacement(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsLedgerMutationResult_(await source.appendImmutableTransactionsIfAbsent({ ...cloneSgdsAdapterJson_(request || {}), transactionKind: 'REPLACEMENT' }));
    },
    async appendCancellation(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsLedgerMutationResult_(await source.appendImmutableTransactionsIfAbsent({ ...cloneSgdsAdapterJson_(request || {}), transactionKind: 'CANCELLATION' }));
    },
    async replaceDerivedRangeForRebuild(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsLedgerMutationResult_(await source.replaceDerivedRangeForRebuild(cloneSgdsAdapterJson_(request || {})));
    },
    updateAnyCell() {
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'direct ledger history edit blocked');
    },
    deleteAnyRow() {
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'direct ledger history delete blocked');
    },
    clearSheet() {
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'unbounded clear blocked');
    }
  });
}

function createFakeSgdsSheetsLedgerAdapter_(options) {
  const state = {
    ledgerRows: cloneSgdsAdapterJson_((options && options.ledgerRows) || []),
    configRows: cloneSgdsAdapterJson_((options && options.configRows) || []),
    inventory: cloneSgdsAdapterJson_((options && options.inventory) || {}),
    derivedRebuilds: [],
    mutationLog: []
  };
  let nextSequence = state.ledgerRows.reduce((max, row) => Math.max(max, Number(row.transactionSequence || 0)), 0) + 1;
  const calls = [];
  function record(method, request) {
    calls.push({ method, request: cloneSgdsAdapterJson_(request || {}) });
  }
  function findIdentity(identity) {
    return state.ledgerRows.filter(row => row.transactionIdentity === identity || row.lineIdentityV2 === identity);
  }
  function normalizeInputRows(request) {
    const rows = Array.isArray(request.rows) ? request.rows : Array.isArray(request.lines) ? request.lines : [];
    return rows.map((row, index) => normalizeSgdsLedgerRow_({
      ...row,
      transactionKind: request.transactionKind || row.transactionKind || 'ORIGINAL',
      sourceLineNo: row.sourceLineNo || index + 1,
      transactionSequence: row.transactionSequence || nextSequence + index,
      transactionIdentity: row.transactionIdentity || row.lineIdentityV2 || [request.invoiceKeyV2 || row.invoiceKeyV2, row.sourceLineNo || index + 1, row.lineIdentityV2 || ''].join('|')
    }));
  }
  function assertNoOversell(rows) {
    rows.forEach(row => {
      if (row.direction === 'XUAT') {
        const available = Number(state.inventory[row.itemCode] || 0);
        if (Number(row.quantity || 0) > available) {
          throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONFLICT, 'oversell blocked');
        }
      }
    });
  }
  const source = {
    async readLedgerRows(request) {
      record('sheets.readLedgerRows', request);
      const invoiceKey = safeSgdsAdapterString_(request && request.invoiceKeyV2 || request && request.legacyInvoiceKey);
      return invoiceKey ? state.ledgerRows.filter(row => row.invoiceKeyV2 === invoiceKey || row.legacyInvoiceKey === invoiceKey) : state.ledgerRows.slice();
    },
    async readConfigurationRows(request) {
      record('sheets.readConfigurationRows', request);
      return state.configRows;
    },
    async findTransactionByIdentity(request) {
      record('sheets.findTransactionByIdentity', request);
      const matches = findIdentity(safeSgdsAdapterString_(request && request.transactionIdentity));
      return { status: matches.length ? 'ALREADY_PRESENT' : 'CONFIRMED_NOT_WRITTEN', rows: matches };
    },
    async readRowsForRebuild(request) {
      record('sheets.readRowsForRebuild', request);
      if (request && request.fullRebuild) return state.ledgerRows.slice();
      const start = Number(request && request.startSequence || 1);
      return state.ledgerRows.filter(row => Number(row.transactionSequence || 0) >= start);
    },
    async appendImmutableTransactionsIfAbsent(request) {
      record('sheets.appendImmutableTransactionsIfAbsent', request);
      const rows = normalizeInputRows(request || {});
      assertNoOversell(rows);
      const newRows = [];
      rows.forEach(row => {
        const existing = findIdentity(row.transactionIdentity);
        if (existing.length) return;
        const sequence = nextSequence;
        nextSequence += 1;
        newRows.push({ ...row, transactionSequence: sequence });
      });
      if (newRows.length) {
        state.ledgerRows.push(...newRows);
        state.mutationLog.push({ method: 'appendImmutableTransactionsIfAbsent', count: newRows.length, idempotencyKey: request.idempotencyKey, transactionKind: request.transactionKind || 'ORIGINAL' });
      }
      return { status: newRows.length ? 'CONFIRMED_WRITTEN' : 'ALREADY_PRESENT', appendedCount: newRows.length, rows: newRows, idempotent: newRows.length === 0 };
    },
    async replaceDerivedRangeForRebuild(request) {
      record('sheets.replaceDerivedRangeForRebuild', request);
      const startSequence = Number(request && request.startSequence || 1);
      state.derivedRebuilds.push({ startSequence, rowCount: Array.isArray(request.rows) ? request.rows.length : 0 });
      state.mutationLog.push({ method: 'replaceDerivedRangeForRebuild', startSequence, idempotencyKey: request.idempotencyKey });
      return { status: 'CONFIRMED_WRITTEN', startSequence, appendedCount: 0, rows: [] };
    }
  };
  return Object.freeze({
    read: createSgdsSheetsLedgerReadAdapter_({ source }),
    mutate: createSgdsSheetsLedgerMutationAdapter_({ source }),
    state,
    calls
  });
}

function normalizeSgdsLedgerRow_(row) {
  const source = cloneSgdsAdapterJson_(row || {});
  return {
    transactionSequence: Number(source.transactionSequence || 0),
    issueDate: safeSgdsAdapterString_(source.issueDate),
    legacyInvoiceKey: safeSgdsAdapterString_(source.legacyInvoiceKey),
    invoiceKeyV2: safeSgdsAdapterString_(source.invoiceKeyV2),
    sourceLineNo: Number(source.sourceLineNo || 0),
    lineIdentityV2: safeSgdsAdapterString_(source.lineIdentityV2),
    transactionIdentity: safeSgdsAdapterString_(source.transactionIdentity || source.lineIdentityV2),
    transactionKind: safeSgdsAdapterString_(source.transactionKind || 'ORIGINAL'),
    direction: safeSgdsAdapterString_(source.direction || 'NHAP'),
    itemCode: safeSgdsAdapterString_(source.itemCode),
    itemName: safeSgdsAdapterString_(source.itemName),
    quantity: Number(source.quantity || 0),
    unitPrice: Number(source.unitPrice || 0),
    amount: Number(source.amount || (Number(source.quantity || 0) * Number(source.unitPrice || 0))),
    auditReason: safeSgdsAdapterString_(source.auditReason || '')
  };
}

function normalizeSgdsLedgerFindResult_(result) {
  const source = cloneSgdsAdapterJson_(result || {});
  return {
    status: safeSgdsAdapterString_(source.status || 'READ_OK'),
    rows: (Array.isArray(source.rows) ? source.rows : []).map(normalizeSgdsLedgerRow_)
  };
}

function normalizeSgdsLedgerMutationResult_(result) {
  const source = cloneSgdsAdapterJson_(result || {});
  return {
    status: safeSgdsAdapterString_(source.status || 'CONFIRMED_WRITTEN'),
    appendedCount: Number(source.appendedCount || 0),
    idempotent: Boolean(source.idempotent),
    rows: (Array.isArray(source.rows) ? source.rows : []).map(normalizeSgdsLedgerRow_)
  };
}
