function getOrCreateYearFolder_(year, parentFolderId) {
  if (!parentFolderId) {
    throw new Error("parentFolderId chưa được cấu hình trong CONFIG");
  }

  const parent = DriveApp.getFolderById(parentFolderId);

  const folders = parent.getFoldersByName(String(year));
  if (folders.hasNext()) return folders.next();

  return parent.createFolder(String(year));
}

function saveInvoicePdfToDrive_(blob, fileName, folder) {

  const file = folder.createFile(blob).setName(fileName);

  return file.getId();
}

// Kiểm tra file đã tồn tại trong drive (theo TÊN)
function fileExistsInFolder_(folder, fileName) {
  const files = folder.getFilesByName(fileName);

  return files.hasNext();
}

function findFileInFolder_(folder, fileName) {

  const files = folder.getFilesByName(fileName);

  if (files.hasNext()) {
    return files.next();
  }

  return null;
}
