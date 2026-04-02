"""
AeneasSoft — Basic usage example

2 lines. Every LLM call traced.
"""
import agentwatch
agentwatch.init(api_key="your-key")

import openai
client = openai.OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
# Trace automatically sent to http://localhost:8080/ingest
