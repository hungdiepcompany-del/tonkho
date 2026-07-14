const ProgressService = (() => {
  const cache = CacheService.getScriptCache();
  const TTL = 100; // giây

  function key(name) {
    return "PROGRESS_" + name;
  }

  return {
    set(name, value, message) {
      cache.put(
        key(name),
        JSON.stringify({
          value: Number(value),
          message: message || ""
        }),
        TTL
      );
    },

    get(name) {
      const raw = cache.get(key(name));
      return raw ? JSON.parse(raw) : null; //  rất quan trọng
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
