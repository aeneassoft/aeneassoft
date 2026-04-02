# AeneasSoft Terms of Service

**Effective Date:** [DATE]

**Provider:** [COMPANY_NAME] ("AeneasSoft")

---

## 1. Service Description

AeneasSoft is an open-source Agent Observability platform that enables monitoring, debugging, and auditing of multi-agent AI systems through the Agent Trace Protocol (ATP).

### Open Source (MIT License)
- ATP Schema and protocol specification
- API Proxy (Fastify)
- Python and Node.js SDKs
- Causal Graph Engine
- Frontend Dashboard
- EU AI Act Compliance Export

### Enterprise Features (Separate License)
- Managed cloud hosting
- Priority support and SLA
- Advanced analytics and alerting
- Role-based access control (RBAC)
- Single Sign-On (SSO) integration

## 2. Service Level Expectations

### Self-Hosted Deployment
- The Controller is responsible for infrastructure availability
- AeneasSoft provides documentation and best practices for deployment
- No uptime guarantee for self-hosted installations

### Managed Cloud (Enterprise)
- Target availability: 99.9% monthly uptime
- Scheduled maintenance windows announced 48 hours in advance
- Incident response within 4 hours for critical issues

## 3. Liability Disclaimer

### Proxy Failure
AeneasSoft operates as a transparent proxy between the Controller's application and upstream AI APIs (OpenAI, Anthropic, etc.). In the event of proxy failure:

- **AeneasSoft is not liable** for failed API requests or interrupted service
- The Controller should implement fallback routing to upstream APIs
- Observability data may be lost during proxy outages
- Financial costs incurred with upstream providers remain the Controller's responsibility

### Data Accuracy
- Cost attribution calculations are estimates based on published pricing
- Compliance reports are automatically generated and require professional legal review
- AeneasSoft does not guarantee the accuracy of AI Act compliance assessments

### General Limitation
TO THE MAXIMUM EXTENT PERMITTED BY LAW, AeneasSoft SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM USE OF THE SERVICE.

## 4. User Obligations

The Controller agrees to:
- Maintain secure deployment practices
- Not store API keys in plaintext
- Enable Zero Data Retention mode when processing sensitive personal data
- Review auto-generated compliance reports with qualified legal professionals
- Comply with applicable data protection regulations (GDPR, EU AI Act)

## 5. Intellectual Property

- Open source components are licensed under the MIT License
- Enterprise features are licensed separately
- The Controller retains all rights to their data processed through AeneasSoft
- AeneasSoft does not claim ownership of any data passing through the proxy

## 6. Termination

Either party may terminate this agreement:
- For self-hosted: by ceasing to use the software
- For managed cloud: with 30 days written notice
- Immediately upon material breach by the other party

Upon termination, all stored data will be deleted within 30 days unless otherwise required by law.

## 7. Governing Law

This agreement is governed by the laws of [JURISDICTION], without regard to conflict of law principles.

---

**DISCLAIMER:** This Terms of Service template is provided for informational purposes only and does not constitute legal advice. AeneasSoft recommends engaging qualified legal counsel to review and adapt this document to your specific requirements before publication.

---

**Last Updated:** [DATE]
