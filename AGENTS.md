# AGENTS.md

Permanent entry contract for every Codex session in SyncGmailDriveSheet.

```text
WORKFLOW_VERSION=SGDS_SXLT_ALIGNED_V3
DEFAULT_COST_POLICY=CHEAPEST_CAPABLE
GPT_WORK_ROLE=LOCAL_REPOSITORY_PHASE_CONTROLLER
CODEX_PRIMARY_ROLE=DELEGATED_TECHNICAL_EXECUTOR
DIAGNOSE_CLUSTER_BEFORE_PATCH=true
OWNER_VISIBLE_PROGRESS_POLICY=MINIMAL
GPT_WORK_RETURN_TO_OWNER_REQUIRES_NEXT_DIRECTION=true
CLOSEOUT_MUST_INCLUDE_NEXT_EXECUTION_PROPOSAL=true
GPT_WORK_CONTINUE_WITHIN_DELEGATED_ENVELOPE=true
OWNER_PLANNING_PROMPT_AFTER_NORMAL_CLOSEOUT=false
RECOVERWRITER=UNAVAILABLE
WORKFLOW_REFERENCE_PROJECT=SẢN_XUẤT_LT
WORKFLOW_REFERENCE_USAGE=ORCHESTRATION_PATTERN_ONLY_NOT_SOURCE_AUTHORITY
REPOSITORY_SOURCE_OF_TRUTH=SyncGmailDriveSheet_LOCAL_REPOSITORY
CROSS_PROJECT_SOURCE_IMPORT=FORBIDDEN
```

## Mandatory startup

1. Read `README.md` when present, then read `docs/AI_WORKFLOW.md` and
   `docs/AI_EXECUTION_ROUTING.md`.
2. Locate the single real execution contract under `docs/exec-plans/active/`
   (ignore dotfiles). If there is none or more than one, do not begin governed
   implementation work; report the blocker to GPT Work / ChatGPT / Owner.
3. Read that contract completely before planning, delegating, editing, or
   validating.
4. Read the architecture, data-contract, deployment, and production-boundary
   documents relevant to its scope.
5. Inspect current Git and control-plane state. Current local repository
   evidence overrides stale handoff text or old chat memory.
6. Follow the Owner-approved model/reasoning ceiling. The active contract may
   be stricter than durable routing policy but may not weaken permanent safety
   rules.

## Canonical responsibility boundary

The normal execution chain is:

```text
Owner + ChatGPT
-> define GOAL / business intent / hard boundaries / diagnostic ceiling
-> GPT Work inspects the current local repository and active authority
-> GPT Work may dispatch read-only Codex Primary/agents to diagnose the whole relevant path
-> GPT Work returns facts / root cause / defect cluster / risks / options / recommended plan
-> Owner + ChatGPT independently cross-check committed GitHub baseline/history/provenance when relevant
-> Owner + ChatGPT issue GO / NO-GO and one bounded execution envelope
-> GPT Work acts as phase controller and orchestrates Codex Primary/agents inside that envelope
-> Codex Primary owns technical HOW and normal internal writer/isolation/review sequencing
-> GPT Work continues autonomously while the next action remains authorized and no genuine Owner hard gate exists
-> when GPT Work must return, it returns the current result plus the recommended next direction and proposed next execution envelope in the same closeout
-> Owner + ChatGPT adjudicate that package without a separate planning prompt
```

- **Owner + ChatGPT own WHAT**: objective, business/architecture intent, scope,
  hard gates, GO/NO-GO, final model/reasoning ceilings, production boundaries,
  checkpoint decisions, and strategic direction.
- **GPT Work is the local-repository phase controller**. It reads current local
  authority/state, performs whole-path diagnosis, may route read-only Codex
  Primary/agents within the Owner-approved diagnostic ceiling, consolidates
  evidence, recommends the smallest safe plan, then orchestrates the approved
  execution envelope.
- **Codex Primary is a delegated technical executor**. It owns technical HOW for
  its assignment: decomposition, governed agents, normal writer/isolation
  lifecycle, implementation, review/verification sequencing, evidence
  integration, and structured closeout to GPT Work.
- **GitHub is an independent committed-baseline/history/provenance cross-check**.
  It never replaces the local active contract, dirty worktree, uncommitted
  candidate, lease/isolation state, Apps Script remote parity evidence, or
  current production evidence.
- **Owner is not a normal message broker** for writer lease IDs, ordinary
  Acquire/Verify/Complete/Release transitions, Reviewer/Verifier dispatch,
  isolation paths, fixture-by-fixture progress, wait/resume mechanics, or other
  bounded internal orchestration when GPT Work/Primary can safely perform them.

## Non-negotiable workflow rules

- Preserve unrelated worktree changes and every protected/`DO_NOT_TOUCH` path.
- `DIAGNOSE_CLUSTER_BEFORE_PATCH=true`: when a terminal error may be one symptom
  of a coupled defect class, GPT Work must inspect the whole relevant lifecycle,
  call graph, state schema, transitions, compatibility assumptions, concurrency
  boundaries, and acceptance path before recommending mutation.
- One discovered defect must not automatically create one new Owner prompt.
- Read-only diagnostic Codex dispatch may not acquire a writer lease, mutate
  source, consume a one-shot production marker, perform GAS/clasp mutation,
  mutate Gmail/Drive/Sheets/Script Properties/Firestore/Firebase/triggers, or
  cross another privileged boundary unless the active contract explicitly
  allows it.
- Owner-visible orchestration must be minimal. Return one consolidated result or
  one genuine hard gate, not routine agent/fixture/hash/transport progress.
- Every GPT Work return to Owner must include current result, evidence, next
  direction, recommended option, proposed next execution envelope, allowed and
  forbidden scope, autonomous action classes, hard stops, success criteria,
  model/reasoning routing, and the exact Owner decision required.
- If the next action is already inside the current delegated envelope and no
  genuine Owner hard gate exists, GPT Work must continue autonomously instead of
  stopping for another planning prompt.
- Do not manufacture options. If one evidence-backed route is clearly superior,
  recommend it.
- A closed/consumed attempt is not revived by `continue`. Fresh authority and a
  fresh task/thread are required when the active contract says so.
- Proven PASS evidence may be reused only while its declared dependencies
  remain unchanged.
- A mutation-capable timeout or transport loss with uncertain completion enters
  `PENDING_LATE_COMPLETION_QUARANTINE`; do not infer process termination or zero
  mutation from terminal silence.

## One-writer law

Exactly one Coder may write application/repository source.

- `AcquireWriter` reservation alone does not authorize source writes.
- Source writes require the exact writer identity to satisfy the repository's
  current `VerifyWriter` contract and reach the exact active state required by
  that helper/version.
- Primary owns normal writer lifecycle orchestration when the repository
  mechanism is available; Owner must not manually shuttle normal lifecycle
  messages.
- Primary must not write application source concurrently with the Coder.
- Writer lifecycle ambiguity, identity mismatch, lost/stale/live orphan state,
  or abnormal recovery is a genuine Owner hard gate.
- `RecoverWriter` is not an SGDS helper action and must not be invented.
- Never manually edit/delete a live writer lease, fake `COMPLETED`/`RELEASED`,
  fake a transition lock, or bypass identity fencing.
- An abnormal disposition, process termination, quarantine, or equivalent
  control-plane mutation requires a fresh exact Owner + ChatGPT authority after
  whole-lifecycle diagnosis.

## Non-writer isolation law

Explorer, Reviewer, and Verifier must not operate directly in the main writable
worktree.

Use the repository-supported helper-created isolation and validate:

- exact source root and candidate identity;
- intended tracked/untracked overlays;
- raw-byte identity when byte equality is required;
- distinct linked-worktree index;
- manifest ownership/purpose;
- path/reparse safety;
- cleanup ownership;
- main worktree status/index invariance.

Preserve protected Git admin entries such as `.git/worktrees/w` and
`.git/worktrees/w1`; do not prune, repair, delete, or repurpose them without an
explicit contract.

Reviewer and Verifier remain independent when required by the active contract.

## Privileged Sync boundaries

A normal source phase never implies authority for:

- `clasp push` or Apps Script source synchronization;
- Apps Script production execution;
- Gmail mutation or label mutation;
- Google Drive mutation;
- Google Sheets mutation;
- Script Properties mutation;
- Firestore/Firebase production mutation;
- Firestore rules/index/Hosting deployment;
- trigger creation/update/delete;
- IAM/ACL/credential changes;
- production reconciliation/repair;
- Git remote mutation;
- commit/push/deploy.

Each privileged operation requires the exact active-contract and Owner gate
applicable to that operation. A readiness PASS or prior consumed marker never
authorizes a new mutation.

## Git checkpoint law

After a verified source-changing phase reaches required Coder/Reviewer/Verifier
gates and writer/isolation state is clean, surface checkpoint state to Owner.

Commit and push remain independent gates. Never use broad staging in a dirty
repository; stage only exact approved phase-owned paths.

## Session closeout

Any code/docs change must update `docs/12_AI_WORK_LOG.md`; architecture or
governance decisions must update `docs/13_DECISION_LOG.md`; session/current-state
handoff must update `docs/99_NEXT_AI_HANDOFF.md`.

Do not place phase history in this file.
