"""
AeneasSoft Python SDK — agentwatch
USB-Stick Principle: 1 line init, everything works.
"""

from agentwatch.patcher import init, _proxy_url
from agentwatch.context import trace, span, agent, workflow
from agentwatch.circuit_breaker import CircuitBreakerException, BlockEvent

__all__ = [
    "init", "verify", "trace", "span", "agent", "workflow",
    "CircuitBreakerException", "BlockEvent",
]


def verify(proxy_url: str | None = None) -> bool:
    """Test connection to AeneasSoft backend."""
    import httpx

    url = proxy_url or _proxy_url or "https://api.aeneassoft.com/api/ingest"
    # Derive base URL for health check
    if "api.aeneassoft.com" in url:
        base = "https://api.aeneassoft.com"
    else:
        base = url.rsplit("/ingest", 1)[0] if url.endswith("/ingest") else url
    try:
        r = httpx.get(f"{base}/health", timeout=3)
        if r.status_code == 200:
            print("[OK] AeneasSoft connection successful")
            return True
        print(f"[ERROR] Connection returned status {r.status_code}")
        return False
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return False
__version__ = "0.2.1"
