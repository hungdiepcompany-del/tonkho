function onEdit(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();
  if (sh.getName() !== CONFIG.SHEET_INVOICE) return;

  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();

  if (startRow <= 1) return;

  const editStartCol = e.range.getColumn();
  const editEndCol = e.range.getLastColumn();

  const isEditHashColumn =
    editStartCol === CONFIG.HASH_COLUME &&
    editEndCol === CONFIG.HASH_COLUME;

  const isTouchDataColumns = !(
    editEndCol < CONFIG.HASH_COLUME_BEGIN ||
    editStartCol > CONFIG.HASH_COLUME_END
  );

  if (!isTouchDataColumns && !isEditHashColumn) {
    return;
  }

  if (isEditHashColumn) {
    const dataRange = sh.getRange(
      startRow,
      CONFIG.HASH_COLUME_BEGIN,
      1,
      CONFIG.HASH_COLUME_END - CONFIG.HASH_COLUME_BEGIN + 1
    );

    const rowData = dataRange.getValues()[0];
    const text = normalizeHashText_(rowData);
    const hash = buildHashFromText_(text);

    e.range.setValue(hash || "");
    PropertiesService.getScriptProperties()
      .setProperty("NEED_RECALC_NX", "true");
    return;
  }

  if (numRows > 50 && e.value === undefined && e.oldValue !== undefined) {
    PropertiesService.getScriptProperties()
      .setProperty("NEED_RECALC_NX", "true");
    PropertiesService.getScriptProperties()
      .setProperty("NEED_RECONCILE_INVOICEKEY", "true");
    return;
  }

  const dataRange = sh.getRange(
    startRow,
    CONFIG.HASH_COLUME_BEGIN,
    numRows,
    CONFIG.HASH_COLUME_END - CONFIG.HASH_COLUME_BEGIN + 1
  );

  const hashRange = sh.getRange(
    startRow,
    CONFIG.HASH_COLUME,
    numRows,
    1
  );

  const touchesInvoiceIdentity = !(editEndCol < 2 || editStartCol > 3);
  const invoiceKeyRange = touchesInvoiceIdentity
    ? sh.getRange(startRow, CONFIG.HASH_COLUME + 1, numRows, 1)
    : null;

  const dataValues = dataRange.getValues();
  const hashValues = hashRange.getValues();
  const invoiceKeyValues = invoiceKeyRange ? invoiceKeyRange.getValues() : null;

  let hashChanged = false;
  let invoiceKeyChanged = false;
  let invoiceKeyNeedsReview = false;

  for (let i = 0; i < numRows; i++) {
    const row = dataValues[i];
    const text = normalizeHashText_(row);
    const newHash = buildHashFromText_(text);
    const oldHash = hashValues[i][0];

    if (!newHash) {
      if (oldHash) {
        hashValues[i][0] = "";
        hashChanged = true;
      }
    } else if (newHash !== oldHash) {
      hashValues[i][0] = newHash;
      hashChanged = true;
    }

    if (invoiceKeyValues) {
      const currentKey = invoiceKeyValues[i][0];
      const reconciliation = reconcileInvoiceKeyFromExisting_(
        row[0],
        row[1],
        currentKey
      );

      if (reconciliation.changed) {
        invoiceKeyValues[i][0] = reconciliation.value;
        invoiceKeyChanged = true;
      }
      if (reconciliation.needsReview) {
        invoiceKeyNeedsReview = true;
      }
    }
  }

  if (hashChanged) {
    hashRange.setValues(hashValues);
  }
  if (invoiceKeyChanged && invoiceKeyRange) {
    invoiceKeyRange.setValues(invoiceKeyValues);
  }

  if (!hashChanged && !invoiceKeyChanged && !invoiceKeyNeedsReview) return;

  applyInvoiceFormatsForRows_(
    sh,
    startRow,
    numRows
  );

  const props = PropertiesService.getScriptProperties();
  props.setProperty("NEED_RECALC_NX", "true");
  if (invoiceKeyChanged || invoiceKeyNeedsReview) {
    props.setProperty("NEED_RECONCILE_INVOICEKEY", "true");
  }

  SpreadsheetApp.getActive().toast(
    invoiceKeyChanged
      ? `Hash + InvoiceKey da cap nhat cho ${numRows} dong. Can reconcile Hoa-Don va chay cap nhat Nhap/Xuat.`
      : `Hash + Format da cap nhat cho ${numRows} dong. Hay chay cap nhat Nhap/Xuat tu menu/sidebar.`,
    "Trigger",
    4
  );
}

function reconcileInvoiceKeyFromExisting_(invoiceDate, invoiceNo, existingKey) {
  const key = String(existingKey || "").trim();
  if (!key) {
    return { value: key, changed: false, needsReview: false };
  }

  if (!parseInvoiceDateValue_(invoiceDate) || !String(invoiceNo ?? "").trim()) {
    return { value: key, changed: false, needsReview: true };
  }

  const match = key.match(/^\d{8}_([0-9]{8,14})_(.+)$/);
  if (!match) {
    return { value: key, changed: false, needsReview: true };
  }

  try {
    const rebuilt = buildInvoiceKey_(
      invoiceDate,
      match[1],
      normalizeInvoiceNo_(invoiceNo)
    );
    return {
      value: rebuilt,
      changed: rebuilt !== key,
      needsReview: rebuilt !== key
    };
  } catch (err) {
    debugLog_("InvoiceKey reconcile failed: " + sanitizeLogValue_(err.message || err));
    return { value: key, changed: false, needsReview: true };
  }
}
