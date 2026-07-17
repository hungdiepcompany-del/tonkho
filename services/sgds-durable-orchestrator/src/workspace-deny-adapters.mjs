import { sgdsError } from './errors.mjs';

export function createWorkspaceDenyAdapters() {
  function deny() {
    throw sgdsError('BLOCKED_WORKSPACE_SIDE_EFFECT_ATTEMPT', 500);
  }
  return Object.freeze({
    gmail: Object.freeze({ read: deny, mutate: deny, label: deny }),
    drive: Object.freeze({ read: deny, write: deny, mutate: deny }),
    sheets: Object.freeze({ read: deny, write: deny, mutate: deny }),
    canonicalWriter: Object.freeze({ write: deny, commit: deny })
  });
}
