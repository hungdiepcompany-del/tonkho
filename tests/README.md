# Local Test Foundation

Bundle B tests are local-only. They load pulled Google Apps Script source through a Node `vm` sandbox and fail-closed GAS stubs. They do not call production entrypoints, Google APIs, network, Gmail, Drive, Sheets, Firebase, or clasp.

Test classes:

- CURRENT_BEHAVIOR
- CONFIRMED_BUG_REPRODUCTION
- TARGET_INVARIANT_DRAFT
- POLICY_PENDING
- STATIC_SOURCE_SAFETY
- SCHEMA_CONTRACT
