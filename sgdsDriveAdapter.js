const SGDS_DRIVE_ADAPTER_CONTRACT_ = Object.freeze({
  D6D: 'DRIVE_ADAPTER',
  readOperations: Object.freeze([
    'findFolder',
    'findFileByIdentity',
    'readFileMetadata',
    'readFileBytes',
    'generateDriveReference'
  ]),
  mutationOperations: Object.freeze([
    'ensureFolder',
    'createFileIfAbsent',
    'updateBoundedMetadata'
  ]),
  folderModel: 'direction/year/artifact-type',
  fileIdentityModel: 'invoiceKeyV2+messageId+attachmentId+contentHash+artifactType'
});

function createSgdsDriveReadAdapter_(deps) {
  const source = requireSgdsAdapterMethod_(deps && deps.source, 'driveSource', [
    'findFolder',
    'findFileByIdentity',
    'readFileMetadata',
    'readFileBytes'
  ]);
  return Object.freeze({
    async findFolder(request) {
      return normalizeSgdsDriveFolder_(await source.findFolder(cloneSgdsAdapterJson_(request || {})));
    },
    async findFileByIdentity(request) {
      return normalizeSgdsDriveFileMetadata_(await source.findFileByIdentity(cloneSgdsAdapterJson_(request || {})));
    },
    async readFileMetadata(request) {
      return normalizeSgdsDriveFileMetadata_(await source.readFileMetadata(cloneSgdsAdapterJson_(request || {})));
    },
    async readFileBytes(request) {
      const result = await source.readFileBytes(cloneSgdsAdapterJson_(request || {}));
      return {
        fileReference: safeSgdsAdapterString_(result && result.fileReference),
        contentHash: safeSgdsAdapterString_(result && result.contentHash),
        byteSize: Number(result && result.byteSize || 0),
        bytes: safeSgdsAdapterString_(result && result.bytes || '').slice(0, Number(request && request.maxBytes || 200000))
      };
    },
    generateDriveReference(request) {
      return buildSgdsDriveReference_(request || {});
    }
  });
}

function createSgdsDriveMutationAdapter_(deps) {
  const source = requireSgdsAdapterMethod_(deps && deps.source, 'driveMutationSource', [
    'ensureFolder',
    'createFileIfAbsent',
    'updateBoundedMetadata'
  ]);
  return Object.freeze({
    async ensureFolder(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsDriveFolder_(await source.ensureFolder(cloneSgdsAdapterJson_(request || {})));
    },
    async createFileIfAbsent(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsDriveFileMetadata_(await source.createFileIfAbsent(cloneSgdsAdapterJson_(request || {})));
    },
    async updateBoundedMetadata(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsDriveFileMetadata_(await source.updateBoundedMetadata(cloneSgdsAdapterJson_(request || {})));
    }
  });
}

function buildSgdsDriveArtifactIdentity_(input) {
  const source = input || {};
  return [
    safeSgdsAdapterString_(source.invoiceKeyV2 || source.invoiceKey),
    safeSgdsAdapterString_(source.messageId),
    safeSgdsAdapterString_(source.attachmentId),
    safeSgdsAdapterString_(source.contentHash),
    safeSgdsAdapterString_(source.artifactType || source.kind),
    safeSgdsAdapterString_(source.adjustmentKind || source.revisionKind || '')
  ].join('|');
}

function buildSgdsDriveReference_(input) {
  const identity = buildSgdsDriveArtifactIdentity_(input || {});
  return {
    logicalFileIdentity: identity,
    logicalFileIdentityHashPrefix: sgdsAdapterHashPrefix_(identity),
    artifactType: safeSgdsAdapterString_((input && (input.artifactType || input.kind)) || ''),
    fileName: safeSgdsAdapterString_(input && input.fileName),
    contentHash: safeSgdsAdapterString_(input && input.contentHash)
  };
}

function createFakeSgdsDriveAdapter_(options) {
  const state = {
    folders: cloneSgdsAdapterJson_((options && options.folders) || []),
    files: cloneSgdsAdapterJson_((options && options.files) || []),
    mutationLog: []
  };
  const calls = [];
  function record(method, request) {
    calls.push({ method, request: cloneSgdsAdapterJson_(request || {}) });
  }
  function folderKey(request) {
    return [request.direction || 'UNKNOWN', request.year || 'UNKNOWN', request.artifactType || 'INVOICE'].map(safeSgdsAdapterString_).join('/');
  }
  function findFolderInternal(request) {
    const key = folderKey(request || {});
    return state.folders.find(folder => folder.folderKey === key);
  }
  function fileIdentity(request) {
    return safeSgdsAdapterString_(request && (request.logicalFileIdentity || request.identity || buildSgdsDriveArtifactIdentity_(request)));
  }
  function findFileInternal(request) {
    const identity = fileIdentity(request);
    return state.files.find(file => file.logicalFileIdentity === identity);
  }
  const source = {
    async findFolder(request) {
      record('drive.findFolder', request);
      return findFolderInternal(request) || { exists: false, folderKey: folderKey(request || {}) };
    },
    async ensureFolder(request) {
      record('drive.ensureFolder', request);
      let folder = findFolderInternal(request);
      if (!folder) {
        folder = { exists: true, folderKey: folderKey(request || {}), folderReference: 'folder_' + sgdsAdapterHashPrefix_(folderKey(request || {})) };
        state.folders.push(folder);
        state.mutationLog.push({ method: 'ensureFolder', folderKey: folder.folderKey, idempotencyKey: request.idempotencyKey });
      }
      return folder;
    },
    async findFileByIdentity(request) {
      record('drive.findFileByIdentity', request);
      return findFileInternal(request) || { exists: false, logicalFileIdentity: fileIdentity(request) };
    },
    async createFileIfAbsent(request) {
      record('drive.createFileIfAbsent', request);
      const folder = findFolderInternal(request);
      if (!folder) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'drive folder missing');
      const existing = findFileInternal(request);
      if (existing) return { ...existing, status: 'ALREADY_PRESENT', idempotent: true };
      const identity = fileIdentity(request);
      const file = {
        exists: true,
        status: 'CONFIRMED_WRITTEN',
        idempotent: false,
        logicalFileIdentity: identity,
        logicalFileIdentityHashPrefix: sgdsAdapterHashPrefix_(identity),
        fileReference: 'drive_' + sgdsAdapterHashPrefix_(identity),
        folderReference: folder.folderReference,
        fileName: safeSgdsAdapterString_(request.fileName),
        artifactType: safeSgdsAdapterString_(request.artifactType || request.kind),
        mimeType: safeSgdsAdapterString_(request.mimeType),
        contentHash: safeSgdsAdapterString_(request.contentHash),
        byteSize: Number(request.byteSize || 0),
        metadata: cloneSgdsAdapterJson_(request.metadata || {})
      };
      state.files.push(file);
      state.mutationLog.push({ method: 'createFileIfAbsent', fileReference: file.fileReference, idempotencyKey: request.idempotencyKey });
      return file;
    },
    async readFileMetadata(request) {
      record('drive.readFileMetadata', request);
      const file = findFileInternal(request) || state.files.find(item => item.fileReference === request.fileReference);
      if (!file) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'drive file missing');
      return file;
    },
    async readFileBytes(request) {
      record('drive.readFileBytes', request);
      const file = findFileInternal(request) || state.files.find(item => item.fileReference === request.fileReference);
      if (!file) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'drive file missing');
      return { fileReference: file.fileReference, contentHash: file.contentHash, byteSize: file.byteSize, bytes: file.bytes || '' };
    },
    async updateBoundedMetadata(request) {
      record('drive.updateBoundedMetadata', request);
      const file = findFileInternal(request) || state.files.find(item => item.fileReference === request.fileReference);
      if (!file) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'drive file missing');
      file.metadata = { ...(file.metadata || {}), ...cloneSgdsAdapterJson_(request.metadata || {}) };
      state.mutationLog.push({ method: 'updateBoundedMetadata', fileReference: file.fileReference, idempotencyKey: request.idempotencyKey });
      return file;
    }
  };
  return Object.freeze({
    read: createSgdsDriveReadAdapter_({ source }),
    mutate: createSgdsDriveMutationAdapter_({ source }),
    state,
    calls
  });
}

function normalizeSgdsDriveFolder_(folder) {
  const source = cloneSgdsAdapterJson_(folder || {});
  return {
    exists: source.exists !== false,
    folderKey: safeSgdsAdapterString_(source.folderKey),
    folderReference: safeSgdsAdapterString_(source.folderReference),
    status: safeSgdsAdapterString_(source.status || (source.exists === false ? 'NOT_FOUND' : 'READ_OK'))
  };
}

function normalizeSgdsDriveFileMetadata_(file) {
  const source = cloneSgdsAdapterJson_(file || {});
  return {
    exists: source.exists !== false,
    status: safeSgdsAdapterString_(source.status || (source.exists === false ? 'NOT_FOUND' : 'READ_OK')),
    idempotent: Boolean(source.idempotent),
    logicalFileIdentity: safeSgdsAdapterString_(source.logicalFileIdentity),
    logicalFileIdentityHashPrefix: safeSgdsAdapterString_(source.logicalFileIdentityHashPrefix || sgdsAdapterHashPrefix_(source.logicalFileIdentity)),
    fileReference: safeSgdsAdapterString_(source.fileReference),
    folderReference: safeSgdsAdapterString_(source.folderReference),
    fileName: safeSgdsAdapterString_(source.fileName),
    artifactType: safeSgdsAdapterString_(source.artifactType),
    mimeType: safeSgdsAdapterString_(source.mimeType),
    contentHash: safeSgdsAdapterString_(source.contentHash),
    byteSize: Number(source.byteSize || 0),
    metadata: cloneSgdsAdapterJson_(source.metadata || {})
  };
}
