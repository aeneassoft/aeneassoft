"""
[PRODUCTNAME] — CrewAI example

Zero changes to your CrewAI code.
Every agent call is automatically traced.
"""
import agentwatch
agentwatch.init(api_key="your-key")

# Your existing CrewAI code — no changes needed
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
result = crew.kickoff()
print(result)
# All LLM calls from CrewAI agents are traced — no SDK changes needed
