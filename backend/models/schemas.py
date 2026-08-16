"""Data models and Pydantic schemas for AgentPay."""

from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


# ── Agent Models ─────────────────────────────────────────────────────────────

class AgentCreateRequest(BaseModel):
    name: str
    description: str = ""
    capabilities: List[str] = Field(default_factory=list)
    metadata_uri: str = ""
    initial_deposit_eth: float = 0.0
    daily_limit_eth: float = 1.0
    per_tx_limit_eth: float = 0.5
    approval_threshold_eth: float = 0.2


class AgentLimitsRequest(BaseModel):
    daily_limit_eth: float
    per_tx_limit_eth: float
    approval_threshold_eth: float


class AgentResponse(BaseModel):
    agent_id: int
    owner: str
    name: str
    description: str = ""
    capabilities: List[str] = Field(default_factory=list)
    metadata_uri: str
    reputation_score: int
    active: bool
    wallet_address: Optional[str] = None
    tx_hash: Optional[str] = None
    explorer_url: Optional[str] = None


class AgentPassportResponse(BaseModel):
    agent_id: int
    name: str
    description: str
    owner: str
    wallet_address: str
    metadata_uri: str
    capabilities: List[str]
    reputation_score: int
    jobs_completed: int
    jobs_failed: int
    success_rate: float
    total_earned_eth: float
    avg_response_time_ms: int
    services: List[dict]
    explorer_url: str


# ── Service Models ───────────────────────────────────────────────────────────

class ServiceCreateRequest(BaseModel):
    agent_id: int
    name: str
    category: str
    price_eth: float
    endpoint_uri: str


class ServiceResponse(BaseModel):
    service_id: int
    agent_id: int
    agent_name: Optional[str] = None
    agent_reputation: int = 50
    name: str
    category: Optional[str] = None
    price_eth: float
    endpoint_uri: str
    active: bool


# ── Task & Orchestrator Models ───────────────────────────────────────────────

class TaskRequest(BaseModel):
    agent_id: int
    task: str


class TaskResponse(BaseModel):
    task_id: str
    agent_id: int
    task: str
    status: str
    plan: Optional[List[str]] = None
    hired_services: Optional[List[dict]] = None
    total_spent_eth: float = 0.0
    result: Optional[str] = None
    events: List[dict] = Field(default_factory=list)


# ── AgentGuard Models ────────────────────────────────────────────────────────

class RiskCheck(BaseModel):
    label: str
    passed: bool
    detail: Optional[str] = None


class RiskResult(BaseModel):
    decision: str  # "ALLOW" | "REVIEW" | "BLOCK"
    reasons: List[str] = Field(default_factory=list)
    checks: List[RiskCheck] = Field(default_factory=list)


class TransactionEvaluateRequest(BaseModel):
    agent_id: int
    amount: float
    recipient: str
    reason: str
    service_id: Optional[int] = None
    task_description: Optional[str] = None


# ── Wallet Models ────────────────────────────────────────────────────────────

class WalletInfoResponse(BaseModel):
    agent_id: int
    balance_eth: float
    spent_today_eth: float
    daily_limit_eth: float
    per_tx_limit_eth: float
    approval_threshold_eth: float
    is_frozen: bool
    transactions: List[dict] = Field(default_factory=list)


class ApprovalActionRequest(BaseModel):
    request_id: int
    action: str = "approve"  # "approve" | "reject"
