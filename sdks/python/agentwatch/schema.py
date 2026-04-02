"""
AeneasSoft ATP Schema — Python Pydantic models
"""
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field


class Status(BaseModel):
    code: Literal['UNSET', 'OK', 'ERROR']
    message: Optional[str] = None


class ToolCall(BaseModel):
    tool_name: str
    tool_input: str
    tool_output: Optional[str] = None
    tool_status: Optional[Literal['SUCCESS', 'FAILURE', 'TIMEOUT']] = None


class ModelInference(BaseModel):
    model_name: Optional[str] = None
    provider: Optional[str] = None
    prompt_tokens: Optional[int] = Field(None, ge=0)
    completion_tokens: Optional[int] = Field(None, ge=0)
    latency_ms: Optional[int] = Field(None, ge=0)


class CostAttribution(BaseModel):
    task_id: str
    accumulated_cost_usd: Optional[float] = Field(None, ge=0)


class Link(BaseModel):
    trace_id: str = Field(..., pattern=r'^[0-9a-f]{32}$')
    span_id: str = Field(..., pattern=r'^[0-9a-f]{16}$')
    link_type: Literal[
        'FOLLOWS_FROM', 'CAUSES', 'RELATED_TO', 'RETRY_OF',
        'RESPONSE_TO', 'DELEGATES_TO', 'REQUIRES', 'CONSENSUS_FOR'
    ]


class Event(BaseModel):
    time_unix_nano: int = Field(..., ge=0)
    name: str
    attributes: Optional[Dict[str, Any]] = None


class ATPSpan(BaseModel):
    trace_id: str = Field(..., pattern=r'^[0-9a-f]{32}$')
    span_id: str = Field(..., pattern=r'^[0-9a-f]{16}$')
    parent_span_id: Optional[str] = Field(None, pattern=r'^[0-9a-f]{16}$')
    name: str
    kind: Literal['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER']
    start_time_unix_nano: int = Field(..., ge=0)
    end_time_unix_nano: int = Field(..., ge=0)
    status: Status
    agent_id: str
    agent_name: str
    agent_role: str
    decision_reasoning: Optional[str] = None
    input: Optional[str] = None
    output: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    model_inference: Optional[ModelInference] = None
    cost_attribution: Optional[CostAttribution] = None
    compliance_flags: Optional[List[str]] = None
    links: Optional[List[Link]] = None
    events: Optional[List[Event]] = None
    attributes: Optional[Dict[str, Any]] = None
