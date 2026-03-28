"""
[PRODUCTNAME] Python SDK — agentwatch
USB-Stick Principle: 1 line init, everything works.
"""

from agentwatch.patcher import init
from agentwatch.context import trace, span, agent

__all__ = ["init", "trace", "span", "agent"]
__version__ = "0.2.0"
