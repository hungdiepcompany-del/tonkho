/*
 * CANONICAL INVOICE IDENTITY + LEDGER LINK HARDENING
 *
 * This module is intentionally narrow:
 * - canonicalizes invoice tax codes without destroying branch suffixes;
 * - maintains the formula-only PDF link column in Nhap-Xuat;
 * - reconciles InvoiceKey for replayed rows that already exist in the ledger;
 * - fails closed on ambiguous/conflicting existing identities.
 */

function normalizeInvoiceTaxCode_(value) {
  if (value === null || value === undefined) return "";

  let raw = String(value).trim();
  if (!raw) return "";

  raw = raw
    .replace(/^(?:M[AÃ]\s*S[ỐO]\s*THU[ẾE]|MST|TAX\s*CODE)\s*[:\-]?\s*/i, "")
    .replace(/[\u00A0\s.]+/g, "");

  // Vietnam tax identity is canonicalized as either 10 digits or 10-3.
  // A legacy flattened 13-digit branch code is repaired to 10-3.
  if (/^[0-9]{13}$/.test(raw)) {
    return raw.slice(0, 10) + "-" + raw.slice(10);
  }

  const match = raw.match(/^([0-9]{10})(?:-([0-9]{3}))?$/);
  if (!match) return "";

  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

function isCanonicalInvoiceKey_(invoiceKey) {
  const key = String(invoiceKey || "").trim();
  return /^\d{8}_[0-9]{10}(?:-[0-9]{3})?_[^_\s]+$/.test(key);
}

function normalizeDriveFileId_(fileId) {
  const id = String(fileId || "").trim();
  return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : "";
}

function canonicalInvoicePdfLinkFormulaForRow_(row) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < 2) {
    throw new Error("Dong Nhap-Xuat khong hop le khi tao cong thuc PDF: " + row);
  }

  return `=IF(O${r}="";"";IFERROR(IF(XLOOKUP(O${r};'Hoa-Don'!A:A;'Hoa-Don'!D:D;"")="";"";HYPERLINK("https://drive.google.com/file/d/"&XLOOKUP(O${r};'Hoa-Don'!A:A;'Hoa-Don'!D:D;"")&"/view";"🔎"));""))`;
}

function ensureInvoicePdfLinkFormulas_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_INVOICE);
  if (!sh) throw new Error("Khong tim thay sheet: " + CONFIG.SHEET_INVOICE);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { checked: 0, repaired: 0 };

  const numRows = lastRow - 1;
  const range = sh.getRange(2, 16, numRows, 1); // P
  const formulas = range.getFormulas();
  let repaired = 0;

  for (let i = 0; i < numRows; i++) {
    const expected = canonicalInvoicePdfLinkFormulaForRow_(i + 2);
    if (formulas[i][0] !== expected) {
      formulas[i][0] = expected;
      repaired++;
    }
  }

  if (repaired > 0) {
    range.setFormulas(formulas);
  }

  return { checked: numRows, repaired };
}

function planDuplicateInvoiceKeyReconciliation_(ledgerRows, duplicateItems) {
  const rows = Array.isArray(ledgerRows) ? ledgerRows : [];
  const items = Array.isArray(duplicateItems) ? duplicateItems : [];
  const errors = Array(items.length).fill("");
  const updates = [];
  const groups = new Map();

  items.forEach((item, itemIndex) => {
    const row = item && item.row ? item.row : [];
    const hash = String(row[CONFIG.NHAPXUAT_INDEX.hash] || "").trim();
    const invoiceKey = String(
      item?.invoiceKey || row[CONFIG.NHAPXUAT_INDEX.invoiceKey] || ""
    ).trim();

    if (!hash) {
      errors[itemIndex] = "MISSING_HASH";
      return;
    }
    if (!isCanonicalInvoiceKey_(invoiceKey)) {
      errors[itemIndex] = "INVALID_INVOICE_KEY";
      return;
    }

    const group = groups.get(hash) || { itemIndexes: [], keys: new Set() };
    group.itemIndexes.push(itemIndex);
    group.keys.add(invoiceKey);
    groups.set(hash, group);
  });

  groups.forEach((group, hash) => {
    if (group.keys.size !== 1) {
      group.itemIndexes.forEach(i => {
        errors[i] = "AMBIGUOUS_HASH_TO_INVOICEKEY";
      });
      return;
    }

    const expectedKey = Array.from(group.keys)[0];
    const candidateIndexes = [];

    for (let i = 0; i < rows.length; i++) {
      const ledgerHash = String(rows[i]?.[12] || "").trim(); // B:O -> N is index 12
      if (ledgerHash === hash) candidateIndexes.push(i);
    }

    if (!candidateIndexes.length) {
      group.itemIndexes.forEach(i => {
        errors[i] = "DUPLICATE_LEDGER_ROW_NOT_FOUND";
      });
      return;
    }

    const conflictingKeys = candidateIndexes
      .map(i => String(rows[i]?.[13] || "").trim()) // B:O -> O is index 13
      .filter(Boolean)
      .filter(key => key !== expectedKey);

    if (conflictingKeys.length) {
      group.itemIndexes.forEach(i => {
        errors[i] = "EXISTING_INVOICEKEY_CONFLICT";
      });
      return;
    }

    candidateIndexes.forEach(i => {
      const currentKey = String(rows[i]?.[13] || "").trim();
      if (!currentKey) {
        updates.push({ rowOffset: i, invoiceKey: expectedKey });
      }
    });
  });

  return { updates, errors };
}

function reconcileDuplicateInvoiceKeysAfterCommit_(commitResults) {
  const results = Array.isArray(commitResults) ? commitResults : [];
  const duplicateEntries = [];

  results.forEach((item, resultIndex) => {
    if (
      item?.status === "duplicated" &&
      item?.writeStatus === "ALREADY_COMMITTED"
    ) {
      duplicateEntries.push({ resultIndex, item });
    }
  });

  if (!duplicateEntries.length) return results;

  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_INVOICE);
  if (!sh) throw new Error("Khong tim thay sheet: " + CONFIG.SHEET_INVOICE);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return results.map((item, i) => {
      const duplicateIndex = duplicateEntries.findIndex(x => x.resultIndex === i);
      return duplicateIndex >= 0
        ? { ...item, writeStatus: "FAILED", errorCode: "DUPLICATE_LEDGER_ROW_NOT_FOUND" }
        : item;
    });
  }

  const numRows = lastRow - 1;
  const ledgerRange = sh.getRange(2, 2, numRows, 14); // B:O
  const ledgerRows = ledgerRange.getValues();
  const duplicateItems = duplicateEntries.map(x => x.item);
  const plan = planDuplicateInvoiceKeyReconciliation_(ledgerRows, duplicateItems);

  if (plan.updates.length) {
    const keyRange = sh.getRange(2, 15, numRows, 1); // O
    const keyValues = keyRange.getValues();

    plan.updates.forEach(update => {
      keyValues[update.rowOffset][0] = update.invoiceKey;
    });

    keyRange.setValues(keyValues);
  }

  const duplicateErrorByResultIndex = new Map();
  duplicateEntries.forEach((entry, duplicateIndex) => {
    const code = plan.errors[duplicateIndex] || "";
    if (code) duplicateErrorByResultIndex.set(entry.resultIndex, code);
  });

  return results.map((item, resultIndex) => {
    const code = duplicateErrorByResultIndex.get(resultIndex);
    if (!code) return item;
    return {
      ...item,
      writeStatus: "FAILED",
      errorCode: code
    };
  });
}
