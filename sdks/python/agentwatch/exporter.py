"""
AeneasSoft Python SDK — Manual span exporter for custom instrumentation
"""
import uuid
import time
from typing import Optional, Dict, Any, List
from agentwatch.patcher import _send_span_async, _zero_data_retention


def create_span(
    name: str,
    agent_id: str,
    agent_name: str,
    agent_role: str,
    trace_id: Optional[str] = None,
    parent_span_id: Optional[str] = None,
    kind: str = "INTERNAL",
    input_data: Optional[str] = None,
    output_data: Optional[str] = None,
    decision_reasoning: Optional[str] = None,
    model_inference: Optional[Dict[str, Any]] = None,
    cost_attribution: Optional[Dict[str, Any]] = None,
    compliance_flags: Optional[List[str]] = None,
    links: Optional[List[Dict[str, Any]]] = None,
    attributes: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create and send a custom ATP span."""
    start = time.time()

    span: Dict[str, Any] = {
        "trace_id": trace_id or uuid.uuid4().hex,
        "span_id": uuid.uuid4().hex[:16],
        "name": name,
        "kind": kind,
        "start_time_unix_nano": int(start * 1e9),
        "end_time_unix_nano": int(start * 1e9),
        "status": {"code": "OK"},
        "agent_id": agent_id,
        "agent_name": agent_name,
        "agent_role": agent_role,
    }

    if parent_span_id:
        span["parent_span_id"] = parent_span_id

    # ZDR check for sensitive data
    if not _zero_data_retention:
        if input_data:
            span["input"] = input_data
        if output_data:
            span["output"] = output_data
        if decision_reasoning:
            span["decision_reasoning"] = decision_reasoning

    if model_inference:
        span["model_inference"] = model_inference
    if cost_attribution:
        span["cost_attribution"] = cost_attribution
    if compliance_flags:
        span["compliance_flags"] = compliance_flags
    if links:
        span["links"] = links
    if attributes:
        span["attributes"] = attributes

    _send_span_async(span)
    return span
