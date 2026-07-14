function triggerScanInvoiceDriveFolder() {
  const t0 = Date.now();
  const budget = {
    deadline: t0 + 4.5 * 60 * 1000,
    maxFiles: Number(CONFIG.MAX_DRIVE_SCAN_FILES) || 100,
    processed: 0
  };

  debugLog_("Drive scanner started");

  const folders = [
    { id: CONFIG.INVOICE_IN_FOLDER_ID, type: "IN" },
    { id: CONFIG.INVOICE_OUT_FOLDER_ID, type: "OUT" }
  ];

  for (const f of folders) {
    if (isDriveScanBudgetDone_(budget)) break;

    try {
      const folder = DriveApp.getFolderById(f.id);
      debugLog_("Scanning folder: " + folder.getName());

      scanFilesInFolder_(folder, f.type, budget);

      const yearFolders = folder.getFolders();
      while (yearFolders.hasNext() && !isDriveScanBudgetDone_(budget)) {
        const yearFolder = yearFolders.next();
        debugLog_("Year folder: " + yearFolder.getName());
        scanFilesInFolder_(yearFolder, f.type, budget);
      }
    } catch (err) {
      debugLog_("Loi scan Drive folder: " + (err.stack || err));
    }
  }

  debugLog_(
    "Drive scanner finished -> " +
    ((Date.now() - t0) / 1000) + "s, files=" + budget.processed
  );
}

function isDriveScanBudgetDone_(budget) {
  return budget.processed >= budget.maxFiles || Date.now() > budget.deadline;
}

function scanFilesInFolder_(folder, invoiceType, budget) {
  const files = folder.getFiles();

  while (files.hasNext() && !isDriveScanBudgetDone_(budget)) {
    const file = files.next();
    budget.processed++;

    try {
      const name = file.getName();
      const lower = name.toLowerCase();

      if (!lower.endsWith(".xml") && !lower.endsWith(".pdf")) {
        continue;
      }

      const fileType = lower.endsWith(".xml") ? "XML" : "PDF";
      const meta = parseInvoiceFromFileName_(lower);

      if (!meta) continue;

      const invoiceKey = buildInvoiceKey_(
        meta.date,
        meta.taxCode,
        meta.invoiceNo
      );

      upsertHoaDonFile_(invoiceKey, fileType, file.getId());

      if (fileType !== "XML") continue;

      parseInvoiceXMLFile_(file, invoiceType);
    } catch (err) {
      debugLog_("Loi xu ly Drive file: " + file.getName() + " | " + (err.stack || err));
    }
  }
}

function parseInvoiceXMLFile_(file, invoiceType) {
  try {
    const blob = file.getBlob();

    const parsed = parseInvoiceXML_(blob, {
      type: invoiceType === "IN" ? "NHAP" : "XUAT"
    });

    if (!parsed || !parsed.meta) return;
    if (!isVatInvoiceXML_(parsed.meta)) return;

    const rows = buildInvoiceRowsFromParsed_(parsed, invoiceType);

    if (rows.length) {
      const prepared = prepareInvoiceRowsForCommit_(
        rows.map((row, index) => ({
          type: invoiceType === "IN" ? "IN" : "OUT",
          row,
          sourceKey: "DRIVE:" + file.getId() + ":" + index
        })),
        null,
        { debugPrefix: "DRIVE" }
      );
      const committed = commitPreparedInvoiceRows_(prepared);
      const failed = committed.filter(x => x.writeStatus === "FAILED");
      if (failed.length) {
        debugLog_("Drive XML commit failed: " + file.getName());
      }
    }

    debugLog_("XML parsed -> " + file.getName());
  } catch (err) {
    debugLog_("Loi parse XML Drive file: " + file.getName() + " | " + (err.stack || err));
  }
}

function parseInvoiceFromFileName_(fileName) {
  const name = fileName
    .replace(".pdf", "")
    .replace(".xml", "");

  const nums = name.match(/\d+/g);

  if (!nums || nums.length < 3) {
    debugLog_("Cannot parse filename: " + fileName);
    return null;
  }

  const date = nums[0];
  const taxCode = nums[1];
  const invoiceNo = nums[2];

  return {
    date,
    taxCode,
    invoiceNo
  };
}

function buildInvoiceRowsFromParsed_(parsed, type) {
  const rows = [];
  const meta = parsed.meta;

  const taxCode =
    type === "IN"
      ? parsed.seller?.taxCode || ""
      : parsed.buyer?.taxCode || "";

  const company =
    type === "IN"
      ? parsed.seller?.name || ""
      : parsed.buyer?.name || "";

  const invoiceKey = buildInvoiceKey_(
    meta.invoiceDate,
    taxCode,
    meta.invoiceNo
  );

  parsed.items.forEach(item => {
    const row = [];

    row[CONFIG.NHAPXUAT_INDEX.invoiceDate] = meta.invoiceDate;
    row[CONFIG.NHAPXUAT_INDEX.invoiceNo] = meta.invoiceNo;
    row[CONFIG.NHAPXUAT_INDEX.customerName] = company;
    row[CONFIG.NHAPXUAT_INDEX.itemCode] = item.code;
    row[CONFIG.NHAPXUAT_INDEX.itemName] = item.name;
    row[CONFIG.NHAPXUAT_INDEX.invoiceType] =
      type === "IN" ? "NHAP" : "XUAT";
    row[CONFIG.NHAPXUAT_INDEX.qty] = item.qty;
    row[CONFIG.NHAPXUAT_INDEX.price] = item.price;

    const values = {
      invoiceDate: meta.invoiceDate,
      invoiceNo: meta.invoiceNo,
      customerName: company,
      itemCode: item.code,
      itemName: item.name,
      invoiceType: type === "IN" ? "NHAP" : "XUAT",
      qty: item.qty
    };

    const hash = buildInvoiceItemHash_(values);

    row[CONFIG.NHAPXUAT_INDEX.hash] = hash;
    row[CONFIG.NHAPXUAT_INDEX.invoiceKey] = invoiceKey;

    rows.push(row);
  });

  return rows;
}
