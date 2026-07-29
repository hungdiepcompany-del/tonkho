# D7-B Candidate Identity And Duplicate Check Model

PHASE=D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY

READ_ONLY_MODE=YES
PRODUCTION_MUTATION=NONE

## Identity Model

CANDIDATE_FINGERPRINT_SCHEMA_VERSION=D7_B_CANDIDATE_FINGERPRINT_V1

D7-B calculates safe hashes for:

- MESSAGE_ID_HASH
- THREAD_ID_HASH
- PDF_SHA256
- XML_SHA256
- ATTACHMENT_SET_SHA256
- INVOICE_KEY_HASH
- HASH_INDEX_HASH
- CANDIDATE_FINGERPRINT

The complete candidate fingerprint is built from versioned, length-delimited canonical components. It does not concatenate unframed raw values.

## Duplicate Layers

D7_B_DUPLICATE_LAYERS=GMAIL,DRIVE,SHEET,FIRESTORE

Each layer returns one of:

- NOT_FOUND
- EXACT_DUPLICATE
- CONFLICTING_DUPLICATE
- READ_BLOCKED
- NOT_APPLICABLE

Any READ_BLOCKED or CONFLICTING_DUPLICATE blocks candidate approval. Any EXACT_DUPLICATE prevents D7-C readiness. D7_C_APPROVAL_READY can be YES only when every required duplicate layer is NOT_FOUND.

## Read Scope

Gmail discovery uses an explicit sender, subject, date window, max result count, max messages per thread, and max attachments per message. The raw Gmail query is not logged; only GMAIL_QUERY_POLICY_HASH is returned.

Drive, Sheet, and Firestore checks are bounded read-only checks. No probe files, rows, documents, leases, labels, or triggers are created.
