// THỐNG KÊ
function createProcessStats_() {
  return {
    scanned: 0,
    in: { scanned: 0, accepted: 0, duplicate: 0 },
    out: { scanned: 0, accepted: 0, duplicate: 0 },
    duplicateExisting: 0,
    duplicateBatch: 0,
    accepted: 0
  };
}
