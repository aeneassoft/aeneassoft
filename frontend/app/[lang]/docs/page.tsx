import { getDictionary } from "../dictionaries";

export const metadata = { title: "Documentation" };

function CodeBlock({ code, lang = "" }: { code: string; lang?: string }) {
  return (
    <pre className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm text-off-white overflow-x-auto font-mono whitespace-pre-wrap">
      {lang && (
        <span className="text-xs text-slate-gray block mb-2 uppercase tracking-wider">{lang}</span>
      )}
      {code}
    </pre>
  );
}

function SectionDivider() {
  return <hr className="border-navy-light" />;
}

function ParamRow({ name, type, def, desc }: { name: string; type: string; def: string; desc: string }) {
  return (
    <tr className="border-b border-navy-light/50">
      <td className="py-2 pr-3 text-electric-blue font-mono text-xs">{name}</td>
      <td className="py-2 pr-3 text-slate-gray text-xs font-mono">{type}</td>
      <td className="py-2 pr-3 text-gold text-xs">{def}</td>
      <td className="py-2 text-slate-gray text-xs">{desc}</td>
    </tr>
  );
}

function ParamTable({ params }: { params: Array<{ name: string; type: string; default: string; description: string }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-light text-left text-slate-gray">
            <th className="pb-2 pr-3 text-xs">Parameter</th>
            <th className="pb-2 pr-3 text-xs">Type</th>
            <th className="pb-2 pr-3 text-xs">Default</th>
            <th className="pb-2 text-xs">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <ParamRow key={i} name={p.name} type={p.type} def={p.default} desc={p.description} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOC_SECTIONS = [
  { id: "quickstart", label: "Quickstart" },
  { id: "configuration", label: "Configuration Reference" },
  { id: "active-defense", label: "Active Defense (Safe Pause & Resume)" },
  { id: "per-agent", label: "Per-Agent Scoping" },
  { id: "cost-tracking", label: "Cost Tracking" },
  { id: "nodejs", label: "Node.js SDK" },
  { id: "frameworks", label: "Framework Examples" },
  { id: "self-hosting", label: "Self-Hosting" },
  { id: "environment", label: "Environment Variables" },
  { id: "api-reference", label: "API Reference" },
  { id: "alerts", label: "Alert System" },
  { id: "streaming", label: "Streaming Support" },
  { id: "architecture", label: "Architecture" },
  { id: "migration", label: "Migration Guide" },
  { id: "troubleshooting", label: "Troubleshooting & FAQ" },
  { id: "limitations", label: "Honest Boundaries" },
];

export default async function DocsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const d = dict.docs as Record<string, any>;

  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-2">{d.title}</h1>
        <p className="text-slate-gray mb-8">{d.subtitle}</p>

        {/* Table of Contents */}
        <nav className="glass rounded-xl p-5 mb-10">
          <p className="text-xs text-slate-gray uppercase tracking-wider mb-3">Contents</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            {TOC_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-electric-blue hover:underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">

          {/* ── Quickstart ── */}
          <div id="quickstart">
            <h2 className="text-2xl font-bold text-white mb-2">Quickstart</h2>
            <p className="text-slate-gray mb-6">{d.quickstartIntro}</p>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-electric-blue mb-2">Step 1: Install the SDK</h3>
                <CodeBlock code="pip install aeneas-agentwatch" lang="bash" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-electric-blue mb-2">Step 2: Initialize in your code</h3>
                <CodeBlock code={`import agentwatch\nagentwatch.init()\n# That's it. Every LLM call is now monitored.`} lang="python" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-electric-blue mb-2">Step 3: Make an LLM call</h3>
                <CodeBlock code={`from openai import OpenAI\nclient = OpenAI()\nresponse = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Hello"}]\n)\n# Trace captured automatically. No callbacks, no wrappers.`} lang="python" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-electric-blue mb-2">Step 4: View your traces</h3>
                <p className="text-slate-gray text-sm">Open <code className="text-electric-blue">http://localhost:3001</code> to see your dashboard, or use the API:</p>
                <CodeBlock code={`curl http://localhost:3001/api/traces`} lang="bash" />
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Configuration Reference ── */}
          <div id="configuration">
            <h2 className="text-2xl font-bold text-white mb-2">Configuration Reference</h2>
            <p className="text-slate-gray mb-4">All parameters for <code className="text-electric-blue">agentwatch.init()</code>:</p>

            <ParamTable params={[
              { name: "api_key", type: "str | None", default: "None", description: "API key for cloud mode. If not set, SDK connects to localhost (development mode)." },
              { name: "proxy_url", type: "str | None", default: "auto", description: "Backend ingest URL. Auto-detected: localhost:3001 (no key) or api.aeneassoft.com (with key)." },
              { name: "zero_data_retention", type: "bool", default: "False", description: "Strip prompt/response text from spans. Only metadata (model, tokens, cost) is sent." },
              { name: "budget_per_hour", type: "float | None", default: "None", description: "Hourly cost limit in USD. Triggers alert (or block) when exceeded." },
              { name: "max_error_rate", type: "float | None", default: "None", description: "Error rate threshold (0.0–1.0). Triggers when error ratio exceeds this in a 5-min window." },
              { name: "max_calls_per_minute", type: "int | None", default: "None", description: "Loop detection. Triggers when calls per minute exceed this threshold." },
              { name: "block_on_threshold", type: "bool", default: "False", description: "If True, raises CircuitBreakerException and blocks the request. If False, alert only." },
              { name: "on_alert", type: "callable | None", default: "None", description: "Callback function invoked when any threshold is exceeded. Receives alert dict." },
              { name: "on_block", type: "callable | None", default: "None", description: "Pre-block hook (sync or async). Fires BEFORE CircuitBreakerException. Receives BlockEvent with .monitor for recovery." },
            ]} />

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gold mb-2">Smart URL Detection</h3>
              <p className="text-slate-gray text-sm mb-3">The SDK automatically determines where to send traces:</p>
              <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm space-y-1">
                <p className="text-slate-gray"><code className="text-electric-blue">api_key</code> not set → <code className="text-green-400">http://localhost:3001/api/ingest</code> (local dev)</p>
                <p className="text-slate-gray"><code className="text-electric-blue">api_key</code> set → <code className="text-green-400">https://api.aeneassoft.com/api/ingest</code> (cloud)</p>
                <p className="text-slate-gray"><code className="text-electric-blue">proxy_url</code> set → uses your custom URL</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gold mb-2">Full Example</h3>
              <CodeBlock code={`import agentwatch

agentwatch.init(
    budget_per_hour=10.0,         # Alert if agent spends > $10/hour
    max_error_rate=0.5,           # Alert if > 50% of calls fail
    max_calls_per_minute=100,     # Detect infinite loops
    block_on_threshold=True,      # Block calls (not just alert)
    zero_data_retention=True,     # GDPR: don't store prompts
    on_alert=lambda alert: print(f"ALERT: {alert['reason']}")
)`} lang="python" />
            </div>
          </div>

          <SectionDivider />

          {/* ── Active Defense ── */}
          <div id="active-defense">
            <h2 className="text-2xl font-bold text-white mb-2">Active Defense (Safe Pause &amp; Resume)</h2>
            <p className="text-slate-gray mb-4">Block runaway AI agents before they drain your budget — then recover without losing state. Active Defense monitors cost, error rate, and call frequency with a full state machine (CLOSED → OPEN → PAUSED → HALF_OPEN).</p>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">How It Works</h3>
                <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm space-y-2">
                  <p className="text-slate-gray"><span className="text-white font-semibold">1.</span> SDK intercepts every LLM call at the HTTP transport layer</p>
                  <p className="text-slate-gray"><span className="text-white font-semibold">2.</span> Before the request leaves your process, thresholds are checked</p>
                  <p className="text-slate-gray"><span className="text-white font-semibold">3.</span> If a threshold is exceeded and <code className="text-electric-blue">block_on_threshold=True</code>:</p>
                  <p className="text-slate-gray pl-4">→ <code className="text-red-400">CircuitBreakerException</code> is raised. Request never sent. $0 wasted.</p>
                  <p className="text-slate-gray"><span className="text-white font-semibold">4.</span> If <code className="text-electric-blue">block_on_threshold=False</code>: alert fires, request proceeds</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Thresholds</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-light text-left text-slate-gray">
                        <th className="pb-2 pr-3 text-xs">Threshold</th>
                        <th className="pb-2 pr-3 text-xs">Window</th>
                        <th className="pb-2 text-xs">Behavior</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-navy-light/50">
                        <td className="py-2 pr-3 text-electric-blue font-mono text-xs">budget_per_hour</td>
                        <td className="py-2 pr-3 text-slate-gray text-xs">Rolling 1 hour</td>
                        <td className="py-2 text-slate-gray text-xs">Fires when cumulative cost exceeds limit</td>
                      </tr>
                      <tr className="border-b border-navy-light/50">
                        <td className="py-2 pr-3 text-electric-blue font-mono text-xs">max_error_rate</td>
                        <td className="py-2 pr-3 text-slate-gray text-xs">Rolling 5 minutes</td>
                        <td className="py-2 text-slate-gray text-xs">Fires when error ratio exceeds threshold (min. 10 calls required)</td>
                      </tr>
                      <tr className="border-b border-navy-light/50">
                        <td className="py-2 pr-3 text-electric-blue font-mono text-xs">max_calls_per_minute</td>
                        <td className="py-2 pr-3 text-slate-gray text-xs">Rolling 1 minute</td>
                        <td className="py-2 text-slate-gray text-xs">Fires when call count exceeds limit (loop detection)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Alert Cooldown</h3>
                <p className="text-slate-gray text-sm">Duplicate alerts are suppressed for 60 seconds to prevent spam. Each unique threshold violation has its own cooldown timer.</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Catching Blocked Requests + Recovery</h3>
                <CodeBlock code={'from agentwatch import CircuitBreakerException\n\ntry:\n    result = client.chat.completions.create(...)\nexcept CircuitBreakerException as e:\n    print(f"Blocked: {e.reason}")\n    print(f"State: {e.state}")  # Full monitor snapshot\n\n    # Recovery via e.monitor:\n    e.monitor.pause(60)           # Half-Open after 60s (probe call)\n    e.monitor.increase_budget(5)  # Or: raise budget, resume immediately\n    e.monitor.reset_windows()     # Emergency: clear all windows\n\n    result = client.chat.completions.create(...)  # Next call goes through'} lang="python" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">State Machine</h3>
                <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm space-y-2">
                  <p className="text-slate-gray"><code className="text-green-400">CLOSED</code> → threshold exceeded → <code className="text-red-400">OPEN</code> (all calls blocked)</p>
                  <p className="text-slate-gray"><code className="text-red-400">OPEN</code> → <code className="text-electric-blue">pause(N)</code> → <code className="text-orange-400">PAUSED</code> (waiting for probe window)</p>
                  <p className="text-slate-gray"><code className="text-orange-400">PAUSED</code> → timeout elapsed → <code className="text-blue-400">HALF_OPEN</code> (one probe call allowed)</p>
                  <p className="text-slate-gray"><code className="text-blue-400">HALF_OPEN</code> → probe OK → <code className="text-green-400">CLOSED</code> | probe fails → <code className="text-red-400">OPEN</code></p>
                  <p className="text-slate-gray"><code className="text-red-400">OPEN</code> → <code className="text-electric-blue">increase_budget(N)</code> → <code className="text-green-400">CLOSED</code> (immediate)</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Pre-Block Hook (on_block)</h3>
                <p className="text-slate-gray text-sm mb-2">Save state before the exception propagates. Supports sync and async callbacks.</p>
                <CodeBlock code={'async def save_state(event):\n    await db.save({"agent": event.scope_id, "spent": event.current})\n    event.monitor.pause(30)  # Pause instead of hard kill\n\nagentwatch.init(\n    budget_per_hour=5.0,\n    block_on_threshold=True,\n    on_block=save_state,  # Fires BEFORE exception\n)'} lang="python" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">LangGraph Checkpoint Resume</h3>
                <CodeBlock code={'try:\n    result = graph.invoke({"messages": [...]}, config=config)\nexcept CircuitBreakerException as e:\n    # LangGraph auto-checkpoints before exception propagates\n    e.monitor.increase_budget(10.0)\n    result = graph.invoke(None, config=config)  # Resumes from checkpoint'} lang="python" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">EU AI Act Compliance</h3>
                <p className="text-slate-gray text-sm">Every state transition (triggered, paused, budget_increased, reset, recovered, retrip) emits a compliance-relevant span with <code className="text-electric-blue">eu_ai_act_art12_relevant</code> flag. No state change goes unlogged.</p>
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Per-Agent Scoping ── */}
          <div id="per-agent">
            <h2 className="text-2xl font-bold text-white mb-2">Per-Agent Scoping</h2>
            <p className="text-slate-gray mb-4">Set individual budgets and thresholds for each agent. Global limits still apply — per-agent limits are checked in addition.</p>

            <CodeBlock code={`import agentwatch

agentwatch.init(budget_per_hour=50.0, block_on_threshold=True)

# Each agent gets its own budget:
with agentwatch.agent("ResearchBot",
                       role="Researcher",
                       budget_per_hour=10.0,
                       block_on_threshold=True):
    result = client.chat.completions.create(...)
    # Blocked if ResearchBot exceeds $10/hr OR global exceeds $50/hr

with agentwatch.agent("WriterBot",
                       role="Writer",
                       budget_per_hour=20.0,
                       max_error_rate=0.3):
    result = client.chat.completions.create(...)
    # WriterBot has its own budget AND error rate threshold`} lang="python" />

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gold mb-2">agent() Parameters</h3>
              <ParamTable params={[
                { name: "name", type: "str", default: "required", description: "Agent display name. Used in traces and dashboard." },
                { name: "role", type: "str", default: '"Agent"', description: "Agent role for classification (e.g., Researcher, Writer, Orchestrator)." },
                { name: "agent_id", type: "str | None", default: "auto", description: "Unique ID. Auto-generated from name if not set." },
                { name: "budget_per_hour", type: "float | None", default: "None", description: "Per-agent hourly budget limit in USD." },
                { name: "max_error_rate", type: "float | None", default: "None", description: "Per-agent error rate threshold (0.0–1.0)." },
                { name: "block_on_threshold", type: "bool", default: "False", description: "Block calls when this agent's thresholds are exceeded." },
                { name: "on_alert", type: "callable | None", default: "None", description: "Per-agent alert callback." },
                { name: "on_block", type: "callable | None", default: "None", description: "Pre-block hook. Receives BlockEvent with .monitor for recovery decisions." },
              ]} />
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gold mb-2">Nested Agents</h3>
              <p className="text-slate-gray text-sm">Agent contexts can be nested. Inner agents have their own thresholds while outer agent and global thresholds still apply.</p>
              <CodeBlock code={`with agentwatch.agent("Orchestrator", budget_per_hour=100.0):
    # Orchestrator scope
    with agentwatch.agent("SubAgent", budget_per_hour=10.0):
        # SubAgent scope — both SubAgent AND Orchestrator limits checked
        result = client.chat.completions.create(...)`} lang="python" />
            </div>
          </div>

          <SectionDivider />

          {/* ── Cost Tracking ── */}
          <div id="cost-tracking">
            <h2 className="text-2xl font-bold text-white mb-2">Cost Tracking</h2>
            <p className="text-slate-gray mb-4">AeneasSoft calculates real USD cost for every LLM call using current list prices.</p>

            <div>
              <h3 className="text-sm font-semibold text-gold mb-2">Supported Models & Pricing</h3>
              <p className="text-slate-gray text-sm mb-3">Prices in USD per 1M tokens (input / output):</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-light text-left text-slate-gray">
                      <th className="pb-2 pr-3 text-xs">Model</th>
                      <th className="pb-2 pr-3 text-xs">Input</th>
                      <th className="pb-2 text-xs">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["gpt-4o", "$5.00", "$15.00"],
                      ["gpt-4o-mini", "$0.15", "$0.60"],
                      ["gpt-4-turbo", "$10.00", "$30.00"],
                      ["gpt-4", "$30.00", "$60.00"],
                      ["gpt-3.5-turbo", "$0.50", "$1.50"],
                      ["claude-opus-4-6", "$15.00", "$75.00"],
                      ["claude-sonnet-4-6", "$3.00", "$15.00"],
                      ["claude-haiku-4-5", "$0.80", "$4.00"],
                      ["gemini-1.5-pro", "$3.50", "$10.50"],
                      ["gemini-1.5-flash", "$0.075", "$0.30"],
                      ["mistral-large-latest", "$4.00", "$12.00"],
                      ["mistral-small-latest", "$1.00", "$3.00"],
                      ["command-r-plus", "$3.00", "$15.00"],
                      ["command-r", "$0.50", "$1.50"],
                      ["llama3-70b-8192", "$0.59", "$0.79"],
                      ["llama3-8b-8192", "$0.05", "$0.08"],
                      ["mixtral-8x7b-32768", "$0.24", "$0.24"],
                    ].map(([model, inp, out], i) => (
                      <tr key={i} className="border-b border-navy-light/50">
                        <td className="py-1.5 pr-3 text-electric-blue font-mono text-xs">{model}</td>
                        <td className="py-1.5 pr-3 text-slate-gray text-xs">{inp}</td>
                        <td className="py-1.5 text-slate-gray text-xs">{out}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-slate-gray text-xs mt-2">Unknown models use a default of $1.00 / $2.00 per 1M tokens. Model name matching supports prefixes (e.g., &quot;gpt-4o-2024-11-20&quot; matches &quot;gpt-4o&quot;).</p>
            </div>
          </div>

          <SectionDivider />

          {/* ── Node.js SDK ── */}
          <div id="nodejs">
            <h2 className="text-2xl font-bold text-white mb-2">Node.js SDK</h2>
            <div className="space-y-4">
              <CodeBlock code="npm install @aeneassoft/sdk-node" lang="bash" />
              <CodeBlock code={`import { init, trace, span, currentTraceId } from '@aeneassoft/sdk-node';

// Initialize
init({
  apiKey: 'aw_your_key_here',     // Required
  ingestUrl: 'http://localhost:3001/api/ingest',  // Optional
  zeroDataRetention: false         // Optional
});

// Group calls into a trace
await trace('my-workflow', {}, async () => {
  const response = await openai.chat.completions.create({...});
  console.log('Trace ID:', currentTraceId());
});`} lang="typescript" />

              <h3 className="text-sm font-semibold text-gold mb-2">Node.js init() Parameters</h3>
              <ParamTable params={[
                { name: "apiKey", type: "string", default: "required", description: "Authentication key for the backend." },
                { name: "ingestUrl", type: "string", default: "api.aeneassoft.com", description: "Backend ingest endpoint URL." },
                { name: "zeroDataRetention", type: "boolean", default: "false", description: "Strip input/output from spans." },
              ]} />
            </div>
          </div>

          <SectionDivider />

          {/* ── Framework Examples ── */}
          <div id="frameworks">
            <h2 className="text-2xl font-bold text-white mb-2">Framework Compatibility</h2>
            <p className="text-slate-gray mb-2">AeneasSoft operates at the HTTP transport layer — below every framework. No plugins. No middleware. No wrappers. Just 2 lines.</p>
            <p className="text-slate-gray mb-4 text-sm">Every framework that calls an AI provider over HTTP is automatically instrumented. This includes LangChain, CrewAI, AutoGen, LlamaIndex, Haystack, Semantic Kernel, and any custom code.</p>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">LangChain</h3>
                <CodeBlock code={`import agentwatch                          # <-- line 1
agentwatch.init(api_key="your-key")         # <-- line 2. Done.

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

chain = ChatPromptTemplate.from_template("Explain {topic}") | ChatOpenAI(model="gpt-4o") | StrOutputParser()

with agentwatch.trace("research-chain"):
    result = chain.invoke({"topic": "EU AI Act"})
# Every LLM call traced. No LangSmith required.`} lang="python" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">CrewAI</h3>
                <CodeBlock code={`import agentwatch                          # <-- line 1
agentwatch.init(api_key="your-key")         # <-- line 2. Done.

from crewai import Agent, Task, Crew

researcher = Agent(role="Researcher", goal="Find data", verbose=True)
writer = Agent(role="Writer", goal="Write content", verbose=True)
crew = Crew(agents=[researcher, writer], tasks=[...])

with agentwatch.trace("compliance-crew"):
    result = crew.kickoff()
# Both agents traced — tokens, cost, latency per step.`} lang="python" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">AutoGen</h3>
                <CodeBlock code={`import agentwatch                          # <-- line 1
agentwatch.init(api_key="your-key")         # <-- line 2. Done.

from autogen import ConversableAgent

assistant = ConversableAgent(name="Assistant", llm_config={"model": "gpt-4o"})
reviewer = ConversableAgent(name="Reviewer", llm_config={"model": "gpt-4o"})

with agentwatch.trace("code-review"):
    assistant.initiate_chat(reviewer, message="Review this code", max_turns=3)
# Full conversation flow traced: Assistant -> Reviewer -> Assistant.`} lang="python" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Any Framework / Direct HTTP</h3>
                <CodeBlock code={`import agentwatch                          # <-- line 1
agentwatch.init(api_key="your-key")         # <-- line 2. Done.

# Works with LlamaIndex, Haystack, Semantic Kernel, raw httpx/requests —
# anything that calls an AI API over HTTP is captured automatically.
# Supported: OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere,
# Together AI, Fireworks, Ollama, Azure OpenAI, and more.`} lang="python" />
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Self-Hosting ── */}
          <div id="self-hosting">
            <h2 className="text-2xl font-bold text-white mb-2">Self-Hosting</h2>
            <p className="text-slate-gray mb-4">Run AeneasSoft locally with Docker. No cloud dependency. No account needed.</p>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Minimal (Development)</h3>
                <CodeBlock code={`docker compose -f docker-compose.local.yml up -d
# Starts: ClickHouse + Backend
# Dashboard: http://localhost:3001
# No Kafka. No auth. LOCAL_MODE=true.`} lang="bash" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Full Stack (Production)</h3>
                <CodeBlock code={`docker compose up -d
# Starts: ClickHouse + Kafka + Backend + Proxy
# Configure via .env file
# Services: clickhouse (8123), kafka (9092), backend (3001), proxy (8080)`} lang="bash" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Verify It Works</h3>
                <CodeBlock code={`# Check server health:
curl http://localhost:3001/health

# Send a test trace:
python -c "import agentwatch; agentwatch.init(); agentwatch.verify()"`} lang="bash" />
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Environment Variables ── */}
          <div id="environment">
            <h2 className="text-2xl font-bold text-white mb-2">Environment Variables</h2>
            <p className="text-slate-gray mb-4">Configure the backend via <code className="text-electric-blue">.env</code> file or environment variables.</p>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Core</h3>
                <ParamTable params={[
                  { name: "PORT", type: "number", default: "3001", description: "Backend server port." },
                  { name: "CLICKHOUSE_URL", type: "string", default: "http://localhost:8123", description: "ClickHouse database endpoint." },
                  { name: "CLICKHOUSE_DB", type: "string", default: "productname", description: "ClickHouse database name." },
                  { name: "KAFKA_BROKERS", type: "string", default: "—", description: "Kafka connection string. Optional — if not set, direct ingest is used." },
                  { name: "CORS_ORIGINS", type: "string", default: "http://localhost:3000", description: "Comma-separated allowed CORS origins." },
                ]} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Authentication</h3>
                <ParamTable params={[
                  { name: "API_KEY", type: "string", default: "—", description: "Single-tenant API key for SDK authentication." },
                  { name: "JWT_SECRET", type: "string", default: "—", description: "Secret for JWT token signing. Generate: openssl rand -hex 32" },
                  { name: "LOCAL_MODE", type: "boolean", default: "auto", description: "Skip all auth. Auto-enabled if neither JWT_SECRET nor API_KEY is set." },
                ]} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Data & Privacy</h3>
                <ParamTable params={[
                  { name: "ZERO_DATA_RETENTION", type: "boolean", default: "false", description: "Don't store prompts/responses. Metadata only." },
                  { name: "DATA_RETENTION_DAYS", type: "number", default: "30", description: "ClickHouse TTL — data auto-deleted after N days." },
                ]} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Email (Optional)</h3>
                <ParamTable params={[
                  { name: "RESEND_API_KEY", type: "string", default: "—", description: "Resend API key for sending emails (alerts, welcome, password reset)." },
                  { name: "FROM_EMAIL", type: "string", default: "noreply@aeneassoft.com", description: "Sender email address." },
                ]} />
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── API Reference ── */}
          <div id="api-reference">
            <h2 className="text-2xl font-bold text-white mb-2">API Reference</h2>
            <p className="text-slate-gray mb-4">All endpoints accept JSON. Authentication via JWT token or <code className="text-electric-blue">X-API-Key</code> header. In LOCAL_MODE, no auth required.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-light text-left text-slate-gray">
                    <th className="pb-2 pr-3 text-xs">Method</th>
                    <th className="pb-2 pr-3 text-xs">Endpoint</th>
                    <th className="pb-2 text-xs">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["GET", "/health", "Server status. No auth required."],
                    ["POST", "/api/ingest", "Ingest ATP span. API key auth."],
                    ["GET", "/api/traces", "List traces. Supports ?search, ?status, ?agent_id, ?model, ?from, ?to, ?sort, ?order, ?limit, ?offset."],
                    ["GET", "/api/traces/:id/spans", "All spans for a trace."],
                    ["GET", "/api/traces/:id/graph", "Causal execution graph for a trace."],
                    ["GET", "/api/traces/:id/compliance-score", "EU AI Act Article 12 readiness score (0-100)."],
                    ["GET", "/api/traces/:id/compliance-report", "RSA-signed PDF compliance report (Enterprise)."],
                    ["GET", "/api/metrics", "Dashboard KPIs: traces, tokens, cost, latency, error rate."],
                    ["GET", "/api/cost/daily", "Daily cost breakdown."],
                    ["GET", "/api/cost/by-agent", "Cost breakdown per agent."],
                    ["GET", "/api/cost/by-model", "Cost breakdown per model."],
                    ["GET", "/api/reports/monthly", "Monthly report data (JSON)."],
                    ["GET", "/api/reports/monthly/csv", "Monthly traces export (CSV)."],
                    ["GET", "/api/reports/monthly/pdf", "Monthly report (RSA-signed PDF)."],
                    ["GET", "/api/circuit-breaker/status", "Real-time circuit breaker state."],
                    ["GET", "/api/alerts", "List alert rules."],
                    ["POST", "/api/alerts", "Create alert rule."],
                    ["DELETE", "/api/alerts/:id", "Delete alert rule."],
                    ["PATCH", "/api/alerts/:id", "Toggle alert enabled/disabled."],
                    ["GET", "/api/alerts/history", "Alert event history."],
                    ["POST", "/api/alerts/sdk-alert", "Receive circuit breaker alert from SDK."],
                  ].map(([method, path, desc], i) => (
                    <tr key={i} className="border-b border-navy-light/50">
                      <td className="py-2 pr-3">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          method === "GET" ? "bg-green-900/30 text-green-400" :
                          method === "POST" ? "bg-electric-blue/10 text-electric-blue" :
                          method === "DELETE" ? "bg-red-900/30 text-red-400" :
                          "bg-gold/10 text-gold"
                        }`}>{method}</span>
                      </td>
                      <td className="py-2 pr-3 text-electric-blue font-mono text-xs">{path}</td>
                      <td className="py-2 text-slate-gray text-xs">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SectionDivider />

          {/* ── Alert System ── */}
          <div id="alerts">
            <h2 className="text-2xl font-bold text-white mb-2">Alert System</h2>
            <p className="text-slate-gray mb-4">AeneasSoft has two layers of alerting: SDK-level (in-process) and backend-level (server-side rules).</p>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">SDK Alerts (In-Process)</h3>
                <p className="text-slate-gray text-sm mb-3">Configured via <code className="text-electric-blue">init()</code> parameters. Fires immediately when thresholds are exceeded. 60-second cooldown between duplicate alerts.</p>
                <CodeBlock code={`def my_alert_handler(alert):
    print(f"Alert: {alert['reason']}")
    print(f"Scope: {alert['scope']} / {alert['scope_id']}")
    print(f"Threshold: {alert['threshold']} | Current: {alert['current']}")
    # Send to Slack, PagerDuty, email, etc.

agentwatch.init(
    budget_per_hour=10.0,
    on_alert=my_alert_handler
)`} lang="python" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">Backend Alerts (Server-Side)</h3>
                <p className="text-slate-gray text-sm">Create rules via the dashboard or API. Backend evaluates rules against incoming trace data and sends email notifications via Resend.</p>
                <CodeBlock code={`# Create an alert rule via API:
curl -X POST http://localhost:3001/api/alerts \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "High Cost Alert",
    "condition": "cost_per_hour",
    "threshold": 50.0,
    "action_type": "email"
  }'`} lang="bash" />
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Streaming ── */}
          <div id="streaming">
            <h2 className="text-2xl font-bold text-white mb-2">Streaming Support</h2>
            <p className="text-slate-gray mb-4">AeneasSoft wraps OpenAI and Anthropic stream objects transparently. Your code receives chunks exactly as before — the SDK captures metadata in the background.</p>
            <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm space-y-2">
              <p className="text-green-400">Non-streaming calls: 100% accuracy. Full request + response captured.</p>
              <p className="text-gold">Streaming calls: Request + final usage summary (tokens, cost) captured. Individual chunks are not logged.</p>
              <p className="text-slate-gray">Full chunk-level streaming tracing ships Q3 2026.</p>
            </div>
            <div className="mt-4">
              <CodeBlock code={`# Streaming works transparently:
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)
for chunk in stream:
    print(chunk.choices[0].delta.content, end="")
# → Trace captured with final token count and cost after stream completes`} lang="python" />
            </div>
          </div>

          <SectionDivider />

          {/* ── Architecture ── */}
          <div id="architecture">
            <h2 className="text-2xl font-bold text-white mb-2">Architecture</h2>
            <p className="text-slate-gray mb-4">In-Process Telemetry Interception with Safe Pause &amp; Resume (Patent Pending).</p>

            <CodeBlock code={`Your Code
    |
    v
[agentwatch.init()]
    |
    +--→ Intercepts every LLM call in-process (no proxy)
    |       Captures: model, tokens, cost, latency, input/output
    |       Active Defense: budget/error/loop check BEFORE request
    |
    +--→ Circuit Breaker State Machine
            CLOSED → OPEN → PAUSED → HALF_OPEN → CLOSED
            on_block hook: save state before exception
            Recovery: pause() / increase_budget() / reset()
            |
            v
        AI Provider (OpenAI, Anthropic, Gemini, Mistral, Groq, etc.)`} />

            <div className="mt-4 space-y-3">
              <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm">
                <p className="text-white font-semibold mb-1">In-Process Interception</p>
                <p className="text-slate-gray">AeneasSoft captures every LLM call inside your application process. No external proxy, no network hop, no single point of failure. Works with any AI provider accessible via HTTP.</p>
              </div>
              <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm">
                <p className="text-white font-semibold mb-1">Safe Pause &amp; Resume</p>
                <p className="text-slate-gray">When a threshold is exceeded, the circuit breaker transitions through a full state machine (CLOSED &rarr; OPEN &rarr; PAUSED &rarr; HALF_OPEN). The <code className="text-electric-blue">on_block</code> hook fires before the exception, letting you save state. Recovery methods on the monitor let you pause, increase budget, or reset.</p>
              </div>
              <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm">
                <p className="text-white font-semibold mb-1">EU AI Act Compliance</p>
                <p className="text-slate-gray">Every circuit breaker state change (triggered, paused, budget increased, recovered, re-tripped, reset) is automatically logged as a compliance-relevant span with <code className="text-electric-blue">eu_ai_act_art12_relevant</code> flag.</p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gold mb-2">Supported Providers</h3>
              <p className="text-slate-gray text-sm">Auto-detected via URL: <span className="text-white">OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere, Together AI, Fireworks, Azure OpenAI, Ollama</span> — and any provider accessible via HTTP.</p>
            </div>
          </div>

          <SectionDivider />

          {/* ── Migration Guide ── */}
          <div id="migration">
            <h2 className="text-2xl font-bold text-white mb-2">Migration Guide</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">From Langfuse</h3>
                <p className="text-slate-gray text-sm mb-3">Langfuse requires decorators or callbacks on every function. AeneasSoft requires zero code changes beyond <code className="text-electric-blue">init()</code>.</p>
                <CodeBlock code={`# Before (Langfuse):
from langfuse.decorators import observe
from langfuse.openai import openai

@observe()
def my_function():
    client = openai.OpenAI()
    return client.chat.completions.create(...)

# After (AeneasSoft):
import agentwatch
agentwatch.init()

def my_function():
    client = OpenAI()
    return client.chat.completions.create(...)
# That's it. Remove all decorators. Remove langfuse imports.`} lang="python" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">From LangSmith</h3>
                <p className="text-slate-gray text-sm mb-3">LangSmith is tightly coupled to LangChain. AeneasSoft works with any framework.</p>
                <CodeBlock code={`# Before (LangSmith):
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls_..."
# Only works with LangChain

# After (AeneasSoft):
import agentwatch
agentwatch.init()
# Works with LangChain, CrewAI, raw OpenAI, httpx, any framework`} lang="python" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gold mb-2">From Helicone</h3>
                <p className="text-slate-gray text-sm mb-3">Helicone requires routing all traffic through a proxy (single point of failure). AeneasSoft runs in-process.</p>
                <CodeBlock code={`# Before (Helicone):
client = OpenAI(
    base_url="https://oai.helicone.ai/v1",  # Proxy SPOF
    default_headers={"Helicone-Auth": "Bearer sk-..."}
)

# After (AeneasSoft):
import agentwatch
agentwatch.init()
client = OpenAI()  # Direct connection. No proxy. No SPOF.`} lang="python" />
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* ── Troubleshooting ── */}
          <div id="troubleshooting">
            <h2 className="text-2xl font-bold text-white mb-2">Troubleshooting & FAQ</h2>

            <div className="space-y-4">
              {[
                {
                  q: "No traces appearing in the dashboard?",
                  a: "1. Check that the backend is running: curl http://localhost:3001/health\n2. Ensure agentwatch.init() is called before any LLM calls.\n3. Check that your SDK version is up to date: pip install --upgrade aeneas-agentwatch"
                },
                {
                  q: "CircuitBreakerException raised unexpectedly?",
                  a: "Check your threshold configuration. budget_per_hour is cumulative over a rolling 1-hour window. Use agentwatch.get_state() to see current values. Set block_on_threshold=False to switch to alert-only mode."
                },
                {
                  q: "Cost shows $0.00 for all traces?",
                  a: "The SDK needs token counts from the API response to calculate cost. Ensure you're using a supported model (20+ models tracked). Unknown models use a default rate of $1.00/$2.00 per 1M tokens."
                },
                {
                  q: "Does it work with async code?",
                  a: "Yes. Both sync and async clients are patched (OpenAI, AsyncOpenAI, httpx.AsyncClient, aiohttp). Context propagation uses ContextVar for async safety."
                },
                {
                  q: "Does it add latency to my LLM calls?",
                  a: "Negligible. The interceptor adds ~0.1ms overhead per call (threshold check + span recording). No network proxy, no extra HTTP hop."
                },
                {
                  q: "Can I use it in production?",
                  a: "Yes. Thread-safe (Lock-protected), memory-capped (deque maxlen=10,000 per monitor ≈ 240KB RAM), and battle-tested with CI on every push."
                },
                {
                  q: "How do I disable it temporarily?",
                  a: "Don't call agentwatch.init(). The SDK only activates when init() is explicitly called. No environment variable side effects."
                },
              ].map((item, i) => (
                <div key={i} className="bg-navy-mid border border-navy-light rounded-lg p-4">
                  <p className="text-white font-semibold text-sm mb-2">{item.q}</p>
                  <pre className="text-slate-gray text-xs whitespace-pre-wrap">{item.a}</pre>
                </div>
              ))}
            </div>
          </div>

          <SectionDivider />

          {/* ── Honest Boundaries ── */}
          <div id="limitations">
            <h2 className="text-2xl font-bold text-white mb-2">Honest Boundaries</h2>
            <p className="text-slate-gray mb-4">We believe transparency about limitations builds more trust than hiding them.</p>

            <div className="space-y-3">
              <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm">
                <p className="text-white font-semibold mb-1">What we do well</p>
                <ul className="text-slate-gray space-y-1 list-disc list-inside">
                  <li>Non-streaming LLM calls: 100% accurate capture</li>
                  <li>In-process interception with zero network latency</li>
                  <li>Circuit breaker with Safe Pause &amp; Resume state machine</li>
                  <li>Cost tracking for 20+ models with current list prices</li>
                </ul>
              </div>
              <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm">
                <p className="text-white font-semibold mb-1">What we don&apos;t do (yet)</p>
                <ul className="text-slate-gray space-y-1 list-disc list-inside">
                  <li>Prompt management / versioning</li>
                  <li>A/B testing / evaluation pipelines</li>
                  <li>Streaming: individual chunks not captured (Q3 2026)</li>
                  <li>Cost: batch API, cached tokens, fine-tuned model rates</li>
                  <li>Multi-process central configuration</li>
                </ul>
              </div>
              <div className="bg-navy-mid border border-navy-light rounded-lg p-4 text-sm">
                <p className="text-white font-semibold mb-1">Monkey-patching disclaimer</p>
                <p className="text-slate-gray">We modify HTTP library internals at runtime. We test against pinned library versions and ship SDK updates within 48 hours of breaking changes upstream.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
