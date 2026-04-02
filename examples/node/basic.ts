/**
 * AeneasSoft — Basic Node.js example
 *
 * 2 lines. Every LLM call traced.
 */
import { init } from '@aeneassoft/sdk-node';
init({ apiKey: 'your-key' });

import OpenAI from 'openai';
const client = new OpenAI();

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);
// Trace automatically sent to http://localhost:8080/ingest
