"""
AeneasSoft — AutoGen example

Zero plugins. Zero middleware. 2 lines.
Every LLM call in your AutoGen conversation is automatically traced.
"""
import agentwatch
agentwatch.init(api_key="your-key")

# Your existing AutoGen code — completely unchanged
from autogen import ConversableAgent

assistant = ConversableAgent(
    name="Assistant",
    system_message="You are a helpful AI assistant.",
    llm_config={"model": "gpt-4o"},
)

reviewer = ConversableAgent(
    name="Reviewer",
    system_message="You review code for security issues. Be concise.",
    llm_config={"model": "gpt-4o"},
)

# Two agents talking to each other
with agentwatch.trace("code-review", agent_name="AutoGen Group"):
    result = assistant.initiate_chat(
        reviewer,
        message="Review this function:\ndef login(user, pw): return db.query(f'SELECT * FROM users WHERE name={user}')",
        max_turns=3,
    )

# Every LLM call from both agents is traced — same trace_id, individual spans.
# The dashboard shows the full conversation flow: Assistant → Reviewer → Assistant.
