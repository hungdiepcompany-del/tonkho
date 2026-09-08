# AI Workflow

Canonical technical multi-agent operating policy for SyncGmailDriveSheet.
Task-specific executable authority belongs only to the single active execution
contract. Cross-session responsibility and model routing are defined canonically
in `docs/AI_EXECUTION_ROUTING.md`.

```text
WORKFLOW_VERSION=SGDS_SXLT_ALIGNED_V3
DEFAULT_COST_POLICY=CHEAPEST_CAPABLE
ONE_WRITER_POLICY=EXACTLY_ONE_SOURCE_WRITER
GPT_WORK_ROLE=LOCAL_REPOSITORY_PHASE_CONTROLLER
CODEX_PRIMARY_ROLE=DELEGATED_TECHNICAL_EXECUTOR
DIAGNOSE_CLUSTER_BEFORE_PATCH=true
OWNER_VISIBLE_PROGRESS_POLICY=MINIMAL
GPT_WORK_RETURN_TO_OWNER_REQUIRES_NEXT_DIRECTION=true
CLOSEOUT_MUST_INCLUDE_NEXT_EXECUTION_PROPOSAL=true
GPT_WORK_CONTINUE_WITHIN_DELEGATED_ENVELOPE=true
OWNER_PLANNING_PROMPT_AFTER_NORMAL_CLOSEOUT=false
VERIFIED_CHECKPOINT_POLICY=OWNER_DECISION_AFTER_VERIFIED_SOURCE_PHASE
RECOVERWRITER=UNAVAILABLE
WORKFLOW_REFERENCE_PROJECT=SẢN_XUẤT_LT
WORKFLOW_REFERENCE_USAGE=ORCHESTRATION_PATTERN_ONLY_NOT_SOURCE_AUTHORITY
REPOSITORY_SOURCE_OF_TRUTH=SyncGmailDriveSheet_LOCAL_REPOSITORY
CROSS_PROJECT_SOURCE_IMPORT=FORBIDDEN
```

Owner + ChatGPT own `RISK_CLASS`, `OBJECTIVE`, `ACCEPTANCE_CRITERIA`,
`MODEL_CEILING`, `REASONING_CEILING`, `PRODUCTION_BOUNDARY`, strategic scope,
and Owner gates. GPT Work is the local-repository phase controller. Codex
Primary is the delegated technical executor. The active contract may impose
stricter task-specific rules but must not weaken permanent safety boundaries.

## CROSS_SESSION_ROUTING_BRIDGE

```text
Owner + ChatGPT
-> define GOAL / business intent / hard boundaries / diagnostic ceiling
-> GPT Work inspects current local repo + active contract + control plane
-> GPT Work may call read-only Codex Primary/agents to diagnose the whole relevant path
-> GPT Work returns facts / root cause / defect cluster / risks / options / recommendation / routing
-> Owner + ChatGPT cross-check GitHub committed baseline/history/provenance when relevant
-> Owner + ChatGPT approve or override one bounded execution envelope
-> GPT Work orchestrates Codex Primary/agents inside that envelope
-> Codex Primary owns technical HOW and normal internal mechanics
-> GPT Work continues autonomously while the next action remains authorized and no genuine Owner hard gate exists
-> if GPT Work must return, the same closeout contains current result + next direction + proposed next envelope
-> Owner + ChatGPT adjudicate without a separate planning round
```

Use current local repository evidence for dirty/uncommitted execution state.
GitHub is authoritative only for the committed remote facts it proves.

## GPT_WORK_PHASE_CONTROLLER_AND_DIAGNOSTIC_POLICY

Stable rules:

```text
GPT_WORK_ROLE=LOCAL_REPOSITORY_PHASE_CONTROLLER
DIAGNOSE_CLUSTER_BEFORE_PATCH=true
OWNER_SHOULD_NOT_DESIGN_IMPLEMENTATION_FROM_TERMINAL_ERROR_ALONE=true
GPT_WORK_MUST_INSPECT_LOCAL_SOURCE_BEFORE_RECOMMENDING_REPAIR=true
ONE_DEFECT_REPORT_DOES_NOT_EQUAL_ONE_OWNER_PROMPT=true
GITHUB_ROLE=INDEPENDENT_COMMITTED_BASELINE_HISTORY_PROVENANCE_CHECK
GITHUB_DOES_NOT_REPLACE_LOCAL_DIRTY_STATE=true
OWNER_VISIBLE_PROGRESS_POLICY=MINIMAL
```

When repository-specific uncertainty is material, GPT Work performs a read-only
whole-path diagnostic before requesting mutation authority. Inspect, as
applicable:

- call graph and role boundaries;
- state schema and every writer of lifecycle fields;
- state-transition map;
- lease/lock/isolation/concurrency behavior;
- identity and replay semantics;
- PowerShell 5.1 / Node / Apps Script compatibility assumptions;
- checker/test expectations;
- current Git index/worktree;
- remote Apps Script parity when relevant;
- existing acceptance path and production gates.

Separate:

```text
PROVEN_FACTS
PROVEN_DEFECTS
HYPOTHESES
UNPROVEN_RISKS
AFFECTED_ACCEPTANCE_CRITERIA
```

Prefer:

```text
whole-path diagnosis
-> freeze proven defect cluster and acceptance matrix
-> one integrated bounded candidate where practical
-> full bounded regression
-> governed mutation
-> independent review / verification
-> terminal closeout
```

Do not patch one terminal symptom before determining whether it belongs to a
coupled defect cluster.

A diagnostic closeout should provide:

```text
REPOSITORY_PROVEN_FACTS=
ROOT_CAUSE=
PROVEN_DEFECT_INVENTORY=
UNPROVEN_RISKS=
AFFECTED_ACCEPTANCE_CRITERIA=
OPTIONS=
RECOMMENDED_OPTION=
RECOMMENDED_PLAN=
RECOMMENDED_ROUTING=
PROPOSED_NEXT_EXECUTION_ENVELOPE=
HARD_GATES=
MUTATION_REQUIRED=true|false
```

Read-only diagnostic work does not authorize writer acquisition, source
mutation, clasp/GAS execution, Gmail/Drive/Sheets/Script Properties mutation,
Firestore/Firebase mutation, trigger mutation, commit, push, deploy, or
production repair.

## PHASE_CONTROLLER_CONTINUATION_AND_HANDOFF_POLICY

Returning a result without a repository-grounded next direction is incomplete
unless no meaningful next action exists.

```text
GPT_WORK_RETURN_TO_OWNER_REQUIRES_NEXT_DIRECTION=true
CLOSEOUT_MUST_INCLUDE_NEXT_EXECUTION_PROPOSAL=true
OWNER_PLANNING_PROMPT_AFTER_NORMAL_CLOSEOUT=false

IF_NEXT_ACTION_WITHIN_CURRENT_DELEGATED_ENVELOPE=true
AND_GENUINE_OWNER_HARD_GATE=false
THEN_GPT_WORK_MUST_CONTINUE_AUTONOMOUSLY=true
```

Do not return for routine:

- quoting/serialization;
- content-address or hash rebinding;
- exact package path resolution;
- ordinary agent handoff;
- normal writer lifecycle transport;
- normal isolation creation/cleanup;
- wait/resume mechanics;
- fixture-by-fixture progress;
- bounded same-scope evidence capture;
- one causal same-scope correction explicitly authorized by the active contract.

At a terminal result or genuine hard gate, return where applicable:

```text
CURRENT_STAGE_RESULT=
FACTS=
EVIDENCE=
UNRESOLVED_BLOCKERS=
GOAL_ALIGNMENT_GATE=
NEXT_DIRECTION=
EXECUTION_OPTIONS_COUNT=
RECOMMENDED_OPTION=
RECOMMENDATION_REASON=
PROPOSED_NEXT_OBJECTIVE=
PROPOSED_NEXT_EXECUTION_ENVELOPE=
PROPOSED_ALLOWED_SCOPE=
PROPOSED_FORBIDDEN_SCOPE=
PROPOSED_AUTONOMOUS_ACTIONS=
PROPOSED_HARD_STOPS=
PROPOSED_SUCCESS_CRITERIA=
NEXT_PRIMARY_MODEL=
NEXT_PRIMARY_REASONING=
NEXT_CODER_MODEL=
NEXT_CODER_REASONING=
NEXT_REVIEWER_MODEL=
NEXT_REVIEWER_REASONING=
NEXT_VERIFIER_MODEL=
NEXT_VERIFIER_REASONING=
CHEAPEST_CAPABLE_MODEL_CONFIRMED=
OWNER_DECISION_REQUIRED=
IF_OWNER_GO_NEXT_ACTION=
```

Do not manufacture multiple options when one route is clearly superior.

This policy never expands authority. Genuine Owner gates include:

- abnormal writer recovery/disposition;
- source/task/governance scope expansion;
- architecture or data-contract change;
- permission/ACL/IAM/credential change;
- model/reasoning escalation beyond ceiling;
- checkpoint commit/push;
- clasp/GAS source sync when privileged;
- production Apps Script execution;
- Gmail/Drive/Sheets/Script Properties mutation;
- Firestore/Firebase/triggers;
- production reconciliation/repair;
- deployment;
- destructive operation;
- consumed one-shot/fresh-attempt authority;
- stricter active-contract gate.

## RISK_CLASSIFICATION_POLICY

- `LOW`: bounded docs/tooling/tests with no production mutation and simple
  rollback.
- `MEDIUM`: normal implementation or multi-file local repair without privileged
  production mutation.
- `HIGH / PRODUCTION`: data integrity, security/auth, concurrency, durable
  workflow, production operations, reconciliation, deployment, or consequential
  rollback decisions.

Risk class does not grant privileged authority.

## MODEL_ROUTING_POLICY

Use `DEFAULT_COST_POLICY=CHEAPEST_CAPABLE`.

Baseline:

```text
GPT Work simple inspection = GPT-5.6 Terra / Vừa
GPT Work normal phase control = GPT-5.6 Terra / Cao
GPT Work HIGH/production = GPT-5.6 Sol / Cao
GPT Work difficult adjudication = GPT-5.6 Sol / Chuyên sâu

Explorer = GPT-5.6 Luna / Nhẹ nhàng or Vừa
Coder = GPT-5.6 Terra / Cao
Reviewer = GPT-5.6 Terra / Cao
Verifier = GPT-5.6 Terra / Cao
Primary MEDIUM = GPT-5.6 Terra / Cao
Primary HIGH = GPT-5.6 Sol / Cao
```

No silent escalation. If a named model is unavailable, report it and recommend
the cheapest capable supported equivalent.

## ONE_WRITER_POLICY

Exactly one Coder may write application/repository source.

Normal technical lifecycle is internally orchestrated by Codex Primary when the
active contract and repository helper permit it. Owner must not manually relay
normal lifecycle mechanics.

Permanent Sync constraints:

```text
RESERVED_AUTHORIZES_SOURCE_WRITE=false
WRITER_IDENTITY_MUST_BE_PROVEN=true
SECOND_WRITER_FAILS_CLOSED=true
ABNORMAL_WRITER_RECOVERY_OWNER_GATED=true
RECOVERWRITER=UNAVAILABLE
```

If stable writer identity cannot be proven, no source write is authorized.

Do not invent a recovery action. Inspect the actual current helper/source and
its tests. If a live/stale/orphan/partial-state writer cannot be resolved by a
proven normal supported transition, stop at a fresh Owner abnormal-recovery
gate with a whole-lifecycle defect map and proposed disposition envelope.

Never manually edit/delete a live lease, forge lifecycle state, or use process
termination/quarantine without explicit Owner authority tied to exact identity
and evidence.

## NON_WRITER_ISOLATION_POLICY

Explorer, Reviewer, and Verifier must use validated helper-created isolation,
not the main writable worktree.

For tracked-dirty candidates requiring byte identity, use the repository's
approved raw-byte overlay/materialization path and prove source-before,
source-after, and destination hashes where the current helper requires them.

Validate manifest ownership, source/worktree mapping, purpose, overlays,
distinct linked index, path/reparse safety, and cleanup invariants.

Never prune or alter protected Git admin entries merely to satisfy a checker.

## PRIMARY_ORCHESTRATION_POLICY

Primary reads the active contract first, audits inherited state, maps acceptance
criteria to evidence, and decomposes only bounded tasks.

Primary owns technical HOW, including normal internal:

```text
writer lifecycle
non-writer isolation
Coder dispatch
Reviewer dispatch
Verifier dispatch
evidence integration
bounded retry/correction already authorized by the envelope
```

GPT Work remains phase controller and adjudicates Primary closeout against the
Owner envelope.

If Primary cannot prove safe internal orchestration, return one concise blocker
to GPT Work. GPT Work decides whether it is inside the current envelope or a
genuine Owner gate.

## SUBAGENT_RESULT_PROTOCOL

Every subagent returns:

```text
TASK_ID=
SUBTASK_ID=
ROLE=
STATUS=PASS|FAIL|BLOCKED|NOT_PROVEN|ESCALATION_REQUIRED
FACTS=
EVIDENCE=
FINDINGS=
FILES_READ=
FILES_CHANGED=
CURRENT_MODEL=
CURRENT_REASONING=
ESCALATION_REQUIRED=true|false
ESCALATION_REASON=
RECOMMENDED_MODEL=
RECOMMENDED_REASONING=
NEXT_RECOMMENDATION=
```

`NOT_PROVEN` is not PASS.

## GIT_POLICY

Preserve inherited branch, index, tracked/untracked changes, and protected
paths. No destructive reset/restore/clean/stash/branch rewrite. Isolation cleanup
may remove only exact helper-owned artifacts after identity validation.

## VERIFIED_CHECKPOINT_POLICY

After a source-changing phase passes required Coder/check/Reviewer/Verifier
gates and writer/isolation state is clean, report:

```text
CHECKPOINT_STATUS=
CHECKPOINT_DECISION_REQUIRED=
CHECKPOINT_COMMIT_HASH=
CHECKPOINT_PUSHED_REMOTE=
CHECKPOINT_DEFERRED=
CHECKPOINT_DEFER_REASON=
```

Commit and push require separate explicit permission. Never use broad staging in
a dirty repo. Stage exact approved phase-owned paths only.

Prefer a reviewed/verified checkpoint before production-facing validation,
clasp/GAS source sync, deployment, or another materially higher-risk phase when
the active contract permits it.

## COMMIT_POLICY

Commit only with exact contract/Owner permission. Before commit, prove the staged
set contains only approved paths. Commit permission does not imply push.

## PUSH_POLICY

Push only with exact permission and exact branch/commit identity. Push does not
authorize clasp/GAS, deploy, or production mutation.

## PRIVILEGED_SYNC_POLICY

Separate Owner gates remain mandatory when required for:

- clasp/GAS source synchronization;
- Apps Script production execution;
- Gmail or label mutation;
- Drive mutation;
- Sheets mutation;
- Script Properties mutation;
- Firestore/Firebase production mutation;
- Firestore rules/index/Hosting deployment;
- trigger mutation;
- IAM/ACL/credential changes;
- production reconciliation/repair;
- destructive operation.

Consumed authorization is never silently reused.

## BLOCKER_POLICY

Report exact blocker, affected acceptance criteria, evidence already collected,
and the smallest safe next action. A hard-gate closeout must also contain the
recommended next direction and proposed next execution envelope.

Do not convert BLOCKED or NOT_PROVEN into PASS by reasoning alone.

## RETRY_POLICY

No blind retries. Before retrying:

1. classify the prior outcome;
2. prove the prior attempt's side effects or absence;
3. identify a changed condition or bounded diagnostic value;
4. prove the active contract allows another attempt;
5. obtain fresh Owner authority when the previous attempt/marker was consumed.

A mutation-capable timeout with unknown completion enters
`PENDING_LATE_COMPLETION_QUARANTINE`.

## SESSION_RESUME_POLICY

A new session relies on current repository evidence, not old chat history:

1. read governance;
2. find exactly one active contract;
3. inspect current Git/control-plane state;
4. distinguish done/incomplete/unvalidated/blocked;
5. report checkpoint state;
6. reuse still-valid proven evidence;
7. continue from the current gate without replaying consumed work.

If repository evidence conflicts with remembered/chat evidence, stop and
reconcile the authority conflict.

## WRITER_AUTHORITY_V3_CONTROLLER_MODEL

For the cooperative single-user local threat model, Writer Authority v3 uses a
controller-owned logical assignment and an atomic durable slot. Logical IDs
fence accidental cross-assignment and replay; they are not hostile-user
credentials or trusted task attestation. PID, process liveness, thread,
session, environment, account metadata, and lease expiry never determine writer
authority. Legacy v2, corrupt, partial, or contradictory live state blocks new
mutation pending explicit Owner disposition. Writer assignment and non-writer
isolation registration share durable transition serialization.
