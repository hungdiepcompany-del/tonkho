# D7-E4E Validated Job Recovery Runtime

PHASE=D7_E4E_VALIDATED_JOB_RECOVERY_RUNTIME
MODE=LOCAL_RUNTIME_IMPLEMENTED_NOT_SYNCED_NOT_EXECUTED
STATUS=LOCAL_CANDIDATE_IMPLEMENTED

## Objective

D7-E4E implements the bounded runtime required to resume the one exact existing
job proven by D7-E4D. It preserves the current deterministic job identity and
does not create a successor job, attempt generation, attachment record, or new
reconciliation report.

JOB_DISPOSITION=PRESERVE_EXISTING_JOB_ID
CAPABILITY_STATUS=PASS_7_OF_7
SOURCE_SYNC=NO
PRODUCTION_EXECUTION_AUTHORIZED=NO

## Required State Path

`VALIDATED -> FILES_SAVED -> COMMITTING -> ROWS_COMMITTED -> INVENTORY_PENDING -> PROJECTIONS_COMMITTED -> COMPLETED`

The runtime verifies current identity and fresh D7-E4D evidence before claiming
the one-shot marker. It then reacquires the exact reconciliation lease, writes
or verifies Drive evidence, Hoa-Don, the immutable ledger, inventory, and Gmail
projection in order, and completes only after one final read-only verification.

## Safety Contract

- The marker is consumed exactly once before any lease or external write.
- Unknown mutation outcome enters `PENDING_LATE_COMPLETION_QUARANTINE`.
- Native exceptions from mutation-capable calls are unknown unless the adapter
  explicitly proves `CONFIRMED_NOT_WRITTEN`.
- Resolved adapter responses must explicitly report `status=PASS`; null,
  blocked, or otherwise unconfirmed responses enter quarantine before the next
  durable transition.
- Unknown outcome never triggers speculative retry, compensation, or lease
  finalization.
- Known failure may close the proven lease as `RECONCILIATION_REQUIRED`.
- No runtime path creates a job, attachment record, replacement attempt, or
  reconciliation report.
- The exact write budget is immutable and checked before and after execution.

## Local Boundary

This phase only creates and validates local source. It does not set a marker,
push Apps Script source, invoke the entrypoint, access production, deploy, or
authorize any write. Source synchronization and production execution remain
separate Owner gates.

CLASP_PUSH=NO
GAS_EXECUTION=NO
PRODUCTION_MUTATION=NONE
COMMIT_PUSH=NO

## Acceptance

FOCUSED_TEST=34_PASS_0_FAIL_0_SKIP_0_TODO
FOCUSED_CHECKER=PASS
GOVERNANCE_A_Q=17_PASS_0_FAIL_0_SKIP_0_TODO
FULL_LOCAL_ACCEPTANCE=825_TOTAL_824_PASS_0_FAIL_1_EXPECTED_SKIP_0_TODO
INDEPENDENT_REVIEW=REQUIRED
INDEPENDENT_TEST=REQUIRED

## Review P1 Correction

The initial independent review found that untagged native exceptions from
mutation-capable calls could incorrectly enter the known-failure lease-close
path. The correction wraps every mutation-capable call, treats native and
unconfirmed responses as unknown, preserves explicitly confirmed outcomes, and
promotes an uncertain failure-lease finalization to quarantine.

A second independent review found that resolved `null`, `BLOCKED`, or
`NOT_CONFIRMED` adapter values could still advance durable state. Correction V2
requires explicit `PASS`, an exact non-negative mutation count, and
`AUDIT_EVENT_APPENDED` for the completion audit. Any missing or malformed
confirmation is quarantined without speculative lease finalization.

A third independent review found that Gmail projection reused a preflight
array index after a fresh search. Correction V3 resolves the fresh result by
the exact D7-B SHA-256 thread hash, requires exactly one identity match, and
blocks before label mutation when the thread identity drifts or is ambiguous.

A fourth independent review found that a resolved but unconfirmed failure-path
lease close could preserve the original known blocker. Correction V4 requires
the exact `RECONCILIATION_REQUIRED` status and numeric mutation count `1`;
null, blocked, or malformed close responses promote the result to quarantine.

A fifth independent review found that final verification reused booleans from
earlier adapter calls. Correction V5 performs five fresh read-only checks of
Drive, Hoa-Don, immutable ledger, recomputed inventory, and exact Gmail labels
immediately before the `COMPLETED` transition.

A sixth independent review found that final inventory verification did not use
the date semantics of the inventory rebuild and treated a string cutoff as
unbounded. Correction V6 uses `parseInvoiceDateValue_` for source rows and the
requested cutoff, preserves valid Date cells and supported day-first strings,
normalizes the cutoff to a Date before `capNhatTonKho`, and blocks before the
inventory mutation or completion when either date is invalid.

V6 focused acceptance is 39 tests with zero failures, skips, or todos. The
dedicated runtime checker passes. Full local acceptance is 830 tests with 829
passes, zero failures, one expected skip, and zero todos.

A seventh independent review found that the writer still discarded parsed
string source dates during cutoff filtering. Correction V7 normalizes a
nonblank requested cutoff with `parseInvoiceDateValue_`, blocks invalid values
before any inventory write, and uses parsed source dates for sorting, filtering,
and the no-cutoff maximum date. The normalized cutoff becomes the output update
date; no cutoff remains a full rebuild. Its regression executes the real
inventory writer with Date, ISO, and day-first source values and proves that
the final verifier accepts the exact writer output.

V7 focused acceptance is 41 tests with zero failures, skips, or todos. Full
local acceptance is 832 tests with 831 passes, zero failures, one expected
skip, and zero todos.

An eighth independent review found that the final inventory verifier did not
read `TonKho!H6`, allowing the recomputed rows to pass while the writer's
cutoff evidence drifted. Correction V8 freshly reads H6, parses it with the
same shared date semantics as the plan cutoff, and requires equal epoch values
before `COMPLETED`. Blank, invalid, and drifted values fail closed. The writer
also normalizes a nonblank cutoff before its zero-invoice-row early completion
path, preserving blank/no-cutoff cleanup behavior.

V8 focused acceptance is 45 tests with zero failures, skips, or todos. Full
local acceptance is 836 tests with 835 passes, zero failures, one expected
skip, and zero todos.

## V9 Final Evidence Documentation Closeout

V8 completed normally at WriterComplete revision 295 and ControllerRelease to
slot NONE at revision 296. Independent Sol review passed with no P0 or P1
findings. Its sole accepted residual P2 requests a deeper combined
final-transition regression; it is not a production-safety blocker.

Independent Luna testing passed: `npm run check` exited 0,
`BUNDLE_C_AGGREGATE_CHECK=PASS`, the focused runtime suite was 45/45, and
governance A-Q was 17/17. It confirmed the exact 17 changed paths, a passing
diff check, and made no edits. Controller full-suite evidence is 836 total,
835 pass, 0 fail, 1 expected skip, and 0 todo.

V9 documentation closeout is active at Writer Authority v3 revision 298,
pending only WriterComplete revision 299 and ControllerRelease revision 300.
Production access, source synchronization, staging, commit, push, and deploy
remain NONE. The candidate stops at the exact 17-path checkpoint commit gate.
