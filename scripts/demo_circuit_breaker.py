#!/usr/bin/env python3
"""
AeneasSoft — Circuit Breaker Demo (Terminal Recording)

Run this script and record with: asciinema rec demo.cast
Convert to GIF with: agg demo.cast demo.gif

No real API calls are made. This simulates what happens when an agent
exceeds its budget and AeneasSoft blocks it in application memory.
"""
import time
import sys

# ANSI colors
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"
WHITE = "\033[37m"
BG_RED = "\033[41m"

def typed(text, delay=0.03):
    """Simulate typing effect."""
    for ch in text:
        sys.stdout.write(ch)
        sys.stdout.flush()
        time.sleep(delay)
    print()

def log(prefix, color, msg, cost=None):
    timestamp = time.strftime("%H:%M:%S")
    cost_str = f"  {DIM}${cost:.2f}{RESET}" if cost is not None else ""
    print(f"{DIM}{timestamp}{RESET}  {color}{prefix}{RESET}  {msg}{cost_str}")
    time.sleep(0.4)

print()
print(f"{BOLD}{CYAN}AeneasSoft — Circuit Breaker Demo{RESET}")
print(f"{DIM}{'─' * 50}{RESET}")
print()
time.sleep(0.5)

typed(f"$ python agent_pipeline.py", delay=0.05)
print()
time.sleep(0.3)

log("INIT", GREEN, "agentwatch.init(budget_per_hour=5.0, block_on_threshold=True)")
log("    ", DIM, "Circuit breaker armed: $5.00/hour budget")
print()
time.sleep(0.3)

# Normal calls
calls = [
    ("ResearchBot", "gpt-4o", "Analyze competitor landscape",     0.12),
    ("ResearchBot", "gpt-4o", "Summarize market trends",          0.08),
    ("WriterBot",   "gpt-4o", "Draft executive summary",          0.15),
    ("WriterBot",   "gpt-4o", "Rewrite with formal tone",         0.11),
    ("ResearchBot", "gpt-4o", "Deep dive: EU AI Act Article 12",  0.23),
    ("WriterBot",   "gpt-4o", "Generate compliance checklist",    0.19),
]

running_cost = 0.0
for agent, model, task, cost in calls:
    running_cost += cost
    log("TRACE", GREEN, f"{agent} → {model}: {task}", running_cost)

print()
time.sleep(0.3)
log("    ", YELLOW, f"Budget usage: ${running_cost:.2f} / $5.00  ({running_cost/5*100:.0f}%)")
print()
time.sleep(0.5)

# Agent starts looping
print(f"{YELLOW}{BOLD}  ⚠  Agent entering retry loop...{RESET}")
print()
time.sleep(0.5)

loop_calls = [
    ("ResearchBot", "Retry: connection timeout — requerying",     0.23),
    ("ResearchBot", "Retry: rate limited — requerying",           0.23),
    ("ResearchBot", "Retry: partial response — requerying",       0.23),
    ("ResearchBot", "Retry: validation failed — requerying",      0.23),
    ("ResearchBot", "Retry: context too long — splitting",        0.31),
    ("ResearchBot", "Retry: splitting chunk 1/3",                 0.28),
    ("ResearchBot", "Retry: splitting chunk 2/3",                 0.28),
    ("ResearchBot", "Retry: splitting chunk 3/3",                 0.28),
    ("ResearchBot", "Retry: merging results",                     0.34),
    ("ResearchBot", "Retry: validation failed again",             0.23),
    ("ResearchBot", "Retry: requerying with lower temperature",   0.31),
    ("ResearchBot", "Retry: still failing — expanding context",   0.42),
]

for agent, task, cost in loop_calls:
    running_cost += cost
    color = YELLOW if running_cost < 4.5 else RED
    log("TRACE", color, f"{agent} → gpt-4o: {task}", running_cost)

    if running_cost >= 5.0:
        break

print()
time.sleep(0.3)

# BLOCKED
print(f"{BG_RED}{WHITE}{BOLD}")
print(f"  ╔══════════════════════════════════════════════════════╗")
print(f"  ║  BLOCKED — CircuitBreakerException                  ║")
print(f"  ║  Budget exceeded: ${running_cost:.2f} > $5.00 limit            ║")
print(f"  ║  Request blocked in application memory.             ║")
print(f"  ║  The API call was NEVER sent.                       ║")
print(f"  ╚══════════════════════════════════════════════════════╝")
print(f"{RESET}")
time.sleep(0.5)

log("BLOCK", RED, f"ResearchBot → gpt-4o: BLOCKED before network. $0.00 wasted.")
log("    ", GREEN, f"Total cost capped at ${running_cost:.2f}. Agent stopped. Budget saved.")
print()

print(f"{DIM}{'─' * 50}{RESET}")
print(f"{BOLD}Without AeneasSoft:{RESET} Agent loops until your API bill explodes.")
print(f"{BOLD}With AeneasSoft:{RESET}    Blocked in RAM. Request never sent. Budget enforced.")
print()
