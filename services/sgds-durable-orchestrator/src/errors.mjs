export function sgdsError(code, status = 400, message = code) {
  const error = new Error(String(message || code));
  error.code = String(code);
  error.status = Number(status || 500);
  return error;
}

export function publicError(error) {
  return {
    ok: false,
    code: error && error.code ? String(error.code) : 'SGDS_ORCHESTRATOR_ERROR'
  };
}
