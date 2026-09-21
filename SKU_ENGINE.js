/**
 * SKU Engine - configuration and shared helpers.
 * Designed for Google Sheets + Apps Script.
 * Default behavior is fail-closed and DRY_RUN only.
 */
const SKU_ENGINE = Object.freeze({
  VERSION: 'SKU_MONTHLY_WAC_V1_1_7',
  SHEETS: Object.freeze({
    CONFIG: 'SKU_CONFIG',
    MASTER: 'SKU_MASTER',
    ALIAS: 'SKU_ALIAS',
    OPENING: 'SKU_OPENING',
    STOCK: 'TonKhoSKU',
    MONTHLY: 'SKU_MONTHLY',
    AUDIT: 'SKU_AUDIT',
    TXN_DRY: 'SKU_TXN_DRYRUN',
    AUTO_REVIEW: 'SKU_AUTO_REVIEW',
    UNIT_OVERRIDE: 'SKU_UNIT_OVERRIDE',
    MERGE_REVIEW: 'SKU_MERGE_REVIEW'
  }),
  SOURCE_REQUIRED_HEADERS: Object.freeze([
    'STT', 'Ngày', 'Hóa đơn số', 'Tên khách hàng', 'Mã hàng', 'Tên hàng',
    'Phân loại', 'Số lượng', 'Đơn giá', 'Thành tiền'
  ])
});

function skuCfg_() {
  const sh = skuRequireSheet_(SKU_ENGINE.SHEETS.CONFIG);
  const values = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 2).getValues();
  const raw = {};
  values.forEach(r => {
    const k = String(r[0] || '').trim();
    if (k) raw[k] = r[1];
  });

  const cfg = {
    engineVersion: String(raw.ENGINE_VERSION || SKU_ENGINE.VERSION).trim(),
    runMode: String(raw.RUN_MODE || 'DRY_RUN').trim().toUpperCase(),
    costMethod: String(raw.COST_METHOD || 'MONTHLY_WAC').trim().toUpperCase(),
    skuResolution: String(raw.SKU_RESOLUTION || 'ALIAS_APPROVED_ONLY').trim().toUpperCase(),
    useOpeningBalance: skuBool_(raw.USE_OPENING_BALANCE, false),
    cutoverDate: skuParseDate_(raw.CUTOVER_DATE),
    roundUnitCostDecimals: skuNum_(raw.ROUND_UNIT_COST_DECIMALS, 6),
    roundValueDecimals: skuNum_(raw.ROUND_VALUE_DECIMALS, 2),
    zeroQtyEpsilon: skuNum_(raw.ZERO_QTY_EPSILON, 1e-6),
    zeroValueEpsilon: skuNum_(raw.ZERO_VALUE_EPSILON, 0.01),
    allowNegativeStock: skuBool_(raw.ALLOW_NEGATIVE_STOCK, false),
    productionWriteEnabled: skuBool_(raw.PRODUCTION_WRITE_ENABLED, false),
    sourceSheet: String(raw.SOURCE_SHEET || 'Nhap-Xuat').trim(),
    groupStockSheet: String(raw.GROUP_STOCK_SHEET || 'TonKho').trim(),
    timezone: String(raw.TIMEZONE || Session.getScriptTimeZone() || 'Asia/Saigon').trim(),
    strictPhysicalOrder: skuBool_(raw.STRICT_PHYSICAL_ORDER, true),
    monthlyOrder: String(raw.MONTHLY_ORDER || 'DATE_THEN_PHYSICAL_ROW').trim().toUpperCase(),
    autoMatchMaxDays: skuNum_(raw.AUTO_MATCH_MAX_DAYS, 7),
    autoMatchQtyEpsilon: skuNum_(raw.AUTO_MATCH_QTY_EPSILON, 0.001),
    autoApproveMinEvidence: skuNum_(raw.AUTO_APPROVE_MIN_EVIDENCE, 1),
    autoCandidateConfidence: skuNum_(raw.AUTO_CANDIDATE_CONFIDENCE, 0.95),
    unitOverrideSheet: String(raw.UNIT_OVERRIDE_SHEET || SKU_ENGINE.SHEETS.UNIT_OVERRIDE).trim(),
    unitPolicy: String(raw.UNIT_POLICY || 'FAIL_CLOSED').trim().toUpperCase(),
    defaultBaseUnit: String(raw.DEFAULT_BASE_UNIT || 'KG').trim().toUpperCase(),
    blockMixedUnits: skuBool_(raw.BLOCK_MIXED_UNITS, true),
    unitPriceAnomalyRatio: skuNum_(raw.UNIT_PRICE_ANOMALY_RATIO, 2.5)
  };

  if (cfg.costMethod !== 'MONTHLY_WAC') {
    throw new Error('SKU_ENGINE_UNSUPPORTED_COST_METHOD:' + cfg.costMethod);
  }
  if (cfg.runMode !== 'DRY_RUN' && cfg.runMode !== 'PRODUCTION') {
    throw new Error('SKU_ENGINE_INVALID_RUN_MODE:' + cfg.runMode);
  }
  if (cfg.useOpeningBalance && !cfg.cutoverDate) {
    throw new Error('SKU_ENGINE_CUTOVER_DATE_REQUIRED');
  }

  // Fail closed: a missing/blank numeric config must never silently become zero.
  if (!isFinite(cfg.autoMatchMaxDays) || cfg.autoMatchMaxDays < 0) {
    throw new Error('SKU_ENGINE_INVALID_AUTO_MATCH_MAX_DAYS:' + cfg.autoMatchMaxDays);
  }
  if (!isFinite(cfg.autoMatchQtyEpsilon) || cfg.autoMatchQtyEpsilon <= 0) {
    throw new Error('SKU_ENGINE_INVALID_AUTO_MATCH_QTY_EPSILON:' + cfg.autoMatchQtyEpsilon);
  }
  if (!Number.isInteger(cfg.autoApproveMinEvidence) || cfg.autoApproveMinEvidence < 1) {
    throw new Error('SKU_ENGINE_INVALID_AUTO_APPROVE_MIN_EVIDENCE:' + cfg.autoApproveMinEvidence);
  }
  if (!isFinite(cfg.autoCandidateConfidence) ||
      cfg.autoCandidateConfidence <= 0 ||
      cfg.autoCandidateConfidence > 1) {
    throw new Error('SKU_ENGINE_INVALID_AUTO_CANDIDATE_CONFIDENCE:' + cfg.autoCandidateConfidence);
  }
  if (!isFinite(cfg.unitPriceAnomalyRatio) || cfg.unitPriceAnomalyRatio <= 1) {
    throw new Error('SKU_ENGINE_INVALID_UNIT_PRICE_ANOMALY_RATIO:' + cfg.unitPriceAnomalyRatio);
  }

  return cfg;
}

function skuBool_(v, fallback) {
  if (v === true || v === false) return v;
  if (v === null || v === '' || typeof v === 'undefined') return fallback;
  const s = String(v).trim().toUpperCase();
  if (['TRUE', 'YES', 'Y', '1'].indexOf(s) >= 0) return true;
  if (['FALSE', 'NO', 'N', '0'].indexOf(s) >= 0) return false;
  return fallback;
}

function skuNum_(v, fallback) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (v === null || typeof v === 'undefined') return fallback;

  const s = String(v).trim();
  if (!s) return fallback;

  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : fallback;
}

function skuParseDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function skuDateKey_(date, timezone) {
  return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
}

function skuMonthKey_(date, timezone) {
  return Utilities.formatDate(date, timezone, 'yyyy-MM');
}

function skuRequireSheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('SKU_ENGINE_SHEET_MISSING:' + name);
  return sh;
}

function skuNormalizeGroup_(v) {
  return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
}

function skuNormalizeName_(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  s = s.replace(/Đ/g, 'D').replace(/đ/g, 'd');
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {}
  s = s.toUpperCase();
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/[×✕]/g, 'X');
  s = s.replace(/\bMM\b/g, 'MM');
  s = s.replace(/[^A-Z0-9.]+/g, ' ');
  s = s.replace(/\s*X\s*/g, 'X');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function skuAliasKey_(groupCode, rawName) {
  return skuNormalizeGroup_(groupCode) + '|' + (skuNormalizeName_(rawName) || '__BLANK__');
}

function skuDigest8_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  const hex = bytes.map(b => {
    const n = (b < 0 ? b + 256 : b).toString(16);
    return n.length === 1 ? '0' + n : n;
  }).join('');
  return hex.slice(0, 10).toUpperCase();
}

function skuSuggestCode_(groupCode, rawName) {
  const group = skuNormalizeGroup_(groupCode) || 'UNKNOWN';
  const norm = skuNormalizeName_(rawName);
  if (!norm) return 'LEGACY_' + group + '_BLANK';
  const readable = norm
    .replace(/\bTHEP\b/g, '')
    .replace(/\bONG\b/g, 'ONG')
    .replace(/\bHINH\b/g, '')
    .replace(/\bCAC LOAI\b/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 42);
  return (group + '_' + (readable || 'ITEM') + '_' + skuDigest8_(group + '|' + norm)).slice(0, 64);
}

function skuRound_(value, decimals) {
  if (!isFinite(value)) return value;
  const p = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * p) / p;
}

function skuZero_(value, epsilon) {
  return Math.abs(value) <= epsilon ? 0 : value;
}

function skuNewRunId_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Saigon', 'yyyyMMdd_HHmmss') +
    '_' + Utilities.getUuid().slice(0, 8);
}

function skuHeaderMap_(headers) {
  const map = {};
  headers.forEach((h, i) => map[String(h || '').trim()] = i);
  return map;
}

function skuAssertHeaders_(headers, required) {
  const map = skuHeaderMap_(headers);
  const missing = required.filter(h => typeof map[h] === 'undefined');
  if (missing.length) throw new Error('SKU_ENGINE_SOURCE_HEADERS_MISSING:' + missing.join(','));
  return map;
}

function skuSetStatusToast_(message, title) {
  SpreadsheetApp.getActive().toast(message, title || 'SKU Engine', 8);
}


/**
 * SKU Engine - source readers, master/alias/opening readers and audit helpers.
 */

function skuReadTransactions_(cfg) {
  const sh = skuRequireSheet_(cfg.sourceSheet);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.max(sh.getLastColumn(), 16);
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const h = skuAssertHeaders_(headers, SKU_ENGINE.SOURCE_REQUIRED_HEADERS);

  const optional = {
    invoiceKey: h['InvoiceKey'],
    hashIndex: h['HashIndex']
  };

  const txs = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const physicalRow = i + 1;
    const rawDate = r[h['Ngày']];
    const rawGroup = r[h['Mã hàng']];
    const rawType = r[h['Phân loại']];
    const rawQty = r[h['Số lượng']];
    const rawUnitPrice = r[h['Đơn giá']];
    const rawAmount = r[h['Thành tiền']];
    const rawInvoice = r[h['Hóa đơn số']];
    const rawNameCell = r[h['Tên hàng']];

    // Ignore physically empty rows only. Do this BEFORE Number('') => 0.
    const hasAny = [rawDate, rawGroup, rawType, rawQty, rawUnitPrice, rawAmount, rawInvoice, rawNameCell]
      .some(v => v !== '' && v !== null && typeof v !== 'undefined');
    if (!hasAny) continue;

    const date = skuParseDate_(rawDate);
    const group = skuNormalizeGroup_(rawGroup);
    const type = String(rawType || '').trim().toUpperCase();
    const qty = Number(rawQty);
    const unitPrice = Number(rawUnitPrice);
    const amount = Number(rawAmount);
    const rawName = String(rawNameCell || '').trim();

    txs.push({
      row: physicalRow,
      stt: r[h['STT']],
      date: date,
      invoiceNo: r[h['Hóa đơn số']],
      customer: String(r[h['Tên khách hàng']] || '').trim(),
      group: group,
      rawName: rawName,
      normalizedName: skuNormalizeName_(rawName),
      type: type,
      qty: qty,
      inputUnitPrice: unitPrice,
      inputAmount: amount,
      invoiceKey: typeof optional.invoiceKey === 'number' ? String(r[optional.invoiceKey] || '').trim() : '',
      hashIndex: typeof optional.hashIndex === 'number' ? String(r[optional.hashIndex] || '').trim() : ''
    });
  }
  return txs;
}

function skuReadMaster_() {
  const sh = skuRequireSheet_(SKU_ENGINE.SHEETS.MASTER);
  if (sh.getLastRow() < 2) return {};
  const values = sh.getRange(1, 1, sh.getLastRow(), 12).getValues();
  const h = skuHeaderMap_(values[0]);
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const sku = String(r[h.SKU] || '').trim();
    if (!sku) continue;
    out[sku] = {
      sku: sku,
      group: skuNormalizeGroup_(r[h.GroupCode]),
      name: String(r[h.CanonicalName] || '').trim(),
      unit: String(r[h.Unit] || 'kg').trim(),
      status: String(r[h.Status] || '').trim().toUpperCase(),
      accountingCode: String(r[h.AccountingCode] || '').trim(),
      isActive: skuBool_(r[h.IsActive], true)
    };
  }
  return out;
}

function skuReadAliases_() {
  const sh = skuRequireSheet_(SKU_ENGINE.SHEETS.ALIAS);
  if (sh.getLastRow() < 2) return {};
  const values = sh.getRange(1, 1, sh.getLastRow(), 10).getValues();
  const h = skuHeaderMap_(values[0]);
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const key = String(r[h.AliasKey] || '').trim();
    if (!key) continue;
    out[key] = {
      key: key,
      group: skuNormalizeGroup_(r[h.GroupCode]),
      rawName: String(r[h.RawName] || '').trim(),
      normalizedName: String(r[h.NormalizedName] || '').trim(),
      sku: String(r[h.SKU] || '').trim(),
      status: String(r[h.Status] || '').trim().toUpperCase(),
      confidence: r[h.Confidence]
    };
  }
  return out;
}


function skuReadUnitOverrides_(cfg) {
  const sheetName = cfg.unitOverrideSheet || SKU_ENGINE.SHEETS.UNIT_OVERRIDE;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return {};

  const values = sh.getDataRange().getValues();
  const h = skuHeaderMap_(values[0]);
  const required = [
    'PhysicalRow','GroupCode','RawName','TransactionUnit','BaseUnit',
    'ConversionFactorToBase','ForcedSKU','Status','Notes'
  ];
  required.forEach(name => {
    if (typeof h[name] === 'undefined') {
      throw new Error('SKU_UNIT_OVERRIDE_HEADER_MISSING:' + name);
    }
  });

  const out = {};
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const physicalRow = Number(r[h.PhysicalRow]);
    if (!isFinite(physicalRow) || physicalRow < 2) continue;

    out[physicalRow] = {
      physicalRow: physicalRow,
      group: skuNormalizeGroup_(r[h.GroupCode]),
      rawName: String(r[h.RawName] || '').trim(),
      transactionUnit: String(r[h.TransactionUnit] || '').trim().toUpperCase(),
      baseUnit: String(r[h.BaseUnit] || '').trim().toUpperCase(),
      conversionFactor: skuNum_(r[h.ConversionFactorToBase], NaN),
      forcedSku: String(r[h.ForcedSKU] || '').trim(),
      status: String(r[h.Status] || '').trim().toUpperCase(),
      notes: String(r[h.Notes] || '').trim()
    };
  }
  return out;
}

function skuReadOpening_(cfg, master) {
  const states = {};
  if (!cfg.useOpeningBalance) return states;

  const sh = skuRequireSheet_(SKU_ENGINE.SHEETS.OPENING);
  if (sh.getLastRow() < 2) {
    throw new Error('SKU_ENGINE_OPENING_EMPTY');
  }
  const values = sh.getRange(1, 1, sh.getLastRow(), 10).getValues();
  const h = skuHeaderMap_(values[0]);
  const cutKey = skuDateKey_(cfg.cutoverDate, cfg.timezone);
  let accepted = 0;

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const d = skuParseDate_(r[h.CutoverDate]);
    const sku = String(r[h.SKU] || '').trim();
    if (!d || !sku) continue;
    if (skuDateKey_(d, cfg.timezone) !== cutKey) continue;

    const m = master[sku];
    if (!m || m.status !== 'APPROVED' || !m.isActive) {
      throw new Error('SKU_ENGINE_OPENING_SKU_NOT_APPROVED:' + sku);
    }
    const qty = Number(r[h.OpeningQty]);
    const value = Number(r[h.OpeningValue]);
    if (!isFinite(qty) || !isFinite(value)) {
      throw new Error('SKU_ENGINE_OPENING_INVALID_NUMBER:' + sku);
    }
    states[sku] = {
      sku: sku,
      group: m.group,
      qty: qty,
      value: value,
      lastTxnDate: new Date(cfg.cutoverDate.getTime() - 86400000),
      lastTxnRow: 0
    };
    accepted++;
  }

  if (!accepted) {
    throw new Error('SKU_ENGINE_OPENING_NO_ROWS_FOR_CUTOVER:' + cutKey);
  }
  return states;
}

function skuAuditRow_(severity, code, tx, message, runId) {
  tx = tx || {};
  return [
    severity,
    code,
    tx.row || '',
    tx.date || '',
    tx.invoiceNo || '',
    tx.group || '',
    tx.rawName || '',
    tx.normalizedName || '',
    tx.sku || '',
    tx.type || '',
    isFinite(tx.qty) ? tx.qty : '',
    isFinite(tx.inputUnitPrice) ? tx.inputUnitPrice : '',
    isFinite(tx.inputAmount) ? tx.inputAmount : '',
    message || '',
    runId || '',
    new Date()
  ];
}

function skuValidateSourceTransactions_(txs, cfg, runId) {
  const audit = [];
  let previousDate = null;

  txs.forEach(tx => {
    if (!tx.date) {
      audit.push(skuAuditRow_('ERROR', 'DATE_INVALID', tx, 'Ngày giao dịch không hợp lệ', runId));
    }
    if (!tx.group) {
      audit.push(skuAuditRow_('ERROR', 'GROUP_MISSING', tx, 'Mã hàng trống', runId));
    }
    if (tx.type !== 'NHAP' && tx.type !== 'XUAT') {
      audit.push(skuAuditRow_('ERROR', 'TYPE_INVALID', tx, 'Phân loại phải là NHAP hoặc XUAT', runId));
    }
    if (!isFinite(tx.qty) || tx.qty <= 0) {
      audit.push(skuAuditRow_('ERROR', 'QTY_INVALID', tx, 'Số lượng phải > 0', runId));
    }
    if (!isFinite(tx.inputAmount)) {
      audit.push(skuAuditRow_('ERROR', 'AMOUNT_INVALID', tx, 'Thành tiền không hợp lệ', runId));
    }
    if (tx.type === 'NHAP' && (!isFinite(tx.inputUnitPrice) || tx.inputUnitPrice < 0)) {
      audit.push(skuAuditRow_('ERROR', 'INPUT_PRICE_INVALID', tx, 'Đơn giá nhập không hợp lệ', runId));
    }

    if (cfg.strictPhysicalOrder && tx.date) {
      if (previousDate && tx.date.getTime() < previousDate.getTime()) {
        audit.push(skuAuditRow_(
          'ERROR',
          'PHYSICAL_ORDER_INVALID',
          tx,
          'Ngày giảm so với dòng giao dịch trước. Cần sort lại theo ngày trước khi chạy engine.',
          runId
        ));
      }
      previousDate = tx.date;
    }
  });
  return audit;
}

function skuResolveTransactions_(txs, aliases, master, unitOverrides, cfg, runId) {
  const audit = [];
  const resolved = [];
  unitOverrides = unitOverrides || {};

  txs.forEach(tx => {
    const override = unitOverrides[tx.row];

    // Explicit row-level unit override has priority over alias-level mapping.
    if (override) {
      if (override.group && override.group !== tx.group) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_GROUP_MISMATCH', tx,
          'SKU_UNIT_OVERRIDE group=' + override.group + ' nhưng giao dịch=' + tx.group,
          runId
        ));
        return;
      }

      if (override.rawName &&
          skuNormalizeName_(override.rawName) !== tx.normalizedName) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_NAME_MISMATCH', tx,
          'SKU_UNIT_OVERRIDE RawName không còn khớp dữ liệu nguồn tại dòng ' + tx.row,
          runId
        ));
        return;
      }

      if (override.status !== 'APPROVED') {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_NOT_APPROVED', tx,
          'Dòng có override đơn vị nhưng Status=' + (override.status || '(trống)') +
          '. Phải giải quyết ĐVT trước khi costing.',
          runId
        ));
        return;
      }

      if (!override.transactionUnit || !override.baseUnit) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_UNIT_MISSING', tx,
          'TransactionUnit/BaseUnit còn trống tại dòng ' + tx.row,
          runId
        ));
        return;
      }

      let factor = override.conversionFactor;
      if (override.transactionUnit === override.baseUnit) {
        factor = 1;
      }
      if (!isFinite(factor) || factor <= 0) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_CONVERSION_FACTOR_REQUIRED', tx,
          'Cần ConversionFactorToBase > 0 cho ' +
          override.transactionUnit + ' → ' + override.baseUnit,
          runId
        ));
        return;
      }

      const forcedSku = override.forcedSku;
      if (!forcedSku) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_FORCED_SKU_REQUIRED', tx,
          'Override đơn vị APPROVED phải chỉ rõ ForcedSKU để không phụ thuộc alias mơ hồ.',
          runId
        ));
        return;
      }

      const m = master[forcedSku];
      if (!m) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_SKU_MISSING', tx,
          'ForcedSKU không tồn tại: ' + forcedSku,
          runId
        ));
        return;
      }
      if (m.status !== 'APPROVED' || !m.isActive) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_SKU_NOT_APPROVED', tx,
          'ForcedSKU ' + forcedSku + ' chưa APPROVED/ACTIVE',
          runId
        ));
        return;
      }
      if (m.group !== tx.group) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_SKU_GROUP_MISMATCH', tx,
          'ForcedSKU ' + forcedSku + ' thuộc ' + m.group +
          ' nhưng giao dịch là ' + tx.group,
          runId
        ));
        return;
      }

      const masterUnit = String(m.unit || cfg.defaultBaseUnit || 'KG').trim().toUpperCase();
      if (masterUnit !== override.baseUnit) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_BASE_UNIT_MISMATCH', tx,
          'SKU_MASTER.Unit=' + masterUnit +
          ' nhưng override BaseUnit=' + override.baseUnit,
          runId
        ));
        return;
      }

      const baseQty = tx.qty * factor;
      if (!isFinite(baseQty) || baseQty <= 0) {
        audit.push(skuAuditRow_(
          'ERROR', 'UNIT_OVERRIDE_BASE_QTY_INVALID', tx,
          'BaseQty không hợp lệ sau quy đổi.',
          runId
        ));
        return;
      }

      resolved.push(Object.assign({}, tx, {
        sku: forcedSku,
        sourceQty: tx.qty,
        transactionUnit: override.transactionUnit,
        baseUnit: override.baseUnit,
        conversionFactorToBase: factor,
        qty: baseQty,
        unitResolution: 'ROW_OVERRIDE'
      }));
      return;
    }

    const key = skuAliasKey_(tx.group, tx.rawName);
    const a = aliases[key];

    if (!a) {
      audit.push(skuAuditRow_(
        'ERROR', 'SKU_ALIAS_MISSING', tx,
        'Chưa có alias được xác nhận cho: ' + key,
        runId
      ));
      return;
    }
    if (a.status !== 'APPROVED') {
      audit.push(skuAuditRow_(
        'ERROR', 'SKU_ALIAS_NOT_APPROVED', tx,
        'Alias hiện có trạng thái ' + (a.status || '(trống)') + ', cần APPROVED',
        runId
      ));
      return;
    }
    if (!a.sku) {
      audit.push(skuAuditRow_('ERROR', 'SKU_ALIAS_TARGET_MISSING', tx, 'Alias chưa trỏ tới SKU', runId));
      return;
    }

    const m = master[a.sku];
    if (!m) {
      audit.push(skuAuditRow_('ERROR', 'SKU_MASTER_MISSING', tx, 'Không tìm thấy SKU_MASTER: ' + a.sku, runId));
      return;
    }
    if (m.status !== 'APPROVED' || !m.isActive) {
      audit.push(skuAuditRow_(
        'ERROR', 'SKU_MASTER_NOT_APPROVED', tx,
        'SKU_MASTER ' + a.sku + ' chưa APPROVED/ACTIVE',
        runId
      ));
      return;
    }
    if (m.group !== tx.group) {
      audit.push(skuAuditRow_(
        'ERROR', 'SKU_GROUP_MISMATCH', tx,
        'SKU ' + a.sku + ' thuộc ' + m.group + ' nhưng giao dịch đang là ' + tx.group,
        runId
      ));
      return;
    }

    const baseUnit = String(m.unit || cfg.defaultBaseUnit || 'KG').trim().toUpperCase();
    resolved.push(Object.assign({}, tx, {
      sku: a.sku,
      sourceQty: tx.qty,
      transactionUnit: baseUnit,
      baseUnit: baseUnit,
      conversionFactorToBase: 1,
      unitResolution: 'MASTER_DEFAULT'
    }));
  });

  return {resolved: resolved, audit: audit};
}

function skuScopeTransactions_(txs, cfg) {
  if (!cfg.useOpeningBalance) return txs.slice();
  const t0 = cfg.cutoverDate.getTime();
  return txs.filter(tx => tx.date && tx.date.getTime() >= t0);
}

function skuWriteRows_(sheetName, rows, width) {
  const sh = skuRequireSheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, Math.max(width, sh.getLastColumn())).clearContent();
  if (!rows.length) return;
  const chunk = 500;
  for (let start = 0; start < rows.length; start += chunk) {
    const part = rows.slice(start, start + chunk);
    sh.getRange(start + 2, 1, part.length, width).setValues(part);
  }
}

function skuCountAuditErrors_(auditRows) {
  return auditRows.filter(r => String(r[0] || '').toUpperCase() === 'ERROR').length;
}

function skuWriteAudit_(auditRows) {
  skuWriteRows_(SKU_ENGINE.SHEETS.AUDIT, auditRows, 16);
}


/**
 * SKU Engine - idempotent sheet setup + SKU/alias suggestion bootstrap.
 * Suggestions are NEVER auto-approved.
 */

function skuEngineSetupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const definitions = [
    [SKU_ENGINE.SHEETS.CONFIG, ['Key','Value','Type','Description','Required','Notes']],
    [SKU_ENGINE.SHEETS.MASTER, ['SKU','GroupCode','CanonicalName','Unit','Status','EffectiveFrom','EffectiveTo','Notes','CreatedBy','CreatedAt','AccountingCode','IsActive']],
    [SKU_ENGINE.SHEETS.ALIAS, ['AliasKey','GroupCode','RawName','NormalizedName','SKU','Status','Confidence','SourceRows','Notes','LastSeen']],
    [SKU_ENGINE.SHEETS.OPENING, ['CutoverDate','SKU','GroupCode','OpeningQty','OpeningValue','OpeningAvg','Source','Status','Notes','UpdatedAt']],
    [SKU_ENGINE.SHEETS.STOCK, ['SKU','GroupCode','CanonicalName','Unit','ClosingQty','ClosingValue','AvgCost','LastTxnDate','LastTxnRow','Status','EngineVersion','RunId']],
    [SKU_ENGINE.SHEETS.MONTHLY, ['Month','SKU','GroupCode','OpeningQty','OpeningValue','ReceiptQty','ReceiptValue','AvailableQty','AvailableValue','MonthlyAvgCost','IssueQty','IssueValue','ClosingQty','ClosingValue','TxnCount','RunId']],
    [SKU_ENGINE.SHEETS.AUDIT, ['Severity','Code','PhysicalRow','Date','InvoiceNo','GroupCode','RawName','NormalizedName','SKU','TxnType','Qty','UnitPrice','Amount','Message','RunId','Timestamp']],
    [SKU_ENGINE.SHEETS.TXN_DRY, ['PhysicalRow','Date','Month','InvoiceNo','Customer','GroupCode','RawName','SKU','TxnType','Qty','InputUnitPrice','InputAmount','MonthlyAvgCost','CostedAmount','ClosingQtySKU','ClosingValueSKU','RunId','Status']],
    [SKU_ENGINE.SHEETS.AUTO_REVIEW, ['AliasKey','GroupCode','RawName','NormalizedName','SKU','Classification','Confidence','EvidenceCount','NhapRows','XuatRows','MatchedQty','DaysGap','PriceCheck','Reason','Action','RunId']],
    [SKU_ENGINE.SHEETS.UNIT_OVERRIDE, ['PhysicalRow','GroupCode','RawName','TransactionUnit','BaseUnit','ConversionFactorToBase','ForcedSKU','Status','Notes']],
    [SKU_ENGINE.SHEETS.MERGE_REVIEW, ['MergeKey','GroupCode','Signature','Classification','Confidence','TargetSKU','AliasKeys','RawNames','CurrentSKUs','Statuses','Reason','Action','RunId','Notes']]
  ];

  definitions.forEach(def => {
    let sh = ss.getSheetByName(def[0]);
    if (!sh) sh = ss.insertSheet(def[0]);
    if (sh.getLastRow() === 0 || !String(sh.getRange(1,1).getValue() || '').trim()) {
      sh.getRange(1, 1, 1, def[1].length).setValues([def[1]]);
      sh.setFrozenRows(1);
    }
  });

  skuSetStatusToast_('Đã kiểm tra/tạo các sheet SKU Engine. Không thay đổi Nhap-Xuat/TonKho.', 'SKU Engine');
}

function skuEngineBootstrapAliases() {
  const cfg = skuCfg_();
  const txs = skuReadTransactions_(cfg);
  const shAlias = skuRequireSheet_(SKU_ENGINE.SHEETS.ALIAS);
  const shMaster = skuRequireSheet_(SKU_ENGINE.SHEETS.MASTER);

  const existingAlias = skuReadAliases_();
  const existingMaster = skuReadMaster_();

  const unique = {};
  txs.forEach(tx => {
    const key = skuAliasKey_(tx.group, tx.rawName);
    if (!unique[key]) {
      unique[key] = {
        key: key,
        group: tx.group,
        rawName: tx.rawName,
        normalized: tx.normalizedName,
        rows: [],
        lastSeen: tx.date
      };
    }
    if (unique[key].rows.length < 20) unique[key].rows.push(tx.row);
    if (tx.date && (!unique[key].lastSeen || tx.date > unique[key].lastSeen)) unique[key].lastSeen = tx.date;
  });

  const aliasRows = [];
  const masterRows = [];
  const creator = Session.getActiveUser().getEmail() || '';

  Object.keys(unique).sort().forEach(key => {
    if (existingAlias[key]) return;
    const u = unique[key];
    const sku = skuSuggestCode_(u.group, u.rawName);

    if (!existingMaster[sku]) {
      masterRows.push([
        sku,
        u.group,
        u.rawName || '(Tên hàng trống - cần đối chiếu)',
        'kg',
        'DRAFT',
        '',
        '',
        'Tạo tự động từ dữ liệu hiện có. PHẢI xác nhận với mã vật tư kế toán trước khi APPROVED.',
        creator,
        new Date(),
        '',
        true
      ]);
      existingMaster[sku] = {sku: sku};
    }

    aliasRows.push([
      key,
      u.group,
      u.rawName,
      u.normalized,
      sku,
      u.rawName ? 'REVIEW_REQUIRED' : 'MISSING_NAME',
      u.rawName ? 0.50 : 0,
      u.rows.join(','),
      'Không auto-approve. Có thể đổi SKU đích rồi đặt Status=APPROVED sau khi đối chiếu.',
      u.lastSeen || ''
    ]);
  });

  if (masterRows.length) {
    shMaster.getRange(shMaster.getLastRow() + 1, 1, masterRows.length, 12).setValues(masterRows);
  }
  if (aliasRows.length) {
    shAlias.getRange(shAlias.getLastRow() + 1, 1, aliasRows.length, 10).setValues(aliasRows);
  }

  skuSetStatusToast_(
    'Đã tạo ' + aliasRows.length + ' alias cần review và ' + masterRows.length + ' SKU draft. Không có SKU nào được auto-approve.',
    'SKU Bootstrap'
  );
  return {aliasesCreated: aliasRows.length, skuDraftsCreated: masterRows.length};
}

function skuEngineValidateMappings() {
  const cfg = skuCfg_();
  const runId = skuNewRunId_();
  let txs = skuScopeTransactions_(skuReadTransactions_(cfg), cfg);

  let audit = skuValidateSourceTransactions_(txs, cfg, runId);
  const master = skuReadMaster_();
  const aliases = skuReadAliases_();
  const unitOverrides = skuReadUnitOverrides_(cfg);
  const rr = skuResolveTransactions_(txs, aliases, master, unitOverrides, cfg, runId);
  audit = audit.concat(rr.audit);

  skuWriteAudit_(audit);
  const errors = skuCountAuditErrors_(audit);

  skuSetStatusToast_(
    errors ? ('FAIL: ' + errors + ' lỗi. Xem SKU_AUDIT.') : ('PASS: ' + rr.resolved.length + ' giao dịch đã resolve SKU.'),
    'SKU Mapping'
  );
  return {runId: runId, transactions: txs.length, resolved: rr.resolved.length, errors: errors};
}



/**
 * Build review candidates for aliases that appear to describe the same physical SKU.
 *
 * Safety:
 * - This function NEVER changes SKU_ALIAS or SKU_MASTER.
 * - SAFE_FORMAT_EQUIVALENT is only a merge candidate, not an automatic merge.
 * - "ly" vs "mm" and suspicious m/mm differences are review-only.
 */
function skuEngineBuildMergeReview() {
  const runId = skuNewRunId_();
  const aliasSh = skuRequireSheet_(SKU_ENGINE.SHEETS.ALIAS);
  const outSh = skuRequireSheet_(SKU_ENGINE.SHEETS.MERGE_REVIEW);

  if (aliasSh.getLastRow() < 2) {
    throw new Error('SKU_MERGE_REVIEW_ALIAS_EMPTY');
  }

  const values = aliasSh.getDataRange().getValues();
  const h = skuHeaderMap_(values[0]);
  ['AliasKey','GroupCode','RawName','NormalizedName','SKU','Status','SourceRows']
    .forEach(name => {
      if (typeof h[name] === 'undefined') {
        throw new Error('SKU_MERGE_ALIAS_HEADER_MISSING:' + name);
      }
    });

  const items = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const aliasKey = String(r[h.AliasKey] || '').trim();
    const group = skuNormalizeGroup_(r[h.GroupCode]);
    const rawName = String(r[h.RawName] || '').trim();
    const sku = String(r[h.SKU] || '').trim();
    const status = String(r[h.Status] || '').trim().toUpperCase();
    const sourceRows = String(r[h.SourceRows] || '').trim();

    if (!aliasKey || !group || !rawName || !sku) continue;
    if (status === 'REJECTED' || status === 'MISSING_NAME') continue;

    const ambiguity = skuClassifyNameAmbiguity_(rawName, skuNormalizeName_(rawName), group);
    if (ambiguity.blocked) continue;

    const sig = skuMergeSignature_(group, rawName);

    items.push({
      row: i + 1,
      aliasKey: aliasKey,
      group: group,
      rawName: rawName,
      sku: sku,
      status: status,
      sourceRows: sourceRows,
      strictSignature: sig.strict,
      looseUnitSignature: sig.looseUnit,
      typoCompareSignature: sig.typoCompare,
      hasLy: sig.hasLy,
      hasSingleM: sig.hasSingleM,
      hadProfileWordRemoved: sig.hadProfileWordRemoved,
      hadTrailingMmRemoved: sig.hadTrailingMmRemoved
    });
  }

  const output = [];
  const emittedKeys = {};

  // Tier 1: formatting-only equivalence.
  const strictGroups = skuGroupMergeItems_(items, 'strictSignature');
  Object.keys(strictGroups).sort().forEach(signature => {
    const groupItems = strictGroups[signature];
    if (groupItems.length < 2) return;

    const uniqueAliases = {};
    groupItems.forEach(x => uniqueAliases[x.aliasKey] = true);
    if (Object.keys(uniqueAliases).length < 2) return;

    const target = skuChooseMergeTarget_(groupItems);
    const approvedSkus = {};
    groupItems
      .filter(x => x.status === 'APPROVED')
      .forEach(x => approvedSkus[x.sku] = true);

    const currentSkus = {};
    groupItems.forEach(x => currentSkus[x.sku] = true);
    const alreadyMerged = Object.keys(currentSkus).length === 1;

    const approvedConflict = Object.keys(approvedSkus).length > 1;
    const classification = alreadyMerged
      ? 'ALREADY_MERGED'
      : (approvedConflict ? 'BLOCKED_APPROVED_SKU_CONFLICT' : 'SAFE_FORMAT_EQUIVALENT');
    const action = alreadyMerged
      ? 'NO_ACTION'
      : (approvedConflict ? 'REVIEW_MANUALLY' : 'MERGE_CANDIDATE');
    const confidence = alreadyMerged ? 1 : (approvedConflict ? 0 : 0.99);

    let reason = alreadyMerged
      ? 'Các alias tương đương đã cùng trỏ về một TargetSKU.'
      : 'Tên khác cách ghi nhưng cùng signature vật tư sau chuẩn hóa an toàn ' +
        '(khoảng trắng/đuôi mm và tiền tố "Thép hình" trước profile khi phù hợp).';
    if (approvedConflict) {
      reason =
        'Có nhiều SKU khác nhau đã APPROVED trong cùng signature. Không được tự gộp.';
    }

    const mergeKey = 'FMT_' + skuDigest8_(groupItems[0].group + '|' + signature);
    emittedKeys[mergeKey] = true;

    output.push(skuMergeReviewRow_(
      mergeKey, groupItems[0].group, signature, classification, confidence,
      target.sku, groupItems, reason, action, runId,
      'Không retire SKU_MASTER trùng ở bước review.'
    ));
  });

  // Tier 2: "ly" vs "mm" - common steel shorthand, but never auto-merge.
  const looseGroups = skuGroupMergeItems_(items, 'looseUnitSignature');
  Object.keys(looseGroups).sort().forEach(signature => {
    const groupItems = looseGroups[signature];
    if (groupItems.length < 2) return;

    const hasLy = groupItems.some(x => x.hasLy);
    const hasNonLy = groupItems.some(x => !x.hasLy);
    if (!hasLy || !hasNonLy) return;

    const mergeKey = 'UNIT_' + skuDigest8_(groupItems[0].group + '|' + signature);
    if (emittedKeys[mergeKey]) return;

    const target = skuChooseMergeTarget_(groupItems);
    output.push(skuMergeReviewRow_(
      mergeKey, groupItems[0].group, signature,
      'POSSIBLE_UNIT_SYNONYM', 0.75, target.sku, groupItems,
      '"ly" thường được dùng như mm trong ngành thép, nhưng engine không tự coi là tương đương.',
      'REVIEW_MANUALLY', runId,
      'Chỉ merge sau khi xác nhận quy cách thực tế.'
    ));
  });

  // Tier 3: suspicious trailing single "m" versus "mm", e.g. 6000m vs 6000mm.
  const typoGroups = skuGroupMergeItems_(items, 'typoCompareSignature');
  Object.keys(typoGroups).sort().forEach(signature => {
    const groupItems = typoGroups[signature];
    if (groupItems.length < 2) return;

    const hasSingleM = groupItems.some(x => x.hasSingleM);
    const hasNormal = groupItems.some(x => !x.hasSingleM);
    if (!hasSingleM || !hasNormal) return;

    const target = skuChooseMergeTarget_(groupItems.filter(x => !x.hasSingleM));
    const mergeKey = 'TYPO_' + skuDigest8_(groupItems[0].group + '|' + signature);

    const currentSkus = {};
    groupItems.forEach(x => currentSkus[x.sku] = true);
    const alreadyMerged = Object.keys(currentSkus).length === 1;

    output.push(skuMergeReviewRow_(
      mergeKey, groupItems[0].group, signature,
      alreadyMerged ? 'ALREADY_MERGED_VERIFIED_TYPO' : 'SUSPECT_LENGTH_UNIT_TYPO',
      alreadyMerged ? 1 : 0.40,
      target.sku, groupItems,
      alreadyMerged
        ? 'Biến thể m/mm đã được xác minh bằng ledger và đã cùng trỏ về một TargetSKU.'
        : 'Có biến thể kết thúc bằng m và biến thể mm. Với chiều dài 6000, đây có thể là lỗi nhập đơn vị nhưng không được tự sửa.',
      alreadyMerged ? 'NO_ACTION' : 'REVIEW_MANUALLY',
      runId,
      alreadyMerged
        ? 'Đã merge sau khi đối chiếu NHAP/XUAT 483.80kg cùng ngày 2025-11-10.'
        : 'Cần đối chiếu chứng từ/tên hàng gốc.'
    ));
  });

  const headers = [
    'MergeKey','GroupCode','Signature','Classification','Confidence','TargetSKU',
    'AliasKeys','RawNames','CurrentSKUs','Statuses','Reason','Action','RunId','Notes'
  ];

  outSh.clearContents();
  outSh.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (output.length) {
    outSh.getRange(2, 1, output.length, headers.length).setValues(output);
  }
  outSh.setFrozenRows(1);
  SpreadsheetApp.flush();

  const safe = output.filter(r => r[3] === 'SAFE_FORMAT_EQUIVALENT').length;
  const synonym = output.filter(r => r[3] === 'POSSIBLE_UNIT_SYNONYM').length;
  const typo = output.filter(r => r[3] === 'SUSPECT_LENGTH_UNIT_TYPO').length;
  const conflicts = output.filter(r => r[3] === 'BLOCKED_APPROVED_SKU_CONFLICT').length;
  const alreadyMerged = output.filter(r =>
    r[3] === 'ALREADY_MERGED' || r[3] === 'ALREADY_MERGED_VERIFIED_TYPO'
  ).length;

  const result = {
    runId: runId,
    candidates: output.length,
    safeFormatEquivalent: safe,
    possibleUnitSynonym: synonym,
    suspectLengthUnitTypo: typo,
    approvedSkuConflicts: conflicts,
    alreadyMerged: alreadyMerged,
    appliedNow: 0
  };

  Logger.log(JSON.stringify(result));
  skuSetStatusToast_(
    'MERGE candidates=' + output.length +
    '; SAFE=' + safe +
    '; UNIT=' + synonym +
    '; TYPO=' + typo +
    '; CONFLICT=' + conflicts +
    '; ALREADY=' + alreadyMerged +
    '. Chưa merge dòng nào.',
    'SKU Merge Review V1.1.7'
  );
  return result;
}

function skuMergeSignature_(group, rawName) {
  let norm = skuNormalizeName_(rawName);
  const original = norm;

  // Normalize "10 MM" -> "10MM".
  norm = norm.replace(/(\d)\s+MM\b/g, '$1MM');

  // "Thép hình U100x6000" and "Thép U100x6000mm" are formatting variants
  // only when a structural profile token is immediately followed by a number.
  const beforeProfile = norm;
  norm = norm.replace(/^THEP HINH ([UIVHC])(?=\d)/, 'THEP $1');
  const hadProfileWordRemoved = norm !== beforeProfile;

  // Normalize decimal .0 in dimensional tokens.
  norm = norm.replace(/(\d+)\.0(?=X|MM\b|$)/g, '$1');

  const hasLy = /\b\d+(?:\.\d+)?LY\b/.test(norm);
  const hasSingleM = /X\d+(?:\.\d+)?M$/.test(norm) && !/MM$/.test(norm);

  // If the name clearly contains a dimension chain, terminal mm is only notation.
  const beforeMm = norm;
  if (/X\d+(?:\.\d+)?MM$/.test(norm)) {
    norm = norm.replace(/MM$/, '');
  }
  const hadTrailingMmRemoved = norm !== beforeMm;

  const strict = group + '|' + norm;

  // Review-only loose signature: LY -> MM, then apply the same terminal-unit rule.
  let loose = original
    .replace(/(\d)\s+MM\b/g, '$1MM')
    .replace(/^THEP HINH ([UIVHC])(?=\d)/, 'THEP $1')
    .replace(/(\d+)\.0(?=X|MM\b|LY\b|$)/g, '$1')
    .replace(/(\d+(?:\.\d+)?)LY\b/g, '$1MM');
  if (/X\d+(?:\.\d+)?MM$/.test(loose)) {
    loose = loose.replace(/MM$/, '');
  }

  // Review-only typo signature: terminal single M is compared as though unit suffix were absent.
  let typo = norm;
  if (hasSingleM) {
    typo = typo.replace(/M$/, '');
  }

  return {
    strict: strict,
    looseUnit: group + '|' + loose,
    typoCompare: group + '|' + typo,
    hasLy: hasLy,
    hasSingleM: hasSingleM,
    hadProfileWordRemoved: hadProfileWordRemoved,
    hadTrailingMmRemoved: hadTrailingMmRemoved
  };
}

function skuGroupMergeItems_(items, field) {
  const groups = {};
  items.forEach(item => {
    const key = String(item[field] || '').trim();
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

function skuChooseMergeTarget_(items) {
  if (!items || !items.length) return {sku: ''};

  const approved = items.filter(x => x.status === 'APPROVED');
  const approvedSkus = {};
  approved.forEach(x => approvedSkus[x.sku] = true);

  if (Object.keys(approvedSkus).length === 1) {
    return approved[0];
  }

  return items.slice().sort((a, b) => {
    function score(x) {
      let s = 0;
      if (x.status === 'APPROVED') s += 1000;
      if (/MM\b/i.test(x.rawName)) s += 100;
      if (/X\d/i.test(x.rawName)) s += 20;
      s += Math.min(String(x.rawName || '').length, 80) / 100;
      return s;
    }
    const delta = score(b) - score(a);
    if (Math.abs(delta) > 1e-9) return delta;
    return String(a.sku).localeCompare(String(b.sku));
  })[0];
}

function skuMergeReviewRow_(
  mergeKey, group, signature, classification, confidence,
  targetSku, items, reason, action, runId, notes
) {
  return [
    mergeKey,
    group,
    signature,
    classification,
    confidence,
    targetSku,
    items.map(x => x.aliasKey).join(' || '),
    items.map(x => x.rawName).join(' || '),
    items.map(x => x.sku).join(' || '),
    items.map(x => x.status).join(' || '),
    reason,
    action,
    runId,
    notes || ''
  ];
}

function skuAssessAliasUnitRisk_(txList, unitOverrides, cfg) {
  unitOverrides = unitOverrides || {};
  const units = {};
  let overrideCount = 0;
  let pendingOverrideCount = 0;
  const pendingRows = [];

  txList.forEach(tx => {
    const ov = unitOverrides[tx.row];
    if (!ov) return;
    overrideCount++;

    if (ov.status !== 'APPROVED') {
      pendingOverrideCount++;
      pendingRows.push(tx.row);
      if (ov.transactionUnit) units[ov.transactionUnit] = true;
      return;
    }

    if (ov.transactionUnit) units[ov.transactionUnit] = true;
  });

  const unitList = Object.keys(units);
  if (pendingOverrideCount > 0) {
    return {
      blocked: true,
      code: 'BLOCKED_UNIT_OVERRIDE_PENDING',
      priceRatio: null,
      reason:
        'Có ' + pendingOverrideCount +
        ' dòng đã xác định dấu hiệu ĐVT nhưng override chưa APPROVED: ' +
        pendingRows.join(',') + '.'
    };
  }

  if (cfg.blockMixedUnits && unitList.length > 1) {
    return {
      blocked: true,
      code: 'BLOCKED_UNIT_CONFLICT',
      priceRatio: null,
      reason: 'Cùng alias có nhiều TransactionUnit đã xác nhận: ' + unitList.join(', ') + '.'
    };
  }

  const nhapPrices = txList
    .filter(tx => tx.type === 'NHAP' && isFinite(tx.inputUnitPrice) && tx.inputUnitPrice > 0)
    .map(tx => tx.inputUnitPrice);

  if (nhapPrices.length >= 2) {
    const minPrice = Math.min.apply(null, nhapPrices);
    const maxPrice = Math.max.apply(null, nhapPrices);
    const ratio = minPrice > 0 ? maxPrice / minPrice : Infinity;

    if (ratio >= cfg.unitPriceAnomalyRatio) {
      return {
        blocked: true,
        code: 'BLOCKED_UNIT_PRICE_ANOMALY',
        priceRatio: ratio,
        reason:
          'Đơn giá NHAP cùng alias chênh bất thường max/min=' +
          skuRound_(ratio, 4) +
          ' ≥ ngưỡng ' + cfg.unitPriceAnomalyRatio +
          '. Đây chỉ là guard nghi ngờ khác ĐVT/quy cách; engine không tự suy ra đơn vị từ giá.'
      };
    }
  }

  return {
    blocked: false,
    code: '',
    priceRatio: null,
    reason: '',
    overrideCount: overrideCount,
    units: unitList
  };
}


/**
 * Build alias-level and TargetSKU-level transaction indexes for auto classification.
 *
 * TargetSKU aggregation is intentionally conservative:
 * - only aliases already pointing to the same SKU are aggregated;
 * - alias must be non-ambiguous;
 * - group must match SKU_MASTER;
 * - REJECTED/MISSING_NAME aliases are excluded;
 * - a SKU needs at least 2 eligible aliases before aggregate evidence can be used.
 */
function skuBuildAutoEvidenceContext_(txs, aliasValues, ah, masterBySku) {
  const aliasMeta = {};
  const eligibleAliasKeysBySku = {};

  for (let i = 1; i < aliasValues.length; i++) {
    const r = aliasValues[i];
    const key = String(r[ah.AliasKey] || '').trim();
    if (!key) continue;

    const group = skuNormalizeGroup_(r[ah.GroupCode]);
    const rawName = String(r[ah.RawName] || '').trim();
    const normalizedName = String(r[ah.NormalizedName] || '').trim();
    const sku = String(r[ah.SKU] || '').trim();
    const status = String(r[ah.Status] || '').trim().toUpperCase();
    const master = masterBySku[sku];

    const ambiguity = skuClassifyNameAmbiguity_(rawName, normalizedName, group);
    const eligible =
      !!sku &&
      status !== 'REJECTED' &&
      status !== 'MISSING_NAME' &&
      !!master &&
      master.group === group &&
      master.status !== 'RETIRED' &&
      master.isActive !== false &&
      !ambiguity.blocked;

    aliasMeta[key] = {
      key: key,
      group: group,
      rawName: rawName,
      normalizedName: normalizedName,
      sku: sku,
      status: status,
      eligibleForSkuAggregate: eligible
    };

    if (eligible) {
      if (!eligibleAliasKeysBySku[sku]) eligibleAliasKeysBySku[sku] = {};
      eligibleAliasKeysBySku[sku][key] = true;
    }
  }

  const byAlias = {};
  const bySku = {};

  txs.forEach(tx => {
    const key = skuAliasKey_(tx.group, tx.rawName);
    if (!byAlias[key]) byAlias[key] = [];
    byAlias[key].push(tx);

    const meta = aliasMeta[key];
    if (!meta || !meta.eligibleForSkuAggregate) return;
    if (!eligibleAliasKeysBySku[meta.sku] || !eligibleAliasKeysBySku[meta.sku][key]) return;

    if (!bySku[meta.sku]) bySku[meta.sku] = [];
    bySku[meta.sku].push(tx);
  });

  const aliasCountBySku = {};
  Object.keys(eligibleAliasKeysBySku).forEach(sku => {
    aliasCountBySku[sku] = Object.keys(eligibleAliasKeysBySku[sku]).length;
  });

  return {
    aliasMeta: aliasMeta,
    byAlias: byAlias,
    bySku: bySku,
    eligibleAliasKeysBySku: eligibleAliasKeysBySku,
    aliasCountBySku: aliasCountBySku
  };
}

/**
 * SKU Engine V1.1.7 - high-confidence SKU auto classification.
 *
 * FIX V1.1.2:
 * - Technical classifications NEVER write into SKU_ALIAS.Status or SKU_MASTER.Status.
 * - SKU_ALIAS.Status remains limited to:
 *   REVIEW_REQUIRED, APPROVED, REJECTED, MISSING_NAME.
 * - SKU_MASTER.Status remains limited to:
 *   DRAFT, APPROVED, RETIRED.
 * - All technical states live only in SKU_AUTO_REVIEW.
 * - Approval re-validates each candidate against CURRENT source data before writing APPROVED.
 *
 * PRICE NOTE:
 * "Đơn giá" on Nhap-Xuat XUAT is inventory cost, not invoice sales price.
 * Therefore XUAT price > NHAP price is NOT used as a hard gate.
 */

function skuEngineAutoClassifyMappings() {
  const cfg = skuCfg_();
  const runId = skuNewRunId_();

  const aliasSh = skuRequireSheet_(SKU_ENGINE.SHEETS.ALIAS);
  const masterSh = skuRequireSheet_(SKU_ENGINE.SHEETS.MASTER);
  const reviewSh = skuRequireSheet_(SKU_ENGINE.SHEETS.AUTO_REVIEW);

  const aliasLastRow = aliasSh.getLastRow();
  const masterLastRow = masterSh.getLastRow();

  if (aliasLastRow < 2) throw new Error('SKU_AUTO_CLASSIFY_ALIAS_EMPTY:lastRow=' + aliasLastRow);
  if (masterLastRow < 2) throw new Error('SKU_AUTO_CLASSIFY_MASTER_EMPTY:lastRow=' + masterLastRow);

  const aliasValues = aliasSh.getRange(1, 1, aliasLastRow, 10).getValues();
  const masterValues = masterSh.getRange(1, 1, masterLastRow, 12).getValues();
  const ah = skuHeaderMap_(aliasValues[0]);
  const mh = skuHeaderMap_(masterValues[0]);

  const masterBySku = {};
  for (let i = 1; i < masterValues.length; i++) {
    const sku = String(masterValues[i][mh.SKU] || '').trim();
    if (!sku) continue;
    masterBySku[sku] = {
      index: i,
      group: skuNormalizeGroup_(masterValues[i][mh.GroupCode]),
      status: String(masterValues[i][mh.Status] || '').trim().toUpperCase(),
      unit: String(masterValues[i][mh.Unit] || cfg.defaultBaseUnit || 'KG').trim().toUpperCase(),
      isActive: skuBool_(masterValues[i][mh.IsActive], true)
    };
  }

  const txs = skuScopeTransactions_(skuReadTransactions_(cfg), cfg);
  if (!txs.length) throw new Error('SKU_AUTO_CLASSIFY_SOURCE_EMPTY');

  const unitOverrides = skuReadUnitOverrides_(cfg);
  const ctx = skuBuildAutoEvidenceContext_(txs, aliasValues, ah, masterBySku);

  const reviewRows = [];
  let aliasCount = 0;

  for (let i = 1; i < aliasValues.length; i++) {
    const r = aliasValues[i];
    const key = String(r[ah.AliasKey] || '').trim();
    if (!key) continue;
    aliasCount++;

    const group = skuNormalizeGroup_(r[ah.GroupCode]);
    const rawName = String(r[ah.RawName] || '').trim();
    const normalizedName = String(r[ah.NormalizedName] || '').trim();
    const sku = String(r[ah.SKU] || '').trim();
    const currentStatus = String(r[ah.Status] || '').trim().toUpperCase();

    const txList = (ctx.byAlias[key] || []).slice().sort((a, b) => {
      const dt = a.date.getTime() - b.date.getTime();
      return dt || (a.row - b.row);
    });
    const skuTxList = (ctx.bySku[sku] || []).slice().sort((a, b) => {
      const dt = a.date.getTime() - b.date.getTime();
      return dt || (a.row - b.row);
    });
    const skuAliasCount = ctx.aliasCountBySku[sku] || 0;
    const master = masterBySku[sku];

    if (currentStatus === 'APPROVED') {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'ALREADY_APPROVED', 1, 0, '', '', '', '',
        'NOT_APPLICABLE_COST_LEDGER',
        'Alias đã APPROVED trước đó; classifier không thay đổi.',
        'NO_ACTION', runId
      ]);
      continue;
    }

    if (currentStatus === 'REJECTED') {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'ALREADY_REJECTED', 0, 0, '', '', '', '',
        'NOT_APPLICABLE_COST_LEDGER',
        'Alias đã REJECTED; classifier không tự mở lại.',
        'NO_ACTION', runId
      ]);
      continue;
    }

    if (!master) {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'BLOCKED_MASTER_MISSING', 0, 0, '', '', '', '',
        'NOT_APPLICABLE_COST_LEDGER',
        'SKU_ALIAS trỏ tới SKU không tồn tại trong SKU_MASTER.',
        'REVIEW_MANUALLY', runId
      ]);
      continue;
    }

    if (master.group !== group) {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'BLOCKED_GROUP_MISMATCH', 0, 0, '', '', '', '',
        'NOT_APPLICABLE_COST_LEDGER',
        'GroupCode alias=' + group + ' nhưng SKU_MASTER=' + master.group + '.',
        'REVIEW_MANUALLY', runId
      ]);
      continue;
    }

    if (master.status === 'RETIRED' || master.isActive === false) {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'BLOCKED_MASTER_RETIRED', 0, 0, '', '', '', '',
        'NOT_APPLICABLE_COST_LEDGER',
        'Alias đang trỏ tới SKU_MASTER RETIRED/inactive.',
        'REVIEW_MANUALLY', runId
      ]);
      continue;
    }

    const ambiguity = skuClassifyNameAmbiguity_(rawName, normalizedName, group);
    if (ambiguity.blocked) {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'BLOCKED_AMBIGUOUS', 0, 0, '', '', '', '',
        'NOT_APPLICABLE_COST_LEDGER',
        ambiguity.reason,
        'REVIEW_MANUALLY', runId
      ]);
      continue;
    }

    if (!txList.length) {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'OUTSIDE_CUTOVER_SCOPE', 0.25, 0, '', '', '', '',
        'NOT_APPLICABLE_COST_LEDGER',
        'Alias có trong lịch sử nhưng không có giao dịch từ cutover hiện tại.',
        'NO_ACTION', runId
      ]);
      continue;
    }

    const aliasUnitRisk = skuAssessAliasUnitRisk_(txList, unitOverrides, cfg);
    if (aliasUnitRisk.blocked) {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        aliasUnitRisk.code, 0, 0, '', '', '',
        aliasUnitRisk.priceRatio === null ? '' : skuRound_(aliasUnitRisk.priceRatio, 4),
        'UNIT_GUARD',
        aliasUnitRisk.reason,
        'REVIEW_MANUALLY', runId
      ]);
      continue;
    }

    const aliasEvidence = skuFindFlowEvidence_(txList, cfg);

    // First preference: direct evidence inside this exact alias.
    if (aliasEvidence.count >= cfg.autoApproveMinEvidence && aliasEvidence.count > 0) {
      reviewRows.push([
        key, group, rawName, normalizedName, sku,
        'HIGH_CONFIDENCE', cfg.autoCandidateConfidence, aliasEvidence.count,
        aliasEvidence.nhapRows.join(','), aliasEvidence.xuatRows.join(','),
        aliasEvidence.matchedQty,
        aliasEvidence.daysGap === null ? '' : aliasEvidence.daysGap,
        'UNIT_GUARD_PASS',
        'Có ' + aliasEvidence.count +
          ' bằng chứng NHAP↔XUAT trực tiếp trong cùng AliasKey; đã qua guard ĐVT.',
        'APPROVE_CANDIDATE', runId
      ]);
      continue;
    }

    // Second preference: aggregate only aliases that have already been consolidated to
    // the same TargetSKU and remain non-ambiguous.
    if (skuAliasCount >= 2 && skuTxList.length > txList.length) {
      const skuUnitRisk = skuAssessAliasUnitRisk_(skuTxList, unitOverrides, cfg);

      if (!skuUnitRisk.blocked) {
        const skuEvidence = skuFindFlowEvidence_(skuTxList, cfg);

        if (skuEvidence.count >= cfg.autoApproveMinEvidence && skuEvidence.count > 0) {
          reviewRows.push([
            key, group, rawName, normalizedName, sku,
            'HIGH_CONFIDENCE_SKU_AGGREGATE',
            Math.min(cfg.autoCandidateConfidence, 0.95),
            skuEvidence.count,
            skuEvidence.nhapRows.join(','),
            skuEvidence.xuatRows.join(','),
            skuEvidence.matchedQty,
            skuEvidence.daysGap === null ? '' : skuEvidence.daysGap,
            'SKU_AGGREGATE_UNIT_GUARD_PASS',
            'Alias riêng chưa đủ evidence, nhưng ' + skuAliasCount +
              ' alias đã cùng trỏ TargetSKU=' + sku +
              ' tạo ' + skuEvidence.count +
              ' bằng chứng NHAP↔XUAT ở cấp SKU. Không dùng tên generic/REJECTED/RETIRED.',
            'APPROVE_CANDIDATE', runId
          ]);
          continue;
        }
      } else {
        reviewRows.push([
          key, group, rawName, normalizedName, sku,
          'BLOCKED_SKU_AGGREGATE_UNIT_RISK', 0, 0, '', '', '',
          skuUnitRisk.priceRatio === null ? '' : skuRound_(skuUnitRisk.priceRatio, 4),
          'SKU_AGGREGATE_UNIT_GUARD',
          'Alias riêng không lỗi nhưng TargetSKU aggregate bị chặn: ' + skuUnitRisk.reason,
          'REVIEW_MANUALLY', runId
        ]);
        continue;
      }
    }

    reviewRows.push([
      key, group, rawName, normalizedName, sku,
      'REVIEW_REQUIRED', 0.50,
      aliasEvidence.count || 0,
      aliasEvidence.nhapRows.join(','),
      aliasEvidence.xuatRows.join(','),
      aliasEvidence.matchedQty || '',
      aliasEvidence.daysGap === null ? '' : aliasEvidence.daysGap,
      'UNIT_GUARD_PASS',
      'Chưa có đủ evidence trực tiếp theo AliasKey hoặc evidence aggregate theo TargetSKU.',
      'REVIEW_MANUALLY', runId
    ]);
  }

  if (!aliasCount || !reviewRows.length) {
    throw new Error('SKU_AUTO_CLASSIFY_INTERNAL_EMPTY');
  }

  const headers = [
    'AliasKey','GroupCode','RawName','NormalizedName','SKU','Classification',
    'Confidence','EvidenceCount','NhapRows','XuatRows','MatchedQty','DaysGap',
    'PriceCheck','Reason','Action','RunId'
  ];

  reviewSh.clearContents();
  reviewSh.getRange(1, 1, 1, headers.length).setValues([headers]);
  reviewSh.getRange(2, 1, reviewRows.length, headers.length).setValues(reviewRows);
  reviewSh.setFrozenRows(1);
  SpreadsheetApp.flush();

  const highAlias = reviewRows.filter(r => r[5] === 'HIGH_CONFIDENCE').length;
  const highSkuAggregate = reviewRows.filter(r => r[5] === 'HIGH_CONFIDENCE_SKU_AGGREGATE').length;
  const high = highAlias + highSkuAggregate;
  const blocked = reviewRows.filter(r => String(r[5]).indexOf('BLOCKED_') === 0).length;
  const review = reviewRows.filter(r => r[5] === 'REVIEW_REQUIRED').length;
  const already = reviewRows.filter(r => r[5] === 'ALREADY_APPROVED').length;

  const result = {
    runId: runId,
    aliases: aliasCount,
    scopedTransactions: txs.length,
    highConfidence: high,
    highConfidenceAlias: highAlias,
    highConfidenceSkuAggregate: highSkuAggregate,
    blocked: blocked,
    reviewRequired: review,
    alreadyApproved: already,
    approvedNow: 0
  };

  Logger.log(JSON.stringify(result));
  skuSetStatusToast_(
    'HIGH=' + high +
    ' (ALIAS=' + highAlias + ', SKU=' + highSkuAggregate + ')' +
    '; BLOCKED=' + blocked +
    '; REVIEW=' + review +
    '; APPROVED=' + already + '.',
    'SKU Auto Classify V1.1.7'
  );
  return result;
}

function skuEngineApproveHighConfidence() {
  const cfg = skuCfg_();
  const reviewSh = skuRequireSheet_(SKU_ENGINE.SHEETS.AUTO_REVIEW);
  const aliasSh = skuRequireSheet_(SKU_ENGINE.SHEETS.ALIAS);
  const masterSh = skuRequireSheet_(SKU_ENGINE.SHEETS.MASTER);

  if (reviewSh.getLastRow() < 2) {
    throw new Error('SKU_AUTO_REVIEW_EMPTY_RUN_CLASSIFY_FIRST');
  }

  const reviewValues = reviewSh.getDataRange().getValues();
  const rh = skuHeaderMap_(reviewValues[0]);
  const aliasValues = aliasSh.getDataRange().getValues();
  const masterValues = masterSh.getDataRange().getValues();
  const ah = skuHeaderMap_(aliasValues[0]);
  const mh = skuHeaderMap_(masterValues[0]);

  const masterBySku = {};
  const masterIndexBySku = {};
  for (let i = 1; i < masterValues.length; i++) {
    const sku = String(masterValues[i][mh.SKU] || '').trim();
    if (!sku) continue;

    masterIndexBySku[sku] = i;
    masterBySku[sku] = {
      index: i,
      group: skuNormalizeGroup_(masterValues[i][mh.GroupCode]),
      status: String(masterValues[i][mh.Status] || '').trim().toUpperCase(),
      unit: String(masterValues[i][mh.Unit] || cfg.defaultBaseUnit || 'KG').trim().toUpperCase(),
      isActive: skuBool_(masterValues[i][mh.IsActive], true)
    };
  }

  const txs = skuScopeTransactions_(skuReadTransactions_(cfg), cfg);
  const unitOverrides = skuReadUnitOverrides_(cfg);
  const ctx = skuBuildAutoEvidenceContext_(txs, aliasValues, ah, masterBySku);

  const reviewCandidateByKey = {};
  for (let i = 1; i < reviewValues.length; i++) {
    const r = reviewValues[i];
    const classification = String(r[rh.Classification] || '').trim();
    const action = String(r[rh.Action] || '').trim();

    if (classification !== 'HIGH_CONFIDENCE' &&
        classification !== 'HIGH_CONFIDENCE_SKU_AGGREGATE') {
      continue;
    }
    if (action !== 'APPROVE_CANDIDATE') continue;

    const key = String(r[rh.AliasKey] || '').trim();
    const sku = String(r[rh.SKU] || '').trim();
    if (key && sku) {
      reviewCandidateByKey[key] = {
        sku: sku,
        classification: classification
      };
    }
  }

  if (!Object.keys(reviewCandidateByKey).length) {
    throw new Error('SKU_AUTO_REVIEW_NO_HIGH_CONFIDENCE_CANDIDATES');
  }

  const aliasStatus = aliasValues.slice(1).map(r => [r[ah.Status]]);
  const aliasConfidence = aliasValues.slice(1).map(r => [r[ah.Confidence]]);
  const aliasNotes = aliasValues.slice(1).map(r => [r[ah.Notes]]);
  const masterStatus = masterValues.slice(1).map(r => [r[mh.Status]]);
  const masterNotes = masterValues.slice(1).map(r => [r[mh.Notes]]);
  const masterActive = masterValues.slice(1).map(r => [r[mh.IsActive]]);

  let aliasApproved = 0;
  let aggregateApproved = 0;
  const approvedSku = {};
  const skipped = [];

  for (let i = 1; i < aliasValues.length; i++) {
    const r = aliasValues[i];
    const key = String(r[ah.AliasKey] || '').trim();
    const candidate = reviewCandidateByKey[key];
    if (!candidate) continue;

    const currentSku = String(r[ah.SKU] || '').trim();
    const currentStatus = String(r[ah.Status] || '').trim().toUpperCase();
    const group = skuNormalizeGroup_(r[ah.GroupCode]);
    const rawName = String(r[ah.RawName] || '').trim();
    const normalizedName = String(r[ah.NormalizedName] || '').trim();

    if (currentSku !== candidate.sku) {
      skipped.push(key + ':SKU_CHANGED');
      continue;
    }
    if (currentStatus !== 'REVIEW_REQUIRED') {
      skipped.push(key + ':STATUS=' + currentStatus);
      continue;
    }

    const master = masterBySku[currentSku];
    if (!master) {
      skipped.push(key + ':MASTER_MISSING');
      continue;
    }
    if (master.group !== group) {
      skipped.push(key + ':MASTER_GROUP_CHANGED');
      continue;
    }
    if (master.status !== 'DRAFT' && master.status !== 'APPROVED') {
      skipped.push(key + ':MASTER_STATUS=' + master.status);
      continue;
    }
    if (master.isActive === false) {
      skipped.push(key + ':MASTER_INACTIVE');
      continue;
    }

    const ambiguity = skuClassifyNameAmbiguity_(rawName, normalizedName, group);
    if (ambiguity.blocked) {
      skipped.push(key + ':NOW_AMBIGUOUS');
      continue;
    }

    const txList = (ctx.byAlias[key] || []).slice();
    if (!txList.length) {
      skipped.push(key + ':NO_SCOPED_TX');
      continue;
    }

    const aliasUnitRisk = skuAssessAliasUnitRisk_(txList, unitOverrides, cfg);
    if (aliasUnitRisk.blocked) {
      skipped.push(key + ':' + aliasUnitRisk.code);
      continue;
    }

    const aliasEvidence = skuFindFlowEvidence_(txList, cfg);
    let approvedBy = '';

    if (aliasEvidence.count >= cfg.autoApproveMinEvidence && aliasEvidence.count > 0) {
      approvedBy = 'ALIAS';
    } else if (candidate.classification === 'HIGH_CONFIDENCE_SKU_AGGREGATE') {
      const skuAliasCount = ctx.aliasCountBySku[currentSku] || 0;
      const skuTxList = (ctx.bySku[currentSku] || []).slice();

      if (skuAliasCount < 2 || skuTxList.length <= txList.length) {
        skipped.push(key + ':SKU_AGGREGATE_CONTEXT_CHANGED');
        continue;
      }

      const skuUnitRisk = skuAssessAliasUnitRisk_(skuTxList, unitOverrides, cfg);
      if (skuUnitRisk.blocked) {
        skipped.push(key + ':SKU_' + skuUnitRisk.code);
        continue;
      }

      const skuEvidence = skuFindFlowEvidence_(skuTxList, cfg);
      if (skuEvidence.count <= 0 || skuEvidence.count < cfg.autoApproveMinEvidence) {
        skipped.push(key + ':SKU_AGGREGATE_EVIDENCE_CHANGED');
        continue;
      }

      approvedBy = 'SKU_AGGREGATE';
    } else {
      skipped.push(key + ':EVIDENCE_CHANGED');
      continue;
    }

    aliasStatus[i - 1][0] = 'APPROVED';
    aliasConfidence[i - 1][0] = 1;
    aliasNotes[i - 1][0] =
      'V1.1.7 APPROVED: ' +
      (approvedBy === 'SKU_AGGREGATE'
        ? 'TargetSKU aggregate quantity-flow evidence'
        : 'direct AliasKey quantity-flow evidence') +
      ' + unit guard PASS; revalidated at approval.';

    aliasApproved++;
    if (approvedBy === 'SKU_AGGREGATE') aggregateApproved++;
    approvedSku[currentSku] = true;
  }

  Object.keys(approvedSku).forEach(sku => {
    const mi = masterIndexBySku[sku];
    if (!mi) return;

    masterStatus[mi - 1][0] = 'APPROVED';
    masterNotes[mi - 1][0] =
      'V1.1.7 APPROVED: có alias high-confidence đã được revalidate ' +
      '(direct AliasKey hoặc consolidated TargetSKU evidence).';
    masterActive[mi - 1][0] = true;
  });

  aliasSh.getRange(2, ah.Status + 1, aliasStatus.length, 1).setValues(aliasStatus);
  aliasSh.getRange(2, ah.Confidence + 1, aliasConfidence.length, 1).setValues(aliasConfidence);
  aliasSh.getRange(2, ah.Notes + 1, aliasNotes.length, 1).setValues(aliasNotes);

  masterSh.getRange(2, mh.Status + 1, masterStatus.length, 1).setValues(masterStatus);
  masterSh.getRange(2, mh.Notes + 1, masterNotes.length, 1).setValues(masterNotes);
  masterSh.getRange(2, mh.IsActive + 1, masterActive.length, 1).setValues(masterActive);
  SpreadsheetApp.flush();

  const result = {
    aliasesApproved: aliasApproved,
    aggregateAliasesApproved: aggregateApproved,
    skuApproved: Object.keys(approvedSku).length,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, 50)
  };

  Logger.log(JSON.stringify(result));
  skuSetStatusToast_(
    'Đã APPROVED ' + aliasApproved +
    ' alias (' + aggregateApproved + ' qua SKU aggregate) / ' +
    Object.keys(approvedSku).length +
    ' SKU; skipped=' + skipped.length + '.',
    'SKU Approve V1.1.7'
  );
  return result;
}

function skuClassifyNameAmbiguity_(rawName, normalizedName, group) {
  const raw = String(rawName || '').trim();
  const norm = String(normalizedName || skuNormalizeName_(raw)).trim();

  if (!raw || !norm) {
    return {blocked: true, reason: 'Tên hàng trống.'};
  }

  const generic = [
    'THEP HINH',
    'THEP HINH CAC LOAI',
    'THEP TAM',
    'THEP TAM CAC LOAI',
    'THEP HOP',
    'THEP ONG',
    'THEP ONG CAC LOAI',
    'THEP GOC',
    'TON MA'
  ];

  if (generic.indexOf(norm) >= 0 || /\bCAC LOAI\b/.test(norm)) {
    return {
      blocked: true,
      reason: 'Tên hàng generic/các loại, không đủ xác định một SKU.'
    };
  }

  const rawNoDecimalComma = raw.replace(/(\d),(\d)/g, '$1.$2');

  if (/[,;]/.test(rawNoDecimalComma)) {
    return {
      blocked: true,
      reason: 'Tên chứa nhiều quy cách/mặt hàng.'
    };
  }

  if (/\s\/\s/.test(rawNoDecimalComma)) {
    return {
      blocked: true,
      reason: 'Tên chứa nhiều quy cách/mặt hàng phân tách bằng /.'
    };
  }

  if (/\d+(?:[.,]\d+)?\s*(?:mm|ly)?\s*[-–]\s*\d+(?:[.,]\d+)?/i.test(raw)) {
    return {
      blocked: true,
      reason: 'Tên chứa khoảng quy cách, không phải một SKU đơn nhất.'
    };
  }

  return {blocked: false, reason: ''};
}

function skuFindFlowEvidence_(txList, cfg) {
  const byDate = {};

  txList.forEach(tx => {
    if (!tx.date || !isFinite(tx.qty) || tx.qty <= 0) return;
    if (tx.type !== 'NHAP' && tx.type !== 'XUAT') return;

    const d = skuDateKey_(tx.date, cfg.timezone);
    if (!byDate[d]) {
      byDate[d] = {
        date: tx.date,
        NHAP: {qty: 0, rows: []},
        XUAT: {qty: 0, rows: []}
      };
    }

    byDate[d][tx.type].qty += tx.qty;
    byDate[d][tx.type].rows.push(tx.row);
  });

  const days = Object.keys(byDate).sort().map(k => byDate[k]);
  const imports = days.filter(d => d.NHAP.qty > cfg.autoMatchQtyEpsilon);
  const exports = days.filter(d => d.XUAT.qty > cfg.autoMatchQtyEpsilon);

  const usedImport = {};
  let count = 0;
  const nhapRows = [];
  const xuatRows = [];
  let matchedQty = 0;
  let minGap = null;

  exports.forEach(ex => {
    let best = null;
    let bestIndex = -1;

    for (let i = 0; i < imports.length; i++) {
      if (usedImport[i]) continue;

      const im = imports[i];
      const gap = Math.round(
        (ex.date.getTime() - im.date.getTime()) / 86400000
      );

      if (gap < 0 || gap > cfg.autoMatchMaxDays) continue;
      if (Math.abs(im.NHAP.qty - ex.XUAT.qty) > cfg.autoMatchQtyEpsilon) continue;

      if (!best || gap < best.gap) {
        best = {gap: gap, im: im};
        bestIndex = i;
      }
    }

    if (!best) return;

    usedImport[bestIndex] = true;
    count++;
    matchedQty += best.im.NHAP.qty;

    best.im.NHAP.rows.forEach(row => nhapRows.push(row));
    ex.XUAT.rows.forEach(row => xuatRows.push(row));

    if (minGap === null || best.gap < minGap) {
      minGap = best.gap;
    }
  });

  return {
    count: count,
    nhapRows: nhapRows,
    xuatRows: xuatRows,
    matchedQty: skuRound_(matchedQty, 6),
    daysGap: minGap
  };
}

function skuEngineDebugCounts() {
  const cfg = skuCfg_();
  const aliasSh = skuRequireSheet_(SKU_ENGINE.SHEETS.ALIAS);
  const masterSh = skuRequireSheet_(SKU_ENGINE.SHEETS.MASTER);
  const reviewSh = skuRequireSheet_(SKU_ENGINE.SHEETS.AUTO_REVIEW);

  const allTxs = skuReadTransactions_(cfg);
  const scoped = skuScopeTransactions_(allTxs, cfg);
  const unitOverrides = skuReadUnitOverrides_(cfg);

  const aliasValues = aliasSh.getDataRange().getValues();
  const masterValues = masterSh.getDataRange().getValues();
  const ah = skuHeaderMap_(aliasValues[0]);
  const mh = skuHeaderMap_(masterValues[0]);
  const masterBySku = {};
  for (let i = 1; i < masterValues.length; i++) {
    const sku = String(masterValues[i][mh.SKU] || '').trim();
    if (!sku) continue;
    masterBySku[sku] = {
      group: skuNormalizeGroup_(masterValues[i][mh.GroupCode]),
      status: String(masterValues[i][mh.Status] || '').trim().toUpperCase(),
      isActive: skuBool_(masterValues[i][mh.IsActive], true)
    };
  }
  const autoCtx = skuBuildAutoEvidenceContext_(scoped, aliasValues, ah, masterBySku);
  const multiAliasSkuCount = Object.keys(autoCtx.aliasCountBySku)
    .filter(sku => autoCtx.aliasCountBySku[sku] >= 2).length;

  const result = {
    activeSpreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    aliasLastRow: aliasSh.getLastRow(),
    masterLastRow: masterSh.getLastRow(),
    reviewLastRow: reviewSh.getLastRow(),
    mergeReviewLastRow: mergeReviewSh.getLastRow(),
    sourceTransactionsAll: allTxs.length,
    sourceTransactionsScoped: scoped.length,
    cutoverDate: cfg.cutoverDate ? skuDateKey_(cfg.cutoverDate, cfg.timezone) : null,
    autoMatchMaxDays: cfg.autoMatchMaxDays,
    autoMatchQtyEpsilon: cfg.autoMatchQtyEpsilon,
    autoApproveMinEvidence: cfg.autoApproveMinEvidence,
    autoCandidateConfidence: cfg.autoCandidateConfidence,
    unitOverrideCount: Object.keys(unitOverrides).length,
    blockMixedUnits: cfg.blockMixedUnits,
    unitPriceAnomalyRatio: cfg.unitPriceAnomalyRatio,
    multiAliasSkuCount: multiAliasSkuCount
  };

  Logger.log(JSON.stringify(result));
  SpreadsheetApp.getUi().alert(
    'SKU Engine Debug',
    JSON.stringify(result, null, 2),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return result;
}


/**
 * SKU Engine - monthly weighted average costing by SKU.
 * DRY_RUN output only. Does NOT write to Nhap-Xuat or production TonKho.
 */

function skuEngineRunDry() {
  const cfg = skuCfg_();
  if (cfg.runMode !== 'DRY_RUN') {
    throw new Error('SKU_ENGINE_DRY_RUN_REQUIRES_RUN_MODE_DRY_RUN');
  }
  if (cfg.productionWriteEnabled) {
    throw new Error('SKU_ENGINE_DRY_RUN_REFUSES_WHEN_PRODUCTION_WRITE_ENABLED');
  }

  const runId = skuNewRunId_();
  const allTxs = skuReadTransactions_(cfg);
  const txs = skuScopeTransactions_(allTxs, cfg);

  let audit = skuValidateSourceTransactions_(txs, cfg, runId);
  const master = skuReadMaster_();
  const aliases = skuReadAliases_();
  const unitOverrides = skuReadUnitOverrides_(cfg);
  const rr = skuResolveTransactions_(txs, aliases, master, unitOverrides, cfg, runId);
  audit = audit.concat(rr.audit);

  if (skuCountAuditErrors_(audit) > 0) {
    skuWriteAudit_(audit);
    skuSetStatusToast_('STOP: mapping/validation còn lỗi. Xem SKU_AUDIT.', 'SKU Dry Run');
    return {runId: runId, status: 'BLOCKED_MAPPING', errors: skuCountAuditErrors_(audit)};
  }

  let states = skuReadOpening_(cfg, master);
  const resolved = rr.resolved.slice().sort((a, b) => {
    const dt = a.date.getTime() - b.date.getTime();
    return dt || (a.row - b.row);
  });

  const monthGroups = {};
  resolved.forEach(tx => {
    const month = skuMonthKey_(tx.date, cfg.timezone);
    if (!monthGroups[month]) monthGroups[month] = {};
    if (!monthGroups[month][tx.sku]) monthGroups[month][tx.sku] = [];
    monthGroups[month][tx.sku].push(tx);
  });

  const monthlyRows = [];
  const txnRows = [];
  const months = Object.keys(monthGroups).sort();

  months.forEach(month => {
    const bySku = monthGroups[month];
    Object.keys(bySku).sort().forEach(sku => {
      const m = master[sku];
      const skuTxs = bySku[sku].slice().sort((a, b) => {
        const dt = a.date.getTime() - b.date.getTime();
        return dt || (a.row - b.row);
      });

      const opening = states[sku] || {
        sku: sku,
        group: m.group,
        qty: 0,
        value: 0,
        lastTxnDate: null,
        lastTxnRow: 0
      };

      const openingQty = opening.qty;
      const openingValue = opening.value;

      let receiptQty = 0;
      let receiptValue = 0;
      let issueQty = 0;

      skuTxs.forEach(tx => {
        if (tx.type === 'NHAP') {
          receiptQty += tx.qty;
          receiptValue += tx.inputAmount;
        } else if (tx.type === 'XUAT') {
          issueQty += tx.qty;
        }
      });

      const availableQty = openingQty + receiptQty;
      const availableValue = openingValue + receiptValue;

      if (availableQty < -cfg.zeroQtyEpsilon) {
        audit.push(skuAuditRow_(
          'ERROR', 'AVAILABLE_QTY_NEGATIVE', skuTxs[0],
          'AvailableQty âm cho SKU ' + sku + ': ' + availableQty,
          runId
        ));
        return;
      }

      const monthlyAvg = availableQty > cfg.zeroQtyEpsilon
        ? availableValue / availableQty
        : 0;

      if (!cfg.allowNegativeStock && issueQty - availableQty > cfg.zeroQtyEpsilon) {
        audit.push(skuAuditRow_(
          'ERROR', 'MONTH_NEGATIVE_STOCK', skuTxs[0],
          'Tổng xuất tháng ' + issueQty + ' > lượng khả dụng ' + availableQty + ' cho SKU ' + sku,
          runId
        ));
        return;
      }

      const issueValue = issueQty * monthlyAvg;
      let closingQty = availableQty - issueQty;
      let closingValue = availableValue - issueValue;
      closingQty = skuZero_(closingQty, cfg.zeroQtyEpsilon);
      closingValue = skuZero_(closingValue, cfg.zeroValueEpsilon);

      // Row-level dry replay using the fixed monthly average.
      let rowQty = openingQty;
      let rowValue = openingValue;
      skuTxs.forEach(tx => {
        let costedAmount;
        if (tx.type === 'NHAP') {
          rowQty += tx.qty;
          rowValue += tx.inputAmount;
          costedAmount = tx.inputAmount;
        } else {
          rowQty -= tx.qty;
          costedAmount = tx.qty * monthlyAvg;
          rowValue -= costedAmount;
        }

        rowQty = skuZero_(rowQty, cfg.zeroQtyEpsilon);
        rowValue = skuZero_(rowValue, cfg.zeroValueEpsilon);

        if (!cfg.allowNegativeStock && rowQty < -cfg.zeroQtyEpsilon) {
          audit.push(skuAuditRow_(
            'ERROR', 'PHYSICAL_NEGATIVE_STOCK', tx,
            'Tồn vật lý âm trong tháng cho SKU ' + sku + ': ' + rowQty,
            runId
          ));
        }

        txnRows.push([
          tx.row,
          tx.date,
          month,
          tx.invoiceNo,
          tx.customer,
          tx.group,
          tx.rawName,
          sku,
          tx.type,
          tx.qty,
          tx.inputUnitPrice,
          tx.inputAmount,
          skuRound_(monthlyAvg, cfg.roundUnitCostDecimals),
          skuRound_(costedAmount, cfg.roundValueDecimals),
          skuRound_(rowQty, 6),
          skuRound_(rowValue, cfg.roundValueDecimals),
          runId,
          'DRY_RUN'
        ]);
      });

      // Algebraic monthly closing is authoritative.
      states[sku] = {
        sku: sku,
        group: m.group,
        qty: closingQty,
        value: closingValue,
        lastTxnDate: skuTxs[skuTxs.length - 1].date,
        lastTxnRow: skuTxs[skuTxs.length - 1].row
      };

      monthlyRows.push([
        month,
        sku,
        m.group,
        skuRound_(openingQty, 6),
        skuRound_(openingValue, cfg.roundValueDecimals),
        skuRound_(receiptQty, 6),
        skuRound_(receiptValue, cfg.roundValueDecimals),
        skuRound_(availableQty, 6),
        skuRound_(availableValue, cfg.roundValueDecimals),
        skuRound_(monthlyAvg, cfg.roundUnitCostDecimals),
        skuRound_(issueQty, 6),
        skuRound_(issueValue, cfg.roundValueDecimals),
        skuRound_(closingQty, 6),
        skuRound_(closingValue, cfg.roundValueDecimals),
        skuTxs.length,
        runId
      ]);
    });
  });

  const errorsAfterCost = skuCountAuditErrors_(audit);
  if (errorsAfterCost > 0) {
    skuWriteRows_(SKU_ENGINE.SHEETS.MONTHLY, monthlyRows, 16);
    skuWriteRows_(SKU_ENGINE.SHEETS.TXN_DRY, txnRows, 18);
    skuWriteAudit_(audit);
    skuSetStatusToast_('STOP: ' + errorsAfterCost + ' lỗi trong costing. Xem SKU_AUDIT.', 'SKU Dry Run');
    return {runId: runId, status: 'BLOCKED_COSTING', errors: errorsAfterCost};
  }

  const stockRows = [];
  const groupAgg = {};
  Object.keys(states).sort().forEach(sku => {
    const s = states[sku];
    const m = master[sku];
    if (!m) return;
    const avg = s.qty > cfg.zeroQtyEpsilon ? s.value / s.qty : 0;
    stockRows.push([
      sku,
      m.group,
      m.name,
      m.unit || 'kg',
      skuRound_(s.qty, 6),
      skuRound_(s.value, cfg.roundValueDecimals),
      skuRound_(avg, cfg.roundUnitCostDecimals),
      s.lastTxnDate || '',
      s.lastTxnRow || '',
      'DRY_RUN',
      cfg.engineVersion,
      runId
    ]);

    if (!groupAgg[m.group]) groupAgg[m.group] = {qty: 0, value: 0};
    groupAgg[m.group].qty += s.qty;
    groupAgg[m.group].value += s.value;
  });

  audit = audit.concat(skuCompareGroupSnapshot_(groupAgg, cfg, runId));

  skuWriteRows_(SKU_ENGINE.SHEETS.STOCK, stockRows, 12);
  skuWriteRows_(SKU_ENGINE.SHEETS.MONTHLY, monthlyRows, 16);
  skuWriteRows_(SKU_ENGINE.SHEETS.TXN_DRY, txnRows, 18);
  skuWriteAudit_(audit);

  const finalErrors = skuCountAuditErrors_(audit);
  skuSetStatusToast_(
    finalErrors
      ? ('DRY RUN hoàn tất nhưng có ' + finalErrors + ' lỗi đối chiếu. Xem SKU_AUDIT.')
      : ('PASS DRY RUN: ' + stockRows.length + ' SKU, ' + resolved.length + ' giao dịch.'),
    'SKU Engine'
  );

  return {
    runId: runId,
    status: finalErrors ? 'DONE_WITH_ERRORS' : 'PASS',
    transactions: resolved.length,
    skuCount: stockRows.length,
    monthRows: monthlyRows.length,
    auditErrors: finalErrors
  };
}

function skuCompareGroupSnapshot_(groupAgg, cfg, runId) {
  const out = [];
  const sh = skuRequireSheet_(cfg.groupStockSheet);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return out;
  const h = skuHeaderMap_(values[0]);

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const group = skuNormalizeGroup_(r[h['Mã hàng']]);
    if (!group || group === 'TỔNG') continue;

    const currentQty = Number(r[h['Số lượng']]);
    const currentValue = Number(r[h['Giá trị']]);
    const calc = groupAgg[group] || {qty: 0, value: 0};

    const qtyDiff = calc.qty - currentQty;
    const valueDiff = calc.value - currentValue;

    if (Math.abs(qtyDiff) > cfg.zeroQtyEpsilon) {
      out.push([
        'ERROR',
        'GROUP_QTY_MISMATCH',
        '',
        '',
        '',
        group,
        '',
        '',
        '',
        '',
        skuRound_(calc.qty, 6),
        '',
        skuRound_(currentQty, 6),
        'SKU tổng hợp lệch TonKho hiện tại. Calculated=' + calc.qty + ', TonKho=' + currentQty + ', diff=' + qtyDiff,
        runId,
        new Date()
      ]);
    } else {
      out.push([
        'INFO',
        'GROUP_QTY_MATCH',
        '',
        '',
        '',
        group,
        '',
        '',
        '',
        '',
        skuRound_(calc.qty, 6),
        '',
        skuRound_(currentQty, 6),
        'Số lượng SKU tổng hợp khớp TonKho. Giá trị có thể khác do phương pháp costing SKU/tháng.',
        runId,
        new Date()
      ]);
    }

    out.push([
      'INFO',
      'GROUP_VALUE_COMPARISON',
      '',
      '',
      '',
      group,
      '',
      '',
      '',
      '',
      '',
      '',
      skuRound_(valueDiff, cfg.roundValueDecimals),
      'Calculated SKU value=' + skuRound_(calc.value, cfg.roundValueDecimals) +
        '; TonKho hiện tại=' + skuRound_(currentValue, cfg.roundValueDecimals) +
        '; diff=' + skuRound_(valueDiff, cfg.roundValueDecimals),
      runId,
      new Date()
    ]);
  }
  return out;
}

/**
 * Production commit is deliberately not implemented in V1.
 * This prevents accidental replacement of the current working inventory engine
 * before reconciliation with accounting is complete.
 */
function skuEngineProductionCommit() {
  throw new Error('SKU_ENGINE_PRODUCTION_COMMIT_DISABLED_IN_V1');
}


/**
 * SKU Engine - menu helper.
 * IMPORTANT: do not create another onOpen() if the project already has one.
 * Add one line `skuEngineAddMenu();` to the existing onOpen() instead.
 */
function skuEngineAddMenu() {
  SpreadsheetApp.getUi()
    .createMenu('SKU Engine')
    .addItem('0. Setup sheets (idempotent)', 'skuEngineSetupSheets')
    .addSeparator()
    .addItem('1. Bootstrap SKU/Alias suggestions', 'skuEngineBootstrapAliases')
    .addItem('2. Auto classify high-confidence', 'skuEngineAutoClassifyMappings')
    .addItem('2b. Build equivalent-alias merge review', 'skuEngineBuildMergeReview')
    .addItem('3. Approve high-confidence candidates', 'skuEngineApproveHighConfidence')
    .addItem('4. Validate SKU mappings', 'skuEngineValidateMappings')
    .addItem('5. Run monthly SKU dry-run', 'skuEngineRunDry')
    .addSeparator()
    .addItem('Debug counts', 'skuEngineDebugCounts')
    .addToUi();
}

function skuEngineStatus() {
  const cfg = skuCfg_();
  const msg = [
    'Version: ' + cfg.engineVersion,
    'Mode: ' + cfg.runMode,
    'Cost method: ' + cfg.costMethod,
    'Opening balance: ' + cfg.useOpeningBalance,
    'Production write: ' + cfg.productionWriteEnabled
  ].join('\n');
  SpreadsheetApp.getUi().alert('SKU Engine Status', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
