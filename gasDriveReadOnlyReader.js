function createGasDriveReadOnlyReader(options) {
  const hasher = options && options.hasher || { hash: value => String(value || '') };

  function readFile(request) {
    const fileReference = String(request && request.fileReference || '').trim();
    if (!fileReference) return { exists: false };
    const file = DriveApp.getFileById(fileReference);
    if (!file) return { exists: false };
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    return {
      exists: true,
      contentHash: hasher.hash(bytes.join(',')),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      trashed: file.isTrashed()
    };
  }

  return Object.freeze({ readFile });
}
