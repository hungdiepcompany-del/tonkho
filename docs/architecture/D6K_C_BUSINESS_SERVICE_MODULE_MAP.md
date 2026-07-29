# D6K-C Business Service Module Map

PHASE=D6K_C_BUSINESS_SERVICE_MODULE_CONSOLIDATION
STATUS=PASS_LOCAL_ATTACHMENT_SERVICE_CONSOLIDATION

D6K-C started the business-service consolidation with the attachment parsing responsibility. The move is intentionally narrow: XML invoice parsing and PDF invoice parsing now live together in one business module while keeping every Apps Script global function name unchanged.

```text
BUSINESS_MODULE_ADDED=Invoice_AttachmentParser.js
COMPATIBILITY_STUBS=xmlParser.js;pdfParser.js
FUNCTION_NAMES_CHANGED=NO
STRING_ADDRESSED_HANDLER_RENAME=NO
IMPORTS_OR_EXPORTS_ADDED=NO
PUBLIC_ENTRYPOINT_CHANGE=NO
```

## Responsibility Map

| Module | Responsibility | Source movement |
| --- | --- | --- |
| Invoice_AttachmentParser.js | XML/PDF invoice attachment parsing, VAT detection, metadata extraction, PDF filename construction | moved from xmlParser.js and pdfParser.js |
| xmlParser.js | compatibility stub | no runtime declarations |
| pdfParser.js | compatibility stub | no runtime declarations |
| Shared_Normalization.js | shared normalization/date helpers | unchanged from D6K-B |
| Shared_Hashing.js | shared hash helpers | unchanged from D6K-B |

## Contract Preservation

```text
XML_PARSE_CONTRACT=UNCHANGED
PDF_PARSE_CONTRACT=UNCHANGED
PDF_OCR_CLEANUP_CONTRACT=UNCHANGED
ATTACHMENT_FILENAME_POLICY=UNCHANGED
INVOICE_NUMBER_NORMALIZATION=UNCHANGED
HASHINDEX_BEHAVIOR=UNCHANGED
INVOICEKEY_BEHAVIOR=UNCHANGED
FIRESTORE_PATHS=UNCHANGED
LEASE_LIFECYCLE=UNCHANGED
RECONCILIATION_SEMANTICS=UNCHANGED
APPROVAL_MARKERS=UNCHANGED
```

Historical D6J entrypoints remain frozen and were not executed.
