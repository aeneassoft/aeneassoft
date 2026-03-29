// [PRODUCTNAME] Alert Worker — checks alert conditions every 60 seconds
import { randomUUID } from 'crypto';
import { getActiveAlertRules, checkAlertCondition, saveAlertHistory } from './db/clickhouse';
import { sendAlertEmail } from './emails';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

let intervalId: ReturnType<typeof setInterval> | null = null;

async function triggerAlert(rule: any, value: number): Promise<void> {
  const message = `Alert "${rule.name}" triggered: value=${value.toFixed(4)}, threshold=${rule.threshold}`;

  // Save to history
  await saveAlertHistory(CLICKHOUSE_URL, {
    id: randomUUID(),
    rule_id: rule.id,
    rule_name: rule.name,
    org_id: rule.org_id,
    value,
    message,
  });

  // Send notification
  if (rule.action_type === 'webhook') {
    try {
      await fetch(rule.action_target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: rule.name,
          trigger_type: rule.trigger_type,
          value,
          threshold: rule.threshold,
          time: new Date().toISOString(),
          org_id: rule.org_id,
        }),
      });
    } catch (err) {
      console.error(`[PRODUCTNAME] Failed to send webhook alert to ${rule.action_target}:`, err);
    }
  }

  if (rule.action_type === 'email') {
    sendAlertEmail(rule.action_target, rule.name, value, rule.threshold).catch(err =>
      console.error(`[PRODUCTNAME] Failed to send alert email to ${rule.action_target}:`, err));
  }

  console.log(`[PRODUCTNAME] Alert triggered: ${message}`);
}

async function checkAlerts(): Promise<void> {
  try {
    const rules = await getActiveAlertRules(CLICKHOUSE_URL);
    for (const rule of rules) {
      const value = await checkAlertCondition(CLICKHOUSE_URL, rule);
      if (value > rule.threshold) {
        await triggerAlert(rule, value);
      }
    }
  } catch (err) {
    console.error('[PRODUCTNAME] Alert worker error:', err);
  }
}

export function startAlertWorker(): void {
  if (intervalId) return;
  console.log('[PRODUCTNAME] Alert worker started (60s interval)');
  intervalId = setInterval(checkAlerts, 60_000);
  // Run once immediately
  checkAlerts();
}

export function stopAlertWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[PRODUCTNAME] Alert worker stopped');
  }
}
