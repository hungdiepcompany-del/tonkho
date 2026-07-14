# Bundle B Local Test Foundation

BUNDLE_B_STATUS=PASS_LOCAL_TEST_FOUNDATION

## Objective

Create a local-only Node test harness, deterministic synthetic fixtures, current-behavior regression tests, confirmed bug reproduction tests, static safety checkers, and handoff docs.

## Scope

Allowed files: `package.json`, `tests/**`, `fixtures/**`, `scripts/test/**`, `scripts/checkers/**`, `artifacts/test/**`, `docs/**`, `.gitignore`, `README.md`.

Denylist: GAS runtime `.js`, runtime `.html`, `appsscript.json`, `.clasp.json`, pull BAT/log files, `ton kho - DATABASE.xlsx`, `PLANNING.md`.

## Test Taxonomy

- CURRENT_BEHAVIOR
- CONFIRMED_BUG_REPRODUCTION
- TARGET_INVARIANT_DRAFT
- POLICY_PENDING
- STATIC_SOURCE_SAFETY
- SCHEMA_CONTRACT

## Fixture Policy

Fixtures are synthetic only. No real invoice data, real counterparty tax codes, real email content, real Gmail IDs, or real Drive file IDs are allowed.

## Gates

B01_STATUS=PASS_TESTABILITY_INVENTORY
B02_STATUS=PASS_NODE_TEST_HARNESS
B03_STATUS=PASS_SYNTHETIC_FIXTURE_BASELINE
B04_STATUS=PASS_CURRENT_BEHAVIOR_REGRESSION
B05_STATUS=PASS_BUG_REPRODUCTION_BASELINE
B06_STATUS=PASS_VALIDATION_AND_HANDOFF

## Subphase Results

- B01: `artifacts/test/b01-testability-inventory.json` and `artifacts/test/b01-fixture-inventory.json`.
- B02: Node `vm` loader and fail-closed GAS stubs under `tests/harness`.
- B03: synthetic fixtures under `fixtures/**`.
- B04: current behavior tests under `tests/unit`, `tests/schema`, and `tests/static`.
- B05: bug reproduction tests under `tests/bugs` plus checkers.
- B06: validation and handoff docs updated.


## Final Validation

- `npm.cmd test`: PASS, 45 tests, 44 pass, 1 skipped target invariant draft.
- `npm.cmd run test:unit`: PASS, 21 tests.
- `npm.cmd run test:bugs`: PASS, 16 bug reproduction tests.
- `npm.cmd run test:static`: PASS, 3 tests.
- `npm.cmd run test:schemas`: PASS, 4 tests.
- `npm.cmd run check`: PASS, `BUNDLE_B_CHECK=PASS`.
- Runtime, `.clasp.json`, `appsscript.json`, and workbook unchanged checkers: PASS.
- `git diff --check`: PASS.
