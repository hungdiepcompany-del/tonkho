# SyncGmailDriveSheet Workflow V2 — Change Summary

DATE=2026-08-22
WORKFLOW_VERSION=MASTER_DELEGATED_ENVELOPE_V2

## Purpose

Adopt the project orchestration pattern:

Owner + ChatGPT → GPT Work Phase Controller → Codex Primary → independent Reviewer/Verifier → Owner substantive hard gate.

The change reduces repetitive Owner relay for ordinary same-scope technical defects while preserving the sole-active-contract law, one-writer law, fail-closed behavior, independent review, and privileged production gates.

## Core files rewritten

- `AGENTS.md`
- `AI_WORKFLOW.md`
- `AI_EXECUTION_ROUTING.md`

## Historical/current governance files updated without deleting history

- `00_INDEX.md` — prepended current orchestration overlay.
- `04_MASTER_PLAN.md` — appended Workflow V2 plan.
- `07_WORK_LOG.md` — appended adoption work record.
- `08_DECISION_LOG.md` — appended adoption decision.
- `09_VALIDATION_LOG.md` — appended offline document-alignment validation record.
- `12_AI_WORK_LOG.md` — appended governance work record.
- `13_DECISION_LOG.md` — appended two governance decisions.
- `99_NEXT_AI_HANDOFF.md` — prepended authoritative current orchestration handoff while retaining legacy handoff history.

## Key rules now explicit

- GPT Work is phase controller.
- Codex Primary owns HOW only inside the delegated envelope.
- Prefer multi-phase master delegated envelopes.
- Bounded same-scope corrections may continue without Owner relay only when the active contract authorizes them and root cause is proven.
- Substantive hard gates return to Owner + ChatGPT.
- Closed/consumed attempts require fresh authority when governance requires a fresh attempt.
- Reviewer and Verifier are independent fresh threads when required.
- Proven PASS evidence may be reused while its declared dependencies remain unchanged.
- Mutation-capable timeout with unknown completion enters `PENDING_LATE_COMPLETION_QUARANTINE`.
- One-writer, lease lifecycle, no-RecoverWriter, commit/push/deploy/production gates remain intact.

## Not changed

- No runtime source was edited.
- No production authority was granted.
- No commit/push/deploy authority was granted.
- No historical project evidence was deleted.
