# Writer Authority v3 integrated repair and exact lease disposition

TASK_ID=SGDS_WRITER_AUTHORITY_V3_INTEGRATED_REPAIR_AND_EXACT_LEASE_DISPOSITION
STATUS=ACTIVE
OWNER_AUTHORITY=OWNER_PLUS_CHATGPT
AUTHORITY_ID=SGDS_WRITER_AUTHORITY_V3_INTEGRATED_REPAIR_AND_EXACT_LEASE_DISPOSITION_V1_OWNER_APPROVED
RISK_CLASS=HIGH_CONCURRENCY_CONTROL_PLANE
OWNER_DECISION=GO_OPTION_2_WITH_GUARD_REFINEMENTS
BOOTSTRAP_CODER_THREAD_ID=01a02911-5e30-7861-90a3-bea10a4eb683
BOOTSTRAP_CODER_TASK_ID=SGDS_WRITER_AUTHORITY_V3_BOOTSTRAP_CODER_V1
BOOTSTRAP_CODER_ROLE=SOLE_SOURCE_WRITER
BOOTSTRAP_ALLOWED_PATH_MANIFEST_SHA256=8E67AA789A0A5BC696977B4F1D4E6D9AAAEBA946D64115159AF06E6FA75EDC86

OBJECTIVE=Perform one integrated Writer Authority v3 repair: preserve the exact forensic incident evidence, prove a trusted task-identity primitive before any v3 source implementation, close D1-D5 together only if that gate passes, validate, independently review and verify, reach stable control-plane zero state, then stop for the Owner checkpoint.

ACCEPTED_ROOT_CAUSE_CLUSTER=ACTIVE_STATE_DOES_NOT_ENCODE_ATOMIC_CANONICAL_EXCLUSIVE_TASK_OWNERSHIP
ACCEPTED_DEFECTS=D1_DATETIME_COERCION_DEFECT;D2_PARTIAL_ACTIVE_PUBLICATION_WINDOW;D3_SHARED_PROCESS_PID_USED_AS_EXCLUSIVE_WRITER_LIVENESS_IDENTITY;D4_ABNORMAL_DISPOSITION_GAP;D5_ACCEPTANCE_TEST_AND_CHECKER_COVERAGE_GAP
FORENSIC_INCIDENT_LEASE_ID=e669329330f941aa9e25b3af8c742953
FORENSIC_INCIDENT_LEASE_SHA256=6D8E6562D8A4F4DE0CDA9885EAFB0631C17538BE164232B148060B1ADAC4D9FB
FORENSIC_QUARANTINE_PATH=.git/writer-authority-forensic-quarantine/v2-active-e669329330f941aa9e25b3af8c742953-6D8E6562D8A4F4DE0CDA9885EAFB0631C17538BE164232B148060B1ADAC4D9FB.json
SHARED_CODEX_APP_SERVER_PID=2292

## Authority and source boundary

Exactly one bootstrap Coder may write, solely under the captured bootstrap identity above. The broken v2 helper must not authorize its own repair. No v2 AcquireWriter or VerifyWriter action is authorized. No second Coder, Primary source write, persistent bootstrap authority, or bootstrap/broker script is allowed.

The only permitted repository paths are:

- `docs/12_AI_WORK_LOG.md`
- `docs/13_DECISION_LOG.md`
- `docs/99_NEXT_AI_HANDOFF.md`
- `docs/exec-plans/active/D7_E4B2_POLICY_REPAIR_WRITER_LIFECYCLE_AND_MR2R_CLOSURE.md`
- `docs/exec-plans/active/SGDS_WRITER_AUTHORITY_V3_INTEGRATED_REPAIR_AND_EXACT_LEASE_DISPOSITION.md`
- `docs/exec-plans/completed/D7_E4B2_POLICY_REPAIR_WRITER_LIFECYCLE_AND_MR2R_CLOSURE.md`
- `package.json`
- `scripts/ai/Manage-NonWriterIsolation.ps1`
- `scripts/checkers/check-ai-governance-bootstrap.mjs`
- `scripts/test/run-all-checks.mjs`
- `tests/fixtures/writer-authority/**`
- `tests/unit/ai-governance-bootstrap.test.mjs`

No source, test, checker, or aggregate-wiring path may be changed before Phase 4 proves a trusted task/assignment identity primitive. If a persistent broker or any extra path is needed, stop for Owner Option 3.

## Completed incident disposition

Phases 0-2 are recorded as complete only with the exact forensic evidence supplied by the Owner. The exact v2 lease was preserved byte-for-byte at `FORENSIC_QUARANTINE_PATH`; no normal CompleteWriter, ReleaseWriter, RecoverWriter, JSON rewrite, evidence deletion, ACL/IAM change, or process termination occurred. PID 2292 remains untouched.

## Phase 3 — active-contract transition

Prepare this successor before removing the predecessor. Move the predecessor to `docs/exec-plans/completed/D7_E4B2_POLICY_REPAIR_WRITER_LIFECYCLE_AND_MR2R_CLOSURE.md`, then publish this exact active contract. Reprove exactly one non-dotfile active contract:

```text
ACTIVE_CONTRACT_COUNT=1
ACTIVE_CONTRACT=docs/exec-plans/active/SGDS_WRITER_AUTHORITY_V3_INTEGRATED_REPAIR_AND_EXACT_LEASE_DISPOSITION.md
```

A zero-active interval is permitted only inside this exact Owner-authorized transition. Failure to prove the count is a hard stop.

## Phase 4 — trusted task-identity hard gate

Perform a rigorous read-only audit of the actual current Codex execution environment. Determine whether an enforceable, trusted task/assignment identity primitive distinguishes the specific writer execution from unrelated tasks sharing the app server.

The primitive must not be satisfiable solely by shared app-server PID, executable hash, parent PID, caller-supplied task ID, caller-supplied runtime-session ID, caller-supplied thread text, or caller-supplied planned writer-instance ID.

Record:

```text
TRUSTED_TASK_IDENTITY_PROVEN_AVAILABLE=YES|NO
TRUSTED_TASK_IDENTITY_PRIMITIVE=
TRUSTED_TASK_IDENTITY_TRUST_BOUNDARY=
```

If not proven, do not invent a pseudo-capability, do not implement caller-asserted trusted identity, and do not weaken D3. Stop with `OPTION_2_BLOCKED_NO_TRUSTED_TASK_IDENTITY_PRIMITIVE`; the sole recommendation is `OPTION_3_DEDICATED_WRITER_AUTHORITY_BROKER_OR_EQUIVALENT`.

## Conditional implementation authority — only after Phase 4 PASS

Implement the Writer Authority v3 repair as one integrated candidate, preserving fail-closed v2 read compatibility and treating legacy/partial/abnormal ACTIVE authority explicitly. Canonical raw UTC timestamp normalization must have identical Windows PowerShell 5.1 and PowerShell 7 semantics and never use localized DateTime string identity comparison.

Verify must validate the full candidate before one atomic ACTIVE publication commit point. Verify, Complete, and Release must have explicit replay/idempotency semantics after response loss. Durable state/journal semantics must distinguish not committed, committed, terminal, and abnormal-reconciliation-required states. Acquire, Verify, Complete, Release, Inspect, and abnormal disposition must fail closed under concurrency.

Exclusive ownership must bind to the Phase 4 trusted primitive; shared app-server liveness is never sufficient. New isolation creation must be blocked while valid live source-writer authority exists. Mutation-capable timeout/transport loss must be reconcilable from durable transition/journal evidence. Never use process termination for recovery.

## Mandatory acceptance and validation

Implement and pass the entire A-Q matrix (17 pass, 0 fail, no skip/todo substitute): ISO generation, PowerShell 7 coercion, locale independence, shared app server/multiple tasks, exclusive trusted identity, pre-publication Verify failure, Verify response loss, partial/abnormal second-writer block, Complete replay, Release after abnormal disposition, task-complete/app-server-alive, restart/PID reuse, timeout/late reconciliation, unrelated-process/repository protection, Windows PowerShell 5.1 lifecycle, PowerShell 7 lifecycle, and checker recognition of this active contract and exact candidate scope.

Run focused writer-authority tests, focused governance checker, PowerShell 5.1 suite, PowerShell 7 suite, `git diff --check`, and the exact aggregate validation. An external required-path failure or need to weaken general checker safety is a hard stop; do not widen scope.

After final docs/source/tests/checkers, freeze bootstrap mutation, record exact changed paths and hashes, prove allowlist confinement, perform no staging, close the bootstrap authority, and prove zero active writer leases, transition locks, and active isolations before independent review.

Only then use separate helper-created Reviewer and Verifier isolations. Reviewer and Verifier independently assess D1-D5, trusted identity, compatibility, atomicity, replay, abnormal disposition, concurrency, isolation interlock, PS5/PS7, A-Q, forensic preservation, active-contract correctness, source hashes, candidate manifest, and zero-state. Any Reviewer P0/P1/P2 or any Verifier discrepancy is a hard stop. Preserve protected `w` and `w1` worktree administration untouched.

Final zero-state requires three spaced samples of zero active writer lease, zero transition lock, zero active isolation, one registered worktree, empty staging, protected `w`/`w1` untouched, and the exact forensic quarantine hash. Then stop at `CHECKPOINT_STATUS=PENDING_OWNER_DECISION` for an explicit Owner commit/push decision.

## Permanent prohibitions and hard stops

No process termination; no normal lifecycle action for the stuck incident; no RecoverWriter; no lease edit/delete; no fake state/lock; no source-path expansion; no protected guard changes; no Workflow V2/V3 package installation; no reset/stash/clean; no broad staging or wildcard cleanup; no touch/delete of `w`/`w1`; no clasp/GAS/production execution or Gmail/Drive/Sheets/Script Properties/Firestore/Firebase/trigger mutation; no commit, push, or deploy.

Hard stop on forensic identity/hash drift, inability to prove original Coder completion, uncertain quarantine completion, ambiguous bootstrap authority, a second writer, active-contract count failure, unavailable trusted identity, scope expansion, checker-safety weakening, any A-Q failure, unreconciled mutation-capable timeout, Reviewer P0/P1/P2, Verifier discrepancy, failed cleanup/zero-state, ACL/IAM/credential need, or privileged boundary.

## Required closeout

Report the Authority ID; bootstrap identity/state; forensic path/hash; previous/current active contracts and count; trusted identity result/primitive/trust boundary; D1-D5 and v3 status; exact changed paths and unauthorized count; A-Q and validation results; reviewer/verifier status; control-plane samples; protected worktree/staging/process impact; privileged-action flags; checkpoint; hard gate; recommended next direction; proposed envelope; and exact Owner decision required.
