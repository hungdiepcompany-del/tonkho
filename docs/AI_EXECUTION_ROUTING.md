# AI Execution Routing

Canonical cross-session responsibility, model-routing, and phase-handoff policy
for SyncGmailDriveSheet.

```text
STATUS=ACTIVE
WORKFLOW_VERSION=SGDS_SXLT_ALIGNED_V3
DEFAULT_COST_POLICY=CHEAPEST_CAPABLE
MODEL_ROUTING_APPROVAL=OWNER_PLUS_CHATGPT
GPT_WORK_ROLE=LOCAL_REPOSITORY_PHASE_CONTROLLER
CODEX_PRIMARY_ROLE=DELEGATED_TECHNICAL_EXECUTOR
GITHUB_ROLE=OWNER_CHATGPT_COMMITTED_BASELINE_HISTORY_PROVENANCE_CHECK
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

This document complements `AGENTS.md`, `docs/AI_WORKFLOW.md`, and the single
current active execution contract. The active contract may be stricter but may
not weaken permanent repository safety rules.

## 1. Canonical responsibility model

```text
Owner + ChatGPT
-> define WHAT / GOAL / business intent / hard boundaries / diagnostic ceiling
-> GPT Work inspects current local repository and active authority
-> GPT Work may dispatch read-only Codex Primary/agents to diagnose the whole relevant path
-> GPT Work returns facts / root cause / defect cluster / risks / options / recommended plan
-> Owner + ChatGPT cross-check GitHub committed evidence when relevant
-> Owner + ChatGPT approve / override one bounded execution envelope
-> GPT Work acts as phase controller and orchestrates Codex Primary/agents
-> Codex Primary owns technical HOW and normal internal lifecycle mechanics
-> if the next action is still inside the envelope and no genuine Owner hard gate exists, GPT Work continues autonomously
-> when GPT Work must return, it returns current result + recommended next direction + proposed next execution envelope
-> Owner + ChatGPT adjudicate and issue GO / NO-GO / boundary changes without a separate planning prompt
```

### Owner + ChatGPT

Own strategic WHAT and final authority:

- project/phase objective;
- business/architecture intent;
- scope and hard boundaries;
- GO/NO-GO;
- model/reasoning ceilings;
- abnormal recovery;
- checkpoint commit/push;
- clasp/GAS/production/deploy/destructive gates;
- final next-direction decision.

Do not design repository-specific repair from one terminal error when GPT Work
can inspect the actual source and whole lifecycle.

Do not act as a manual message broker for normal writer/agent/isolation
mechanics.

### GPT Work

GPT Work is the `LOCAL_REPOSITORY_PHASE_CONTROLLER`.

Responsibilities:

- read durable governance and sole active contract;
- inspect local Git, dirty state, leases/locks/isolation, current candidate, and
  relevant runtime/remote parity evidence;
- reconcile stale handoff/chat claims with current repo facts;
- perform whole-path diagnosis before proposing mutation when root cause or
  coupled defect scope is not proven;
- dispatch the cheapest-capable read-only Codex Primary/agents within the
  approved diagnostic ceiling when useful;
- separate proven facts, defects, hypotheses, and unproven risks;
- consolidate a defect cluster instead of creating one Owner prompt per symptom;
- recommend one preferred plan, routing, hard gates, and smallest safe envelope;
- after Owner approval, orchestrate the envelope and adjudicate Primary
  closeouts;
- return only a terminal result or genuine hard gate wherever possible;
- include the next-direction package whenever it returns.

Read-only diagnostic orchestration does not itself authorize source mutation,
writer acquisition, clasp/GAS, production mutation, commit, push, or deploy.

### Codex Primary

Codex Primary is a `DELEGATED_TECHNICAL_EXECUTOR` controlled by GPT Work inside
the approved envelope.

Primary owns assigned HOW, including where applicable:

- source/call-graph investigation;
- technical decomposition;
- internal agents;
- normal writer lifecycle;
- isolation lifecycle;
- implementation;
- test/review/verification sequencing;
- evidence integration;
- bounded retry decisions already authorized;
- structured closeout back to GPT Work.

A diagnostic Primary may be read-only. An execution Primary may mutate source
only when the active contract and Owner envelope authorize it.

### GitHub

GitHub is an independent committed evidence source for baseline identity,
history, provenance, and pushed commit identity.

It does not replace local active authority, dirty state, uncommitted candidate,
lease/isolation state, Apps Script remote-source parity, or live production
evidence.

## 2. Repository authority order

For execution:

1. `AGENTS.md`
2. `docs/AI_WORKFLOW.md`
3. `docs/AI_EXECUTION_ROUTING.md`
4. exactly one active execution contract
5. current source/runtime/remote-parity evidence
6. current Git/control-plane state
7. `docs/99_NEXT_AI_HANDOFF.md`
8. `docs/12_AI_WORK_LOG.md`

Conversation memory never overrides current repository evidence.

## 3. Phase-level interaction policy

Preferred interaction cost:

```text
1 GPT Work local-repo diagnostic/planning pass
  including read-only Codex dispatch when useful
-> 1 consolidated result
-> 1 Owner + ChatGPT adjudication
-> 1 bounded execution envelope
-> autonomous GPT Work / Codex execution
-> 1 terminal result or 1 genuine hard gate
```

```text
DIAGNOSE_CLUSTER_BEFORE_PATCH=true
ONE_DEFECT_REPORT_DOES_NOT_EQUAL_ONE_OWNER_PROMPT=true
OWNER_VISIBLE_PROGRESS_POLICY=MINIMAL
```

Additional Owner interaction is for genuine boundaries such as abnormal writer
recovery, scope/architecture/governance semantic expansion, privileged Sync
operations, model-ceiling escalation, checkpoint commit/push, deploy, or
destructive production repair.

## 4. Cheapest-capable model policy

```text
DEFAULT_COST_POLICY=CHEAPEST_CAPABLE
```

Use the least expensive model/reasoning combination reasonably capable of the
assigned role. No silent escalation or silent model substitution.

## 5. Reasoning labels

Use:

```text
Nhẹ nhàng
Vừa
Cao
Chuyên sâu
Tối đa
Cực cao
```

`Tối đa` and `Cực cao` are exceptional.

## 6. GPT Work routing baseline

```text
Simple repository inspection:
MODEL=GPT-5.6 Terra
REASONING=Vừa

Normal phase planning/control:
MODEL=GPT-5.6 Terra
REASONING=Cao

HIGH / production-sensitive planning:
MODEL=GPT-5.6 Sol
REASONING=Cao

Difficult conflicting-evidence / concurrency / recovery adjudication:
MODEL=GPT-5.6 Sol
REASONING=Chuyên sâu
```

## 7. Codex role routing baseline

```text
Explorer:
GPT-5.6 Luna / Nhẹ nhàng or Vừa

Coder:
GPT-5.6 Terra / Cao

Reviewer:
GPT-5.6 Terra / Cao

Verifier:
GPT-5.6 Terra / Cao

Primary MEDIUM:
GPT-5.6 Terra / Cao

Primary HIGH:
GPT-5.6 Sol / Cao

Primary difficult root-cause / abnormal writer / concurrency:
GPT-5.6 Sol / Chuyên sâu
```

Do not dispatch agents merely to satisfy an agent count.

## 8. Model-approval protocol

Every GPT Work result preparing source-changing or privileged execution should
return:

```text
RISK_CLASS=
GPT_WORK_MODEL=
GPT_WORK_REASONING=
PRIMARY_MODEL=
PRIMARY_REASONING=
PRIMARY_MODEL_JUSTIFICATION=
EXPLORER_MODEL=
EXPLORER_REASONING=
CODER_MODEL=
CODER_REASONING=
CODER_MODEL_JUSTIFICATION=
REVIEWER_MODEL=
REVIEWER_REASONING=
VERIFIER_MODEL=
VERIFIER_REASONING=
CHEAPEST_CAPABLE_MODEL_CONFIRMED=true|false
ESCALATE_IF=
DOWNGRADE_IF=
MODEL_ROUTING_IS_RECOMMENDATION_ONLY=true
```

Owner + ChatGPT approve or override ceilings.

## 9. Required execution header for Owner-facing prompts

Whenever ChatGPT tells Owner to run a prompt, display before the copyable block:

```text
GỬI CHO:
MODEL:
REASONING:
ROLE:
EXECUTION_MODE:
MỤC TIÊU:
VÌ SAO CHỌN MODEL NÀY:
DONE WHEN:
```

The prompt must target exactly one execution surface.

## 10. Multi-agent routing

Typical MEDIUM flow:

```text
GPT Work
-> Primary
-> Explorer if needed
-> exactly one Coder
-> independent Reviewer + Verifier when required
-> Primary closeout
-> GPT Work adjudication
```

Typical HIGH flow:

```text
GPT Work
-> read-only whole-path diagnosis / independent analysis when warranted
-> Owner bounded execution GO
-> Primary
-> exactly one Coder
-> independent Reviewer
-> independent Verifier
-> Primary closeout
-> GPT Work terminal adjudication
-> Owner hard gate where required
```

Read-only work may run in parallel when safe. Source mutation must not.

## 11. One-writer and isolation boundary

Permanent:

```text
ONE_WRITER_POLICY=EXACTLY_ONE_SOURCE_WRITER
NON_WRITER_AGENTS_MUST_NOT_OPERATE_DIRECTLY_ON_MAIN_WRITABLE_WORKTREE
RECOVERWRITER=UNAVAILABLE
```

Primary coordinates normal lifecycle internally. Abnormal writer state returns
through GPT Work to an explicit Owner recovery/disposition gate after
whole-lifecycle diagnosis.

## 12. Owner-controlled privileged Sync gates

Separate Owner GO/NO-GO remains mandatory whenever required for:

- abnormal writer recovery/disposition;
- governance/source scope expansion;
- clasp push / Apps Script source sync;
- Apps Script production execution;
- Gmail/Drive/Sheets/Script Properties mutation;
- Firestore/Firebase mutation or deploy;
- trigger mutation;
- IAM/ACL/credential changes;
- production reconciliation/repair;
- commit/push checkpoint;
- destructive operations.

Consumed authorization is never reused.

## 13. GPT Work / Codex / Owner boundary

```text
Owner + ChatGPT = GOAL + BOUNDARIES + HARD GATES + FINAL GO/NO-GO
GPT Work = LOCAL-REPO PHASE CONTROLLER + DIAGNOSTIC ORCHESTRATOR
Codex Primary = DELEGATED TECHNICAL EXECUTOR
GitHub = COMMITTED BASELINE + HISTORY + PROVENANCE CROSS-CHECK
```

When uncertainty is material:

```text
local whole-path diagnosis
-> proven defect cluster
-> options / recommended plan
-> Owner + ChatGPT adjudication
-> bounded execution envelope
-> integrated execution
```

## 14. Phase closeout

Use where applicable:

```text
PHASE_ID=
STATUS=
FILES_CHANGED=
CHECKS_RUN=
CODER_STATUS=
REVIEW_STATUS=
VERIFY_STATUS=
REVIEW_P0=
REVIEW_P1=
REVIEW_P2=
ACTIVE_WRITER_LEASE_COUNT=
ACTIVE_ISOLATION_COUNT=
CHECKPOINT_STATUS=
CHECKPOINT_DECISION_REQUIRED=
HOST_OR_REMOTE_OPERATION_RUN=
PRODUCTION_OPERATION_RUN=
COMMIT_RUN=
PUSH_RUN=
DEPLOY_RUN=
UNRESOLVED_BLOCKERS=
READY_FOR_NEXT_PHASE=
NEXT_OWNER_GATE=
```

## 14A. Mandatory next-direction closeout

```text
GPT_WORK_RETURN_TO_OWNER_REQUIRES_NEXT_DIRECTION=true
CLOSEOUT_MUST_INCLUDE_NEXT_EXECUTION_PROPOSAL=true
OWNER_PLANNING_PROMPT_AFTER_NORMAL_CLOSEOUT=false
```

If next action is still authorized and there is no genuine Owner hard gate:

```text
GPT_WORK_MUST_CONTINUE_AUTONOMOUSLY=true
```

When GPT Work returns, include where applicable:

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

A new main phase does not auto-start unless explicitly authorized.

## 15. Verified checkpoint policy

After verified source-changing work, Owner + ChatGPT explicitly decide:

```text
CHECKPOINT_STATUS=NOT_REQUIRED
CHECKPOINT_STATUS=PENDING_OWNER_DECISION
CHECKPOINT_STATUS=COMMITTED_LOCAL
CHECKPOINT_STATUS=PUSHED_REMOTE
CHECKPOINT_STATUS=DEFERRED
```

Commit and push are separate. Never broad-stage unrelated dirt.

Prefer a checkpoint before clasp/GAS source sync, production-facing validation,
deployment, or another materially higher-risk phase when the contract permits.

## 16. Failure policy

Fail closed when authority, writer identity/lifecycle, isolation, required
Owner gate, source scope, privileged boundary, or model ceiling cannot be
proven.

Return one blocker plus the smallest safe next action **and the proposed next
execution envelope**. Do not turn normal failures into long Owner-relayed
micro-workflows.

## 17. Stability rule

This file contains stable cross-session routing only. Do not place transient
commit hashes, lease IDs, isolation paths, one-time production markers, or
current phase status here.
