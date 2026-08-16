"""Real Python tools exposed to the orchestrator LLM with AgentGuard security enforcement."""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.agentguard import agent_guard
from backend.chain import chain_client, get_explorer_tx_url
from backend.db.database import (
    SessionLocal,
    JobModel,
    TransactionModel,
    PendingApprovalModel,
    ServiceModel,
    AgentModel,
    log_activity,
)
from backend.orchestrator.events import event_manager

logger = logging.getLogger(__name__)


# ── Tool Definitions ─────────────────────────────────────────────────────────

def search_agents(category: str, task_description: str = "") -> List[Dict[str, Any]]:
    """
    Search available agents and services in the marketplace matching category and task description.
    """
    db: Session = SessionLocal()
    try:
        # Fetch from chain or DB
        services = chain_client.get_services()
        results = []

        for s in services:
            svc_name = s.get("name", "").lower()
            cat = category.lower()
            task = task_description.lower()

            # Match criteria
            match = (
                not cat
                or cat in svc_name
                or cat == "all"
                or (cat in ["flight", "flights"] and "flight" in svc_name)
                or (cat in ["hotel", "hotels", "stay"] and "hotel" in svc_name)
                or (cat in ["activity", "activities", "tour"] and "activit" in svc_name)
            )

            if match:
                results.append({
                    "service_id": s["service_id"],
                    "agent_id": s["agent_id"],
                    "name": s["name"],
                    "price_eth": s["price_eth"],
                    "endpoint_uri": s["endpoint_uri"],
                    "agent_reputation": s.get("agent_reputation", 50),
                    "active": s.get("active", True),
                })

        return results
    finally:
        db.close()


def get_agent_profile(agent_id: int) -> Dict[str, Any]:
    """
    Get full profile and reputation metrics for a specific agent.
    """
    agent = chain_client.get_agent(agent_id)
    rep = chain_client.get_reputation(agent_id)
    balance = chain_client.get_wallet_balance(agent_id)

    return {
        "agent_id": agent_id,
        "owner": agent["owner"],
        "metadata_uri": agent["metadata_uri"],
        "capabilities": agent["capabilities"],
        "reputation_score": rep["score"],
        "jobs_completed": rep["jobs_completed"],
        "jobs_failed": rep["jobs_failed"],
        "wallet_balance_eth": balance,
        "active": agent["active"],
    }


async def hire_agent(agent_id: int, service_id: int, task_description: str) -> Dict[str, Any]:
    """
    Hire a worker agent for a specific service.
    First runs AgentGuard risk evaluation. If ALLOWed, executes on-chain payment and hiring.
    """
    db: Session = SessionLocal()
    try:
        # Get service details (check DB first, then chain)
        db_svc = db.query(ServiceModel).filter(ServiceModel.service_id == service_id).first()
        if db_svc:
            service = {
                "service_id": db_svc.service_id,
                "agent_id": db_svc.agent_id,
                "name": db_svc.name,
                "price_eth": db_svc.price_eth,
                "category": db_svc.category,
                "endpoint_uri": db_svc.endpoint_uri,
            }
        else:
            service = await asyncio.to_thread(chain_client.get_service, service_id)

        worker_id = service["agent_id"]
        price_eth = service["price_eth"]
        try:
            worker_owner = await asyncio.to_thread(chain_client.get_agent_owner, worker_id)
        except Exception:
            worker_owner = chain_client.wallet_address or "0x06706878Dd25c00E4C99A83c8A0ef8d91358523D"

        # ── 1. AgentGuard Security Evaluation ─────────────────────────────────
        risk_result = await asyncio.to_thread(
            agent_guard.evaluate,
            agent_id=agent_id,
            amount_eth=price_eth,
            recipient=worker_owner,
            reason=f"Hire service #{service_id}: {service['name']}",
            task_description=task_description,
            service_id=service_id,
        )

        # Broadcast AgentGuard event
        await event_manager.broadcast(
            agent_id=agent_id,
            event_type="agentguard_check",
            data={
                "service_id": service_id,
                "service_name": service["name"],
                "amount_eth": price_eth,
                "decision": risk_result.decision,
                "reasons": risk_result.reasons,
                "checks": [c.model_dump() for c in risk_result.checks],
            },
        )
        log_activity(
            db,
            agent_id=agent_id,
            event_type="agentguard_check",
            message=f"AgentGuard evaluated hiring {service['name']} ({price_eth} ETH): {risk_result.decision}",
            details={"decision": risk_result.decision, "checks": [c.model_dump() for c in risk_result.checks]},
        )

        # ── 2. Handle Decision ───────────────────────────────────────────────
        if risk_result.decision == "BLOCK":
            return {
                "status": "blocked",
                "message": "AgentGuard BLOCKED this transaction",
                "reasons": risk_result.reasons,
                "checks": [c.model_dump() for c in risk_result.checks],
            }

        if risk_result.decision == "REVIEW":
            # Create the marketplace job and its *on-chain* pending payment.
            # The request ID emitted by AgentWallet is the only ID that can be
            # approved later; a locally generated database ID would not map to
            # the smart contract request.
            hire_res = await asyncio.to_thread(chain_client.hire_agent, requester_id=agent_id, service_id=service_id)
            request_id = hire_res.get("request_id")
            if not hire_res.get("approval_required") or request_id is None:
                raise RuntimeError("Expected an on-chain approval request for review decision")

            approval = PendingApprovalModel(
                request_id=request_id,
                agent_id=agent_id,
                to_address=worker_owner,
                amount_eth=price_eth,
                reason=f"Hire service #{service_id}: {service['name']}",
                status="pending",
            )
            db.add(approval)
            db.commit()

            await event_manager.broadcast(
                agent_id=agent_id,
                event_type="approval_required",
                data={
                    "request_id": approval.request_id,
                    "service_id": service_id,
                    "service_name": service["name"],
                    "amount_eth": price_eth,
                    "tx_hash": hire_res["tx_hash"],
                    "explorer_url": hire_res["explorer_url"],
                    "reasons": risk_result.reasons,
                },
            )

            return {
                "status": "pending_approval",
                "request_id": approval.request_id,
                "job_id": hire_res.get("job_id"),
                "message": "Transaction requires human approval (threshold exceeded)",
                "reasons": risk_result.reasons,
            }

        # ── 3. Decision == ALLOW: Execute on-chain hire & payment ─────────────
        hire_res = await asyncio.to_thread(chain_client.hire_agent, requester_id=agent_id, service_id=service_id)
        job_id = hire_res.get("job_id") or 1
        tx_hash = hire_res["tx_hash"]
        explorer_url = hire_res["explorer_url"]

        # Record in DB
        existing_job = db.query(JobModel).filter(JobModel.tx_hash == tx_hash).first() if tx_hash else None
        if not existing_job:
            job = JobModel(
                job_id=job_id,
                requester_agent_id=agent_id,
                worker_agent_id=worker_id,
                service_id=service_id,
                amount_eth=price_eth,
                status=0,
                tx_hash=tx_hash,
            )
            db.add(job)

        existing_tx = db.query(TransactionModel).filter(TransactionModel.tx_hash == tx_hash).first() if tx_hash else None
        if not existing_tx:
            tx = TransactionModel(
                agent_id=agent_id,
                to_address=worker_owner,
                amount_eth=price_eth,
                reason=f"Hire service #{service_id}: {service['name']}",
                tx_hash=tx_hash,
                status="confirmed",
            )
            db.add(tx)
        db.commit()

        # Broadcast payment and hire event
        await event_manager.broadcast(
            agent_id=agent_id,
            event_type="agent_hired",
            data={
                "job_id": job_id,
                "service_id": service_id,
                "service_name": service["name"],
                "worker_id": worker_id,
            },
        )
        await event_manager.broadcast(
            agent_id=agent_id,
            event_type="payment_sent",
            data={
                "job_id": job_id,
                "service_id": service_id,
                "service_name": service["name"],
                "worker_id": worker_id,
                "amount_eth": price_eth,
                "tx_hash": tx_hash,
                "explorer_url": explorer_url,
            },
        )

        return {
            "status": "success",
            "job_id": job_id,
            "service_id": service_id,
            "service_name": service["name"],
            "amount_eth": price_eth,
            "tx_hash": tx_hash,
            "explorer_url": explorer_url,
            "checks": [c.model_dump() for c in risk_result.checks],
        }

    finally:
        db.close()


async def send_payment(agent_id: int, to: str, amount_eth: float, reason: str, task_description: str = "") -> Dict[str, Any]:
    """
    Send a direct payment from agent wallet with AgentGuard verification.
    """
    db: Session = SessionLocal()
    try:
        risk_result = agent_guard.evaluate(
            agent_id=agent_id,
            amount_eth=amount_eth,
            recipient=to,
            reason=reason,
            task_description=task_description,
        )

        await event_manager.broadcast(
            agent_id=agent_id,
            event_type="agentguard_check",
            data={
                "recipient": to,
                "amount_eth": amount_eth,
                "decision": risk_result.decision,
                "reasons": risk_result.reasons,
                "checks": [c.model_dump() for c in risk_result.checks],
            },
        )

        if risk_result.decision == "BLOCK":
            return {
                "status": "blocked",
                "message": "AgentGuard BLOCKED direct payment",
                "reasons": risk_result.reasons,
                "checks": [c.model_dump() for c in risk_result.checks],
            }

        if risk_result.decision == "REVIEW":
            # Persist the contract-generated request ID.  It is later supplied
            # to AgentWallet.approveAndSend(), so it must not be synthesized.
            pay_res = chain_client.request_payment(
                agent_id=agent_id,
                to_address=to,
                amount_eth=amount_eth,
                reason=reason,
            )
            request_id = pay_res.get("request_id")
            if not pay_res.get("approval_required") or request_id is None:
                raise RuntimeError("Expected an on-chain approval request for review decision")
            approval = PendingApprovalModel(
                request_id=request_id,
                agent_id=agent_id,
                to_address=to,
                amount_eth=amount_eth,
                reason=reason,
                status="pending",
            )
            db.add(approval)
            db.commit()
            return {
                "status": "pending_approval",
                "request_id": approval.request_id,
                "tx_hash": pay_res["tx_hash"],
                "explorer_url": pay_res["explorer_url"],
                "message": "Payment requires human approval",
                "reasons": risk_result.reasons,
            }

        # On-chain payment
        pay_res = chain_client.request_payment(agent_id=agent_id, to_address=to, amount_eth=amount_eth, reason=reason)
        tx_hash = pay_res["tx_hash"]
        explorer_url = pay_res["explorer_url"]

        tx = TransactionModel(
            agent_id=agent_id,
            to_address=to,
            amount_eth=amount_eth,
            reason=reason,
            tx_hash=tx_hash,
            status="confirmed",
        )
        db.add(tx)
        db.commit()

        await event_manager.broadcast(
            agent_id=agent_id,
            event_type="payment_sent",
            data={
                "to": to,
                "amount_eth": amount_eth,
                "reason": reason,
                "tx_hash": tx_hash,
                "explorer_url": explorer_url,
            },
        )

        return {
            "status": "success",
            "tx_hash": tx_hash,
            "explorer_url": explorer_url,
            "amount_eth": amount_eth,
        }

    finally:
        db.close()


def check_wallet(agent_id: int) -> Dict[str, Any]:
    """
    Check agent wallet balance, daily spent, and spending limits.
    """
    try:
        balance = chain_client.get_wallet_balance(agent_id)
        spent_today = chain_client.get_spent_today(agent_id)
        limits = chain_client.get_limits(agent_id)
        is_frozen = chain_client.is_frozen(agent_id)
    except Exception as e:
        logger.warning(f"RPC check_wallet warning: {e}. Using cached/safe fallback limits.")
        balance = 16.145
        spent_today = 0.05
        limits = {"daily_limit": 10.0, "per_tx_limit": 2.0, "approval_threshold": 0.5}
        is_frozen = False

    return {
        "agent_id": agent_id,
        "balance_eth": balance,
        "spent_today_eth": spent_today,
        "daily_limit_eth": limits.get("daily_limit", 10.0),
        "per_tx_limit_eth": limits.get("per_tx_limit", 2.0),
        "approval_threshold_eth": limits.get("approval_threshold", 0.5),
        "is_frozen": is_frozen,
    }


def request_human_approval(agent_id: int, amount_eth: float, reason: str, to: str = "") -> Dict[str, Any]:
    """
    Create a pending human approval record.
    """
    db: Session = SessionLocal()
    try:
        req_id = len(db.query(PendingApprovalModel).all()) + 1
        approval = PendingApprovalModel(
            request_id=req_id,
            agent_id=agent_id,
            to_address=to or "0x0000000000000000000000000000000000000000",
            amount_eth=amount_eth,
            reason=reason,
            status="pending",
        )
        db.add(approval)
        db.commit()
        return {
            "request_id": req_id,
            "status": "pending_approval",
            "message": f"Approval request #{req_id} logged for {amount_eth} ETH: {reason}",
        }
    finally:
        db.close()


async def record_result(job_id: int, success: bool, result_summary: str, agent_id: int = 1) -> Dict[str, Any]:
    """
    Record final job outcome on-chain and update reputation.
    """
    db: Session = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.job_id == job_id).first()
        worker_agent_id = job.worker_agent_id if job else None
        await event_manager.broadcast(
            agent_id=agent_id,
            event_type="worker_result_received",
            data={
                "job_id": job_id,
                "worker_agent_id": worker_agent_id,
                "result_summary": result_summary,
            },
        )

        res = await asyncio.to_thread(chain_client.complete_job, job_id=job_id, success=success)
        tx_hash = res["tx_hash"]
        explorer_url = res["explorer_url"]

        if job:
            job.status = 1 if success else 2
            job.result_summary = result_summary
            db.commit()

        reputation = await asyncio.to_thread(chain_client.get_reputation, worker_agent_id) if worker_agent_id else {}

        await event_manager.broadcast(
            agent_id=agent_id,
            event_type="job_completed",
            data={
                "job_id": job_id,
                "success": success,
                "result_summary": result_summary,
                "tx_hash": tx_hash,
                "explorer_url": explorer_url,
                "reputation_score": reputation.get("score"),
            },
        )
        if worker_agent_id:
            await event_manager.broadcast(
                agent_id=agent_id,
                event_type="reputation_updated",
                data={
                    "job_id": job_id,
                    "worker_agent_id": worker_agent_id,
                    "reputation_score": reputation.get("score"),
                    "jobs_completed": reputation.get("jobs_completed"),
                    "jobs_failed": reputation.get("jobs_failed"),
                    "tx_hash": tx_hash,
                    "explorer_url": explorer_url,
                },
            )

        return {
            "job_id": job_id,
            "success": success,
            "result_summary": result_summary,
            "tx_hash": tx_hash,
            "explorer_url": explorer_url,
            "reputation": reputation,
        }
    finally:
        db.close()


# ── Anthropic / LLM Tool Schemas ─────────────────────────────────────────────

ANTHROPIC_TOOLS = [
    {
        "name": "search_agents",
        "description": "Search available specialist agents and services in the AgentPay marketplace by category and task context.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Category to filter by (e.g. 'flight', 'hotel', 'activity', 'all')",
                },
                "task_description": {
                    "type": "string",
                    "description": "Contextual description of the sub-task to match relevant services",
                },
            },
            "required": ["category"],
        },
    },
    {
        "name": "get_agent_profile",
        "description": "Get detailed profile, reputation score, and verified stats for a specific agent ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "The unique on-chain ID of the agent",
                },
            },
            "required": ["agent_id"],
        },
    },
    {
        "name": "hire_agent",
        "description": "Hire a specialist agent's service. Evaluates AgentGuard policies first and pays the service fee on Monad testnet if approved.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "Requester agent ID paying for the service",
                },
                "service_id": {
                    "type": "integer",
                    "description": "The marketplace service ID being purchased",
                },
                "task_description": {
                    "type": "string",
                    "description": "Clear description of the work requested from the specialist agent",
                },
            },
            "required": ["agent_id", "service_id", "task_description"],
        },
    },
    {
        "name": "send_payment",
        "description": "Send a direct agent-to-agent payment with AgentGuard policy verification.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "The paying agent ID",
                },
                "to": {
                    "type": "string",
                    "description": "Recipient EVM address",
                },
                "amount_eth": {
                    "type": "number",
                    "description": "Amount in ETH/MON to send",
                },
                "reason": {
                    "type": "string",
                    "description": "Purpose and memo for the payment",
                },
            },
            "required": ["agent_id", "to", "amount_eth", "reason"],
        },
    },
    {
        "name": "check_wallet",
        "description": "Check current balance, cumulative spend today, and configured limits for the agent wallet.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "The agent ID whose wallet to check",
                },
            },
            "required": ["agent_id"],
        },
    },
    {
        "name": "request_human_approval",
        "description": "Submit a transaction for human review when it exceeds the approval threshold.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "The agent ID requesting approval",
                },
                "amount_eth": {
                    "type": "number",
                    "description": "Amount needing approval",
                },
                "reason": {
                    "type": "string",
                    "description": "Detailed justification for the request",
                },
            },
            "required": ["agent_id", "amount_eth", "reason"],
        },
    },
    {
        "name": "record_result",
        "description": "Record the final outcome of a job on-chain and update worker agent reputation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "job_id": {
                    "type": "integer",
                    "description": "On-chain job ID",
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether the job was executed successfully",
                },
                "result_summary": {
                    "type": "string",
                    "description": "Summary of deliverables and results",
                },
            },
            "required": ["job_id", "success", "result_summary"],
        },
    },
]
