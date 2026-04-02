"""
AeneasSoft — LangChain example

Zero plugins. Zero middleware. 2 lines.
Every LLM call in your chain is automatically traced.
"""
import agentwatch
agentwatch.init(api_key="your-key")

# Your existing LangChain code — completely unchanged
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o")

# Simple chain
chain = (
    ChatPromptTemplate.from_template("Explain {topic} in one paragraph.")
    | llm
    | StrOutputParser()
)

result = chain.invoke({"topic": "the EU AI Act Article 12"})
print(result)

# Multi-step chain with agent context
with agentwatch.trace("research-chain", agent_name="LangChain Pipeline"):

    summary = chain.invoke({"topic": "autonomous AI agents"})

    followup_chain = (
        ChatPromptTemplate.from_template("Based on this summary, list 3 risks:\n{summary}")
        | llm
        | StrOutputParser()
    )
    risks = followup_chain.invoke({"summary": summary})
    print(risks)

# Every OpenAI call inside LangChain is traced — no LangSmith required.
# The dashboard shows: which model, how many tokens, cost, latency.
