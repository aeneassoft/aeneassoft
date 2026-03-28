"""
[PRODUCTNAME] — Agent context example

Tag calls with agent identity so the causal graph
shows who did what and why.
"""
import agentwatch
agentwatch.init(api_key="your-key")

import openai
client = openai.OpenAI()

with agentwatch.agent("ResearcherBot", role="Researcher"):
    research = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Summarize the EU AI Act Article 12"}]
    )
    print("Research:", research.choices[0].message.content[:100])

with agentwatch.agent("WriterBot", role="Writer"):
    article = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": f"Write a short blog post based on: {research.choices[0].message.content}"}
        ]
    )
    print("Article:", article.choices[0].message.content[:100])

# Both spans are tagged with agent_name, agent_role, agent_id
# Causal graph shows: ResearcherBot → WriterBot
