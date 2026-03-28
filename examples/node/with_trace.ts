/**
 * [PRODUCTNAME] — Trace grouping example (Node.js)
 *
 * Group multiple LLM calls into a single named trace.
 */
import { init, trace } from '@aeneassoft/sdk-node';
init({ apiKey: 'your-key' });

import OpenAI from 'openai';
const client = new OpenAI();

await trace('research-pipeline', { agentId: 'pipeline-1' }, async (traceId) => {
  const step1 = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Summarize the EU AI Act' }],
  });

  const step2 = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: `Write a checklist based on: ${step1.choices[0].message.content}` },
    ],
  });

  console.log(step2.choices[0].message.content);
  // Both calls share trace_id — visible as one trace in the API
});
