"""Setup Aeneas Community Discord server."""
import os
import httpx
import time

TOKEN = os.environ["DISCORD_BOT_TOKEN"]
HEADERS = {"Authorization": f"Bot {TOKEN}", "Content-Type": "application/json"}
BASE = "https://discord.com/api/v10"

SUPPORT = "1488317052757213286"
SHOWCASE = "1488317098395435201"
IDEAS = "1488317104318054601"

def post(channel_id, payload):
    r = httpx.post(f"{BASE}/channels/{channel_id}/messages", headers=HEADERS, json=payload)
    if r.status_code == 200:
        print(f"  OK: message {r.json().get('id')}")
    else:
        print(f"  Error {r.status_code}: {r.text[:100]}")

print("Posting to #support...")
post(SUPPORT, {
    "embeds": [{
        "title": "Getting Started",
        "description": (
            "**Install the SDK:**\n"
            "`pip install aeneas-agentwatch`\n\n"
            "**Add to your code:**\n"
            "`import agentwatch`\n"
            "`agentwatch.init()`\n"
            "`agentwatch.verify()`\n\n"
            "**Self-host dashboard:**\n"
            "`docker compose -f docker-compose.local.yml up -d`\n\n"
            "**Troubleshooting:**\n"
            "- verify() fails: check if backend runs on localhost:3001\n"
            "- No traces: call init() BEFORE your LLM calls\n"
            "- Streaming: captures request + final usage\n\n"
            "[Full Docs](https://aeneassoft.com/en/docs)"
        ),
        "color": 3066993
    }]
})

time.sleep(2)

print("Posting to #show-your-agents...")
post(SHOWCASE, {
    "content": (
        "**Show us your AI agent setup!**\n\n"
        "What are you building? Multi-agent pipelines? CrewAI crews? LangChain chains?\n\n"
        "Share your architecture, your causal graphs, your cost breakdowns.\n\n"
        "No setup too small, no agent too weird. We want to see it all."
    )
})

time.sleep(2)

print("Posting to #ideas-and-bugs (update)...")
post(IDEAS, {
    "embeds": [{
        "title": "Shape the Future of AeneasSoft",
        "description": (
            "We build in the open. Your feedback shapes the product.\n\n"
            "**Current priorities:**\n"
            "- Full streaming chunk tracing (Q3 2026)\n"
            "- More AI provider support\n"
            "- Cloud hosted version (waitlist open)\n\n"
            "**Tell us:**\n"
            "- What frustrates you about existing tools?\n"
            "- What provider do you need?\n"
            "- What would make you switch from Langfuse/LangSmith?\n\n"
            "[GitHub Issues](https://github.com/aeneassoft/aeneassoft/issues)"
        ),
        "color": 15705600
    }]
})

print("\nDone. All channels populated.")
