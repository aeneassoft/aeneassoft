"""
AeneasSoft — CrewAI example

Zero plugins. Zero middleware. 2 lines.
Every LLM call from your crew is automatically traced.
"""
import agentwatch
agentwatch.init(api_key="your-key")

# Your existing CrewAI code — completely unchanged
from crewai import Crew, Agent, Task

researcher = Agent(
    role="Researcher",
    goal="Find accurate information",
    backstory="You are an expert researcher.",
    verbose=True,
)

writer = Agent(
    role="Writer",
    goal="Write compelling content",
    backstory="You are a skilled technical writer.",
    verbose=True,
)

research_task = Task(
    description="Research the EU AI Act compliance requirements",
    expected_output="A summary of key compliance requirements",
    agent=researcher,
)

write_task = Task(
    description="Write a compliance checklist based on the research",
    expected_output="A practical compliance checklist",
    agent=writer,
)

crew = Crew(agents=[researcher, writer], tasks=[research_task, write_task])

with agentwatch.trace("compliance-crew", agent_name="CrewAI Pipeline"):
    result = crew.kickoff()

print(result)
# Every LLM call from both agents is traced — same trace_id, individual spans.
# The dashboard shows: Researcher → Writer, with tokens, cost, and latency per step.
