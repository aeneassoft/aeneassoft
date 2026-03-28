"""
[PRODUCTNAME] Python SDK — agentwatch
USB-Stick Principle: 1 line init, everything works.
"""

from agentwatch.patcher import init
from agentwatch.context import trace, span

__all__ = ["init", "trace", "span"]
__version__ = "0.1.0"
