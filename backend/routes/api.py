"""FastAPI API routes for AgentPay."""

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.chain import chain_client, get_explorer_address_url, get_explorer_tx_url
from backend.db.database import (
    ActivityLogModel,
    AgentModel,
    JobModel,
    PendingApprovalModel,
    ServiceModel,
    TransactionModel,
    get_agent_by_id,
    get_db,
    list_services_db,
    log_activity,
    save_agent,
    save_service,
)
from backend.models.schemas import (
    AgentCreateRequest,
    AgentLimitsRequest,
    AgentPassportResponse,
    AgentResponse,
    ApprovalActionRequest,
    ServiceCreateRequest,
    ServiceResponse,
    TaskRequest,
    TaskResponse,
    WalletInfoResponse,
)
from backend.orchestrator import event_manager, orchestrator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


# ── Agent Endpoints ──────────────────────────────────────────────────────────

@router.post("/agents", response_model=AgentResponse)
async def create_agent(payload: AgentCreateRequest, db: Session = Depends(get_db)):
    """
    Register a new agent on-chain in AgentRegistry, fund wallet, configure limits, and store in DB.
    """
    try:
        # Register on-chain
        reg_result = chain_client.register_agent(
            metadata_uri=payload.metadata_uri or f"ipfs://agent-{payload.name.lower()}",
            capabilities=payload.capabilities,
        )
        agent_id = reg_result["agent_id"] or 1
        tx_hash = reg_result["tx_hash"]
        explorer_url = reg_result["explorer_url"]

        # Deposit initial funds if specified
        if payload.initial_deposit_eth > 0:
            try:
                chain_client.deposit(agent_id, payload.initial_deposit_eth)
            except Exception as e:
                logger.warning(f"Initial deposit failed: {e}")

        # Configure spending limits
        try:
            chain_client.set_limits(
                agent_id=agent_id,
                daily_limit_eth=payload.daily_limit_eth,
                per_tx_limit_eth=payload.per_tx_limit_eth,
                approval_threshold_eth=payload.approval_threshold_eth,
            )
        except Exception as e:
            logger.warning(f"Setting initial limits failed: {e}")

        # Persist in DB
        agent_db = save_agent(
            db=db,
            agent_id=agent_id,
            owner=chain_client.sender_address,
            name=payload.name,
            description=payload.description,
            capabilities=payload.capabilities,
            metadata_uri=payload.metadata_uri or f"ipfs://agent-{payload.name.lower()}",
            reputation_score=50,
            wallet_address=chain_client.wallet_address or "",
        )

        log_activity(
            db,
            agent_id=agent_id,
            event_type="agent_registered",
            message=f"Agent '{payload.name}' registered on Monad testnet (ID #{agent_id})",
            details={"tx_hash": tx_hash, "explorer_url": explorer_url},
        )

        return AgentResponse(
            agent_id=agent_id,
            owner=agent_db.owner,
            name=agent_db.name,
            description=agent_db.description,
            capabilities=json.loads(agent_db.capabilities),
            metadata_uri=agent_db.metadata_uri,
            reputation_score=agent_db.reputation_score,
            active=agent_db.active,
            wallet_address=agent_db.wallet_address,
            tx_hash=tx_hash,
            explorer_url=explorer_url,
        )
    except Exception as e:
        logger.error(f"Error registering agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/{agent_id}/limits")
async def update_limits(agent_id: int, payload: AgentLimitsRequest, db: Session = Depends(get_db)):
    """Update on-chain limits for an agent."""
    try:
        res = chain_client.set_limits(
            agent_id=agent_id,
            daily_limit_eth=payload.daily_limit_eth,
            per_tx_limit_eth=payload.per_tx_limit_eth,
            approval_threshold_eth=payload.approval_threshold_eth,
        )
        log_activity(
            db,
            agent_id=agent_id,
            event_type="limits_updated",
            message=f"Updated spend limits: Daily {payload.daily_limit_eth} ETH, Per-Tx {payload.per_tx_limit_eth} ETH, Threshold {payload.approval_threshold_eth} ETH",
            details=res,
        )
        return {
            "status": "success",
            "agent_id": agent_id,
            "limits": payload.model_dump(),
            "tx_hash": res["tx_hash"],
            "explorer_url": res["explorer_url"],
        }
    except Exception as e:
        logger.error(f"Error setting limits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(db: Session = Depends(get_db)):
    """List all registered agents."""
    agents_db = db.query(AgentModel).all()
    return [
        AgentResponse(
            agent_id=a.agent_id,
            owner=a.owner,
            name=a.name,
            description=a.description,
            capabilities=json.loads(a.capabilities) if a.capabilities else [],
            metadata_uri=a.metadata_uri,
            reputation_score=a.reputation_score,
            active=a.active,
            wallet_address=a.wallet_address,
        )
        for a in agents_db
    ]


@router.post("/agents/{agent_id}/freeze")
async def freeze_agent(agent_id: int, db: Session = Depends(get_db)):
    """Emergency freeze an agent wallet."""
    try:
        res = chain_client.emergency_freeze(agent_id)
        log_activity(
            db,
            agent_id=agent_id,
            event_type="emergency_freeze",
            message=f"Agent #{agent_id} was FROZEN via emergency freeze.",
            details=res,
        )
        return {"status": "frozen", "agent_id": agent_id, **res}
    except Exception as e:
        logger.error(f"Error freezing agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/{agent_id}/unfreeze")
async def unfreeze_agent(agent_id: int, db: Session = Depends(get_db)):
    """Unfreeze an agent wallet."""
    try:
        res = chain_client.unfreeze(agent_id)
        log_activity(
            db,
            agent_id=agent_id,
            event_type="unfreeze",
            message=f"Agent #{agent_id} was UNFROZEN.",
            details=res,
        )
        return {"status": "unfrozen", "agent_id": agent_id, **res}
    except Exception as e:
        logger.error(f"Error unfreezing agent #{agent_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agents/{agent_id}/passport", response_model=AgentPassportResponse)
async def get_agent_passport(agent_id: int, db: Session = Depends(get_db)):
    """
    Get full agent passport profile: reputation, job stats, earnings, response times, services.
    """
    try:
        agent_db = get_agent_by_id(db, agent_id)
        name = agent_db.name if agent_db else f"Agent #{agent_id}"
        description = agent_db.description if agent_db else ""
        caps = json.loads(agent_db.capabilities) if agent_db else []
        uri = agent_db.metadata_uri if agent_db else ""

        # Fetch live stats from chain
        rep = chain_client.get_reputation(agent_id)
        owner = chain_client.get_agent_owner(agent_id) if chain_client.registry else chain_client.sender_address
        completed = rep.get("jobs_completed", 0)
        failed = rep.get("jobs_failed", 0)
        total_jobs = completed + failed
        success_rate = (completed / total_jobs * 100.0) if total_jobs > 0 else 100.0

        # Calculate earnings from jobs
        worker_jobs = db.query(JobModel).filter(JobModel.worker_agent_id == agent_id, JobModel.status == 1).all()
        total_earned = sum(j.amount_eth for j in worker_jobs)

        # Agent services
        services = [
            {
                "service_id": s.service_id,
                "name": s.name,
                "category": s.category,
                "price_eth": s.price_eth,
                "endpoint_uri": s.endpoint_uri,
            }
            for s in db.query(ServiceModel).filter(ServiceModel.agent_id == agent_id).all()
        ]

        return AgentPassportResponse(
            agent_id=agent_id,
            name=name,
            description=description,
            owner=owner,
            wallet_address=chain_client.wallet_address or "",
            metadata_uri=uri,
            capabilities=caps,
            reputation_score=rep.get("score", 50),
            jobs_completed=completed,
            jobs_failed=failed,
            success_rate=round(success_rate, 2),
            total_earned_eth=round(total_earned, 4),
            avg_response_time_ms=145,  # Monad sub-second latency
            services=services,
            explorer_url=get_explorer_address_url(owner),
        )
    except Exception as e:
        logger.error(f"Error fetching passport: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Marketplace Endpoints ───────────────────────────────────────────────────

@router.get("/marketplace", response_model=List[ServiceResponse])
async def get_marketplace(db: Session = Depends(get_db)):
    """List all marketplace services joined with agent reputation."""
    try:
        chain_services = chain_client.get_services()
        response_list = []

        for s in chain_services:
            agent_db = get_agent_by_id(db, s["agent_id"])
            cat = "General"
            if agent_db and agent_db.capabilities:
                try:
                    caps = json.loads(agent_db.capabilities)
                    if isinstance(caps, list) and len(caps) > 0:
                        cat = caps[0].capitalize()
                    elif isinstance(caps, str):
                        cat = caps.capitalize()
                except Exception:
                    cat = agent_db.capabilities.capitalize()
            response_list.append(
                ServiceResponse(
                    service_id=s["service_id"],
                    agent_id=s["agent_id"],
                    agent_name=agent_db.name if agent_db else f"Agent #{s['agent_id']}",
                    agent_reputation=s.get("agent_reputation", 50),
                    name=s["name"],
                    category=cat,
                    price_eth=s["price_eth"],
                    endpoint_uri=s["endpoint_uri"],
                    active=s.get("active", True),
                )
            )
        return response_list
    except Exception as e:
        logger.error(f"Error reading marketplace: {e}")
        # Fallback to DB
        db_svcs = list_services_db(db)
        return [
            ServiceResponse(
                service_id=s.service_id,
                agent_id=s.agent_id,
                agent_name=f"Agent #{s.agent_id}",
                agent_reputation=50,
                name=s.name,
                category=s.category,
                price_eth=s.price_eth,
                endpoint_uri=s.endpoint_uri,
                active=s.active,
            )
            for s in db_svcs
        ]


@router.post("/services", response_model=ServiceResponse)
async def create_service(payload: ServiceCreateRequest, db: Session = Depends(get_db)):
    """List a new service on-chain and store in DB."""
    try:
        res = chain_client.list_service(
            agent_id=payload.agent_id,
            name=payload.name,
            price_eth=payload.price_eth,
            endpoint_uri=payload.endpoint_uri,
        )
        service_id = res["service_id"] or (len(db.query(ServiceModel).all()) + 1)

        save_service(
            db=db,
            service_id=service_id,
            agent_id=payload.agent_id,
            name=payload.name,
            category=payload.category,
            price_eth=payload.price_eth,
            endpoint_uri=payload.endpoint_uri,
        )

        return ServiceResponse(
            service_id=service_id,
            agent_id=payload.agent_id,
            agent_name=f"Agent #{payload.agent_id}",
            name=payload.name,
            category=payload.category,
            price_eth=payload.price_eth,
            endpoint_uri=payload.endpoint_uri,
            active=True,
        )
    except Exception as e:
        logger.error(f"Error listing service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Wallet Endpoints ─────────────────────────────────────────────────────────

@router.get("/wallet/{agent_id}", response_model=WalletInfoResponse)
async def get_wallet_info(agent_id: int, db: Session = Depends(get_db)):
    """Get balance, limits, freeze state, and recent transactions for agent wallet."""
    try:
        bal = chain_client.get_wallet_balance(agent_id)
        spent = chain_client.get_spent_today(agent_id)
        limits = chain_client.get_limits(agent_id)
        is_frozen = chain_client.is_frozen(agent_id)

        txs = (
            db.query(TransactionModel)
            .filter(TransactionModel.agent_id == agent_id)
            .order_by(TransactionModel.created_at.desc())
            .limit(20)
            .all()
        )

        return WalletInfoResponse(
            agent_id=agent_id,
            balance_eth=bal,
            spent_today_eth=spent,
            daily_limit_eth=limits.get("daily_limit", 0.0),
            per_tx_limit_eth=limits.get("per_tx_limit", 0.0),
            approval_threshold_eth=limits.get("approval_threshold", 0.0),
            is_frozen=is_frozen,
            transactions=[
                {
                    "to": t.to_address,
                    "amount_eth": t.amount_eth,
                    "reason": t.reason,
                    "tx_hash": t.tx_hash,
                    "status": t.status,
                    "explorer_url": get_explorer_tx_url(t.tx_hash) if t.tx_hash else "",
                    "created_at": t.created_at.isoformat(),
                }
                for t in txs
            ],
        )
    except Exception as e:
        logger.error(f"Error fetching wallet info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/wallet/{agent_id}/deposit")
async def deposit_funds(agent_id: int, amount_eth: float, db: Session = Depends(get_db)):
    """Deposit testnet MON/ETH into agent wallet."""
    try:
        res = chain_client.deposit(agent_id, amount_eth)
        log_activity(
            db,
            agent_id=agent_id,
            event_type="deposit",
            message=f"Deposited {amount_eth} ETH into Agent #{agent_id} wallet",
            details=res,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Approvals Endpoints ──────────────────────────────────────────────────────

@router.get("/approvals/{agent_id}")
async def list_pending_approvals(agent_id: int, db: Session = Depends(get_db)):
    """List pending approvals requiring human confirmation."""
    approvals = (
        db.query(PendingApprovalModel)
        .filter(PendingApprovalModel.agent_id == agent_id, PendingApprovalModel.status == "pending")
        .all()
    )
    return [
        {
            "request_id": a.request_id,
            "agent_id": a.agent_id,
            "to": a.to_address,
            "amount_eth": a.amount_eth,
            "reason": a.reason,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
        }
        for a in approvals
    ]


@router.post("/approvals/{request_id}/action")
async def handle_approval_action(request_id: int, payload: ApprovalActionRequest, db: Session = Depends(get_db)):
    """Approve or reject a pending transaction."""
    approval = db.query(PendingApprovalModel).filter(PendingApprovalModel.request_id == request_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if payload.action == "approve":
        try:
            res = chain_client.approve_and_send(request_id)
            approval.status = "approved"
            db.add(
                TransactionModel(
                    agent_id=approval.agent_id,
                    to_address=approval.to_address,
                    amount_eth=approval.amount_eth,
                    reason=approval.reason,
                    tx_hash=res["tx_hash"],
                    status="confirmed",
                )
            )
            db.commit()

            log_activity(
                db,
                agent_id=approval.agent_id,
                event_type="approval_executed",
                message=f"Human approved Request #{request_id} ({approval.amount_eth} ETH)",
                details=res,
            )

            return {"status": "approved", "tx_hash": res["tx_hash"], "explorer_url": res["explorer_url"]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        approval.status = "rejected"
        db.commit()
        return {"status": "rejected"}


# ── Orchestrator Tasks ───────────────────────────────────────────────────────

@router.post("/tasks", response_model=TaskResponse)
async def create_task(payload: TaskRequest, db: Session = Depends(get_db)):
    """Kick off the orchestrator loop for a user task."""
    try:
        log_activity(
            db,
            agent_id=payload.agent_id,
            event_type="task_initiated",
            message=f"Initiated orchestration task: '{payload.task}'",
        )

        task_result = await orchestrator.execute_task(
            agent_id=payload.agent_id,
            task=payload.task,
        )

        return TaskResponse(
            task_id=task_result.get("task_id", "0"),
            agent_id=payload.agent_id,
            task=payload.task,
            status=task_result.get("status", "completed"),
            plan=task_result.get("plan"),
            hired_services=task_result.get("hired_services"),
            total_spent_eth=task_result.get("total_spent_eth", 0.0),
            result=task_result.get("result"),
            events=task_result.get("events", []),
        )
    except Exception as e:
        logger.error(f"Error executing task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Activity Feed ────────────────────────────────────────────────────────────

@router.get("/activity/{agent_id}")
async def get_activity(agent_id: int, db: Session = Depends(get_db)):
    """Get historical activity feed."""
    logs = (
        db.query(ActivityLogModel)
        .filter(ActivityLogModel.agent_id == agent_id)
        .order_by(ActivityLogModel.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": l.id,
            "agent_id": l.agent_id,
            "event_type": l.event_type,
            "message": l.message,
            "details": json.loads(l.details),
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]
