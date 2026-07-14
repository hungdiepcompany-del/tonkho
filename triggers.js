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

  const dataValues = dataRange.getValues();
  const hashValues = hashRange.getValues();
  let needUpdate = false;

  for (let i = 0; i < numRows; i++) {
    const row = dataValues[i];
    const text = normalizeHashText_(row);
    const newHash = buildHashFromText_(text);
    const oldHash = hashValues[i][0];

    if (!newHash) {
      if (oldHash) {
        hashValues[i][0] = "";
        needUpdate = true;
      }
      continue;
    }

    if (newHash === oldHash) continue;

    hashValues[i][0] = newHash;
    needUpdate = true;
  }

  if (!needUpdate) return;

  hashRange.setValues(hashValues);

  applyInvoiceFormatsForRows_(
    sh,
    startRow,
    numRows
  );

  PropertiesService.getScriptProperties()
    .setProperty("NEED_RECALC_NX", "true");

  SpreadsheetApp.getActive().toast(
    `Hash + Format da cap nhat cho ${numRows} dong. Hay chay cap nhat Nhap/Xuat tu menu/sidebar.`,
    "Trigger",
    3
  );
}
