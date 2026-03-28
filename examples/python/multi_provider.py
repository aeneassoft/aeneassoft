"""
[PRODUCTNAME] — Multi-provider example

Works with every AI provider automatically.
No per-provider configuration needed.
"""
import agentwatch
agentwatch.init(api_key="your-key")

import openai
import anthropic

openai_client = openai.OpenAI()
anthropic_client = anthropic.Anthropic()

# OpenAI — traced via SDK-level patch
gpt_response = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What is ATP?"}]
)

# Anthropic — traced via SDK-level patch
claude_response = anthropic_client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=256,
    messages=[{"role": "user", "content": "What is ATP?"}]
)

# Groq — traced via HTTP interceptor (no SDK needed)
groq_client = openai.OpenAI(
    api_key="your-groq-key",
    base_url="https://api.groq.com/openai/v1"
)
groq_response = groq_client.chat.completions.create(
    model="llama3-70b-8192",
    messages=[{"role": "user", "content": "What is ATP?"}]
)

print("GPT-4o:", gpt_response.choices[0].message.content[:50])
print("Claude:", claude_response.content[0].text[:50])
print("Groq:", groq_response.choices[0].message.content[:50])
# All 3 providers — all 3 traces sent automatically
