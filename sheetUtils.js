const ProgressService = (() => {
  const cache = CacheService.getScriptCache();
  const TTL = 100; // giây

  function key(name) {
    return "PROGRESS_" + name;
  }

  function normalizeRunId(name, requestedRunId) {
    const value = String(requestedRunId || "").trim();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(value)) {
      throw new Error("PROGRESS_RUN_ID_INVALID:" + name);
    }
    return value;
  }

  return {
    begin(name, requestedRunId) {
      const runId = normalizeRunId(name, requestedRunId);
      this.set(name, runId, 0, "Khoi tao...", "RUNNING");
      return runId;
    },

    set(name, runId, value, message, status) {
      cache.put(
        key(name),
        JSON.stringify({
          runId: normalizeRunId(name, runId),
          value: Number(value),
          message: message || "",
          status: status || "RUNNING",
          updatedAt: new Date().toISOString()
        }),
        TTL
      );
    },

    get(name, expectedRunId) {
      const raw = cache.get(key(name));
      if (!raw) return null;
      const progress = JSON.parse(raw);
      if (expectedRunId && progress.runId !== expectedRunId) return null;
      return progress;
    },

    reset(name) {
      cache.remove(key(name));
    }
  };
})();


function getOrCreateASheet_(name) {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
