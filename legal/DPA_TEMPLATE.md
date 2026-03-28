# Data Processing Agreement (DPA) Template

**Between:** [CUSTOMER_NAME] ("Controller") and [COMPANY_NAME] / [PRODUCTNAME] ("Processor")

**Date:** [DATE]

---

## 1. Purpose of Data Processing

The Processor provides an AI Agent Observability service ("[PRODUCTNAME]") that monitors, debugs, and audits multi-agent AI systems. Data processing occurs to provide:

- API request/response metadata logging
- Token cost attribution and analytics
- Agent trace visualization
- EU AI Act compliance reporting

## 2. Categories of Data Processed

| Data Category | Examples | Retention |
|---|---|---|
| API Metadata | Timestamps, HTTP status codes, latency | Configurable (default: 30 days) |
| Token Costs | Model name, prompt/completion tokens, USD cost | Configurable (default: 30 days) |
| Agent Traces | Agent IDs, operation names, causal links | Configurable (default: 30 days) |
| Prompt/Output Content | User prompts and AI responses | Configurable (default: 30 days) OR disabled via Zero Data Retention mode |

**Note:** When Zero Data Retention (ZDR) mode is enabled, prompt and output content is NOT stored. Only metadata (timestamps, costs, error codes) is retained.

## 3. Data Retention and Deletion

- Default retention period: **30 days** (configurable via `DATA_RETENTION_DAYS`)
- ClickHouse TTL automatically purges expired data
- Manual deletion available on request within 72 hours
- Zero Data Retention mode available for sensitive environments

## 4. Technical and Organizational Measures

### Encryption
- **At Rest:** ClickHouse and PostgreSQL volumes support encryption at rest
- **In Transit:** All API communication over HTTPS/TLS

### Access Control
- API key authentication with SHA-256 hashed storage (never plaintext)
- Per-project key isolation

### Data Minimization
- Zero Data Retention mode strips all prompt/output content
- API keys are never logged in plaintext (masked or hashed)

### Audit Trail
- All data access logged with timestamps
- EU AI Act compliance reports with SHA-256 integrity verification

## 5. Sub-Processors

| Sub-Processor | Purpose | Location |
|---|---|---|
| Self-hosted infrastructure | Data storage and processing | Customer-defined |

**Note:** [PRODUCTNAME] is designed for self-hosted deployment. No data is sent to third-party services unless explicitly configured by the Controller.

## 6. Data Subject Rights

The Controller may exercise data subject rights (access, rectification, erasure, portability) by:
- Using the [PRODUCTNAME] API to query and delete traces
- Contacting the Processor at the address below

## 7. Breach Notification

The Processor will notify the Controller within **72 hours** of becoming aware of a personal data breach, including:
- Nature of the breach
- Categories and approximate number of affected records
- Measures taken to address the breach

## 8. Applicable Law

This DPA is governed by the laws of the European Union, specifically:
- General Data Protection Regulation (GDPR) — Regulation (EU) 2016/679
- EU AI Act — Regulation (EU) 2024/1689

---

**DISCLAIMER:** This template is provided for informational purposes only and does not constitute legal advice. [PRODUCTNAME] recommends engaging qualified legal counsel to review and adapt this document to your specific requirements.

---

**Controller Signature:** _________________________ Date: [DATE]

**Processor Signature:** _________________________ Date: [DATE]
