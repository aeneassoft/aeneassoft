// [PRODUCTNAME] EU AI Act Compliance Report Generator
import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import { calculateSpanCost, costBreakdownByAgent } from '../engine/cost-attribution';

export async function generateComplianceReport(
  traceId: string,
  spans: any[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Compute SHA-256 hash of all trace data
      const traceDataStr = JSON.stringify(spans);
      const sha256Hash = createHash('sha256').update(traceDataStr).digest('hex');

      // === TITLE PAGE ===
      doc.fontSize(24).font('Helvetica-Bold').text('[PRODUCTNAME]', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).text('EU AI Act Compliance Report', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(11).font('Helvetica');
      doc.text(`Trace ID: ${traceId}`);
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.text(`Total Spans: ${spans.length}`);
      doc.text(`SHA-256 Hash: ${sha256Hash}`);

      doc.moveDown(2);
      doc.fontSize(9).fillColor('#888888');
      doc.text(
        'DISCLAIMER: This report was automatically generated and should be reviewed by a qualified legal professional before submission to authorities.',
        { align: 'center' }
      );
      doc.fillColor('#000000');

      // === SECTION: Artikel 12 ===
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Artikel 12 — Aufzeichnung von Ereignissen');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(
        'Record-keeping obligations under EU AI Act Article 12: Logging of events during operation of the AI system.'
      );
      doc.moveDown(1);

      const complianceSpans = spans.filter(
        (s: any) =>
          s.compliance_flags &&
          (Array.isArray(s.compliance_flags)
            ? s.compliance_flags.includes('eu_ai_act_art12_relevant')
            : typeof s.compliance_flags === 'string' &&
              s.compliance_flags.includes('eu_ai_act_art12_relevant'))
      );

      if (complianceSpans.length > 0) {
        doc.fontSize(10).text(`${complianceSpans.length} spans flagged as Art. 12 relevant:`);
        doc.moveDown(0.5);

        for (const span of complianceSpans) {
          doc.fontSize(9).font('Helvetica-Bold').text(`Span: ${span.name}`);
          doc.font('Helvetica');
          doc.text(`  Agent: ${span.agent_name} (${span.agent_role})`);
          doc.text(`  Status: ${span.status_code || span.status?.code || 'UNSET'}`);
          doc.text(`  Time: ${span.start_time || 'N/A'}`);
          if (span.decision_reasoning) {
            doc.text(`  Decision Reasoning: ${span.decision_reasoning}`);
          }
          doc.moveDown(0.3);
        }
      } else {
        doc.text('No spans flagged as Article 12 relevant in this trace.');
      }

      // === SECTION: Artikel 13 — Beteiligte Agenten ===
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Artikel 13 — Beteiligte Agenten');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(
        'Transparency obligations under EU AI Act Article 13: Information about agents involved in the AI system operation.'
      );
      doc.moveDown(1);

      // Build unique agents table
      const agentMap = new Map<string, { name: string; role: string; spanCount: number }>();
      for (const span of spans) {
        const id = span.agent_id;
        if (!agentMap.has(id)) {
          agentMap.set(id, {
            name: span.agent_name,
            role: span.agent_role,
            spanCount: 0,
          });
        }
        agentMap.get(id)!.spanCount++;
      }

      // Draw table header
      const tableTop = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Agent ID', 50, tableTop, { width: 120 });
      doc.text('Name', 170, tableTop, { width: 120 });
      doc.text('Role', 290, tableTop, { width: 100 });
      doc.text('Spans', 390, tableTop, { width: 50 });

      doc.moveTo(50, tableTop + 15).lineTo(440, tableTop + 15).stroke();

      let yPos = tableTop + 20;
      doc.font('Helvetica');
      for (const [id, agent] of agentMap) {
        doc.text(id, 50, yPos, { width: 120 });
        doc.text(agent.name, 170, yPos, { width: 120 });
        doc.text(agent.role, 290, yPos, { width: 100 });
        doc.text(String(agent.spanCount), 390, yPos, { width: 50 });
        yPos += 15;

        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }
      }

      // === SECTION: Vollständiger Audit-Trail ===
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Vollständiger Audit-Trail');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text('Chronological list of all spans with input/output data.');
      doc.moveDown(1);

      for (const span of spans) {
        if (doc.y > 700) doc.addPage();

        doc.fontSize(9).font('Helvetica-Bold').text(`[${span.status_code || span.status?.code || 'UNSET'}] ${span.name}`);
        doc.font('Helvetica');
        doc.text(`  Agent: ${span.agent_name} | Role: ${span.agent_role} | ID: ${span.span_id}`);
        doc.text(`  Time: ${span.start_time || 'N/A'} | Latency: ${span.latency_ms || 'N/A'}ms`);

        if (span.model_name || span.model_inference?.model_name) {
          doc.text(`  Model: ${span.model_name || span.model_inference?.model_name} (${span.provider || span.model_inference?.provider || 'N/A'})`);
        }

        if (span.input) {
          const inputStr = typeof span.input === 'string' ? span.input : JSON.stringify(span.input);
          doc.text(`  Input: ${inputStr.substring(0, 200)}${inputStr.length > 200 ? '...' : ''}`);
        }

        if (span.output) {
          const outputStr = typeof span.output === 'string' ? span.output : JSON.stringify(span.output);
          doc.text(`  Output: ${outputStr.substring(0, 200)}${outputStr.length > 200 ? '...' : ''}`);
        }

        doc.moveDown(0.5);
      }

      // === SECTION: Kosten ===
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Kosten-Aufschlüsselung');
      doc.moveDown(0.5);

      let totalCost = 0;
      for (const span of spans) {
        totalCost += calculateSpanCost(span);
      }

      doc.fontSize(12).font('Helvetica').text(`Gesamtkosten: $${totalCost.toFixed(6)}`);
      doc.moveDown(1);

      const breakdown = costBreakdownByAgent(spans);
      doc.fontSize(10).font('Helvetica-Bold').text('Aufschlüsselung pro Agent:');
      doc.moveDown(0.5);
      doc.font('Helvetica');

      for (const [agentId, data] of Object.entries(breakdown)) {
        doc.text(`  ${agentId}: $${data.cost.toFixed(6)} (${data.tokens} tokens)`);
      }

      // === FOOTER: Disclaimer + SHA-256 ===
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('Integrity Verification');
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica');
      doc.text(`SHA-256 Hash of Trace Data:`);
      doc.moveDown(0.3);
      doc.font('Courier').fontSize(9).text(sha256Hash);
      doc.moveDown(2);

      doc.fontSize(9).font('Helvetica').fillColor('#888888');
      doc.text(
        'IMPORTANT: This report was automatically generated by [PRODUCTNAME] and should be reviewed by a qualified legal professional before submission to authorities. It does not constitute legal advice.',
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
