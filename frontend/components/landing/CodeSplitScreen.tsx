"use client";

import { motion } from "framer-motion";

const beforeCode = `# Traditional observability setup - 50+ lines of boilerplate
from langchain.callbacks import BaseCallbackHandler
from langchain.callbacks.manager import CallbackManager
import opentelemetry
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc import OTLPSpanExporter
import logging
import json
import time

class CustomAgentTracer(BaseCallbackHandler):
    def __init__(self, service_name: str):
        self.provider = TracerProvider()
        self.exporter = OTLPSpanExporter(endpoint="...")
        self.provider.add_span_processor(
            BatchSpanProcessor(self.exporter)
        )
        trace.set_tracer_provider(self.provider)
        self.tracer = trace.get_tracer(service_name)
        self.logger = logging.getLogger(__name__)
        self._spans = {}
        self._costs = {}

    def on_llm_start(self, serialized, prompts, **kwargs):
        span = self.tracer.start_span("llm_call")
        span.set_attribute("prompts", json.dumps(prompts))
        span.set_attribute("model", serialized.get("model"))
        self._spans[kwargs["run_id"]] = span
        self._costs[kwargs["run_id"]] = time.time()

    def on_llm_end(self, response, **kwargs):
        span = self._spans.pop(kwargs["run_id"])
        elapsed = time.time() - self._costs.pop(kwargs["run_id"])
        span.set_attribute("latency_ms", elapsed * 1000)
        span.set_attribute("tokens", response.usage.total)
        span.end()

    def on_chain_start(self, serialized, inputs, **kwargs):
        span = self.tracer.start_span("chain")
        self._spans[kwargs["run_id"]] = span

    def on_chain_end(self, outputs, **kwargs):
        span = self._spans.pop(kwargs["run_id"], None)
        if span: span.end()

    def on_tool_start(self, serialized, input_str, **kwargs):
        # ... more boilerplate
        pass

# Setup callback manager
tracer = CustomAgentTracer("my-agent-service")
callback_manager = CallbackManager([tracer])

# Pass to every single chain and agent...
chain = LLMChain(llm=llm, callbacks=callback_manager)`;

interface CodeSplitDict {
  title: string;
  subtitle: string;
  beforeLabel: string;
  afterLabel: string;
  afterComment: string;
  afterHint: string;
}

export function CodeSplitScreen({ dict }: { dict: CodeSplitDict }) {
  return (
    <section className="py-20 sm:py-28 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-bold text-center text-white mb-4"
        >
          {dict.title}
        </motion.h2>
        <p className="text-center text-slate-gray mb-12 max-w-2xl mx-auto">
          {dict.subtitle}
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative min-w-0"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
              <span className="text-sm font-semibold text-red-400 truncate">
                {dict.beforeLabel}
              </span>
            </div>
            <div className="relative rounded-lg bg-navy-mid border border-navy-light overflow-hidden">
              <div className="absolute inset-0 bg-red-500/5" />
              <pre className="p-3 sm:p-4 text-[10px] sm:text-xs leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto">
                <code className="text-red-300/70 line-through decoration-red-500/40 font-mono">
                  {beforeCode}
                </code>
              </pre>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative min-w-0"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full bg-green-500 shrink-0" />
              <span className="text-sm font-semibold text-green-400 truncate">
                {dict.afterLabel}
              </span>
            </div>
            <div className="rounded-lg bg-navy-mid border border-electric-blue/30 overflow-hidden shadow-lg shadow-electric-blue/5">
              <pre className="p-3 sm:p-4 text-xs sm:text-sm leading-relaxed font-mono overflow-x-auto">
                <code>
                  <span className="text-electric-blue">import</span>{" "}
                  <span className="text-gold">agentwatch</span>
                  {"\n"}
                  <span className="text-off-white">agentwatch</span>
                  <span className="text-slate-gray">.</span>
                  <span className="text-electric-blue">init</span>
                  <span className="text-slate-gray">()</span>
                  {"\n"}
                  <span className="text-slate-gray/60">
                    {dict.afterComment}
                  </span>
                </code>
              </pre>
            </div>
            <p className="text-xs text-slate-gray mt-2">{dict.afterHint}</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
