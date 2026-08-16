"""Database models and persistence layer for AgentPay."""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from backend.config import settings

Base = declarative_base()


class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(Integer, unique=True, index=True, nullable=False)
    owner = Column(String(66), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, default="")
    capabilities = Column(Text, default="[]")  # JSON encoded list
    metadata_uri = Column(String(512), default="")
    reputation_score = Column(Integer, default=50)
    active = Column(Boolean, default=True)
    wallet_address = Column(String(66), default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class ServiceModel(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(Integer, unique=True, index=True, nullable=False)
    agent_id = Column(Integer, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    category = Column(String(64), default="general")
    price_eth = Column(Float, nullable=False)
    endpoint_uri = Column(String(512), default="")
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class JobModel(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, index=True, nullable=False)
    requester_agent_id = Column(Integer, nullable=False)
    worker_agent_id = Column(Integer, nullable=False)
    service_id = Column(Integer, nullable=False)
    amount_eth = Column(Float, nullable=False)
    status = Column(Integer, default=0)  # 0=pending, 1=completed, 2=failed
    tx_hash = Column(String(66), default="")
    result_summary = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(Integer, index=True, nullable=False)
    to_address = Column(String(66), nullable=False)
    amount_eth = Column(Float, nullable=False)
    reason = Column(String(256), default="")
    tx_hash = Column(String(66), default="")
    status = Column(String(32), default="confirmed")  # confirmed, pending_approval, blocked
    created_at = Column(DateTime, default=datetime.utcnow)


class PendingApprovalModel(Base):
    __tablename__ = "pending_approvals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, unique=True, index=True, nullable=False)
    agent_id = Column(Integer, index=True, nullable=False)
    to_address = Column(String(66), nullable=False)
    amount_eth = Column(Float, nullable=False)
    reason = Column(String(256), default="")
    status = Column(String(32), default="pending")  # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)


class ActivityLogModel(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(Integer, index=True, nullable=False)
    event_type = Column(String(64), nullable=False)  # discovery, agentguard_check, hire, payment, job_complete
    message = Column(Text, nullable=False)
    details = Column(Text, default="{}")  # JSON encoded dict
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Database Setup ───────────────────────────────────────────────────────────

DB_URL = "sqlite:///agentpay.db"
if settings.supabase_url and settings.supabase_key and "postgres" in settings.supabase_url:
    DB_URL = settings.supabase_url

engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if "sqlite" in DB_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── CRUD Helper Functions ───────────────────────────────────────────────────

def save_agent(db: Session, agent_id: int, owner: str, name: str, description: str,
               capabilities: List[str], metadata_uri: str, reputation_score: int = 50,
               wallet_address: str = "") -> AgentModel:
    agent = db.query(AgentModel).filter(AgentModel.agent_id == agent_id).first()
    if not agent:
        agent = AgentModel(
            agent_id=agent_id,
            owner=owner,
            name=name,
            description=description,
            capabilities=json.dumps(capabilities),
            metadata_uri=metadata_uri,
            reputation_score=reputation_score,
            wallet_address=wallet_address,
        )
        db.add(agent)
    else:
        agent.owner = owner
        agent.name = name
        agent.description = description
        agent.capabilities = json.dumps(capabilities)
        agent.metadata_uri = metadata_uri
        agent.reputation_score = reputation_score
        if wallet_address:
            agent.wallet_address = wallet_address
    db.commit()
    db.refresh(agent)
    return agent


def get_agent_by_id(db: Session, agent_id: int) -> Optional[AgentModel]:
    return db.query(AgentModel).filter(AgentModel.agent_id == agent_id).first()


def save_service(db: Session, service_id: int, agent_id: int, name: str,
                 category: str, price_eth: float, endpoint_uri: str) -> ServiceModel:
    service = db.query(ServiceModel).filter(ServiceModel.service_id == service_id).first()
    if not service:
        service = ServiceModel(
            service_id=service_id,
            agent_id=agent_id,
            name=name,
            category=category,
            price_eth=price_eth,
            endpoint_uri=endpoint_uri,
        )
        db.add(service)
    else:
        service.name = name
        service.category = category
        service.price_eth = price_eth
        service.endpoint_uri = endpoint_uri
    db.commit()
    db.refresh(service)
    return service


def list_services_db(db: Session) -> List[ServiceModel]:
    return db.query(ServiceModel).filter(ServiceModel.active == True).all()


def log_activity(db: Session, agent_id: int, event_type: str, message: str, details: Optional[Dict[str, Any]] = None):
    activity = ActivityLogModel(
        agent_id=agent_id,
        event_type=event_type,
        message=message,
        details=json.dumps(details or {}),
    )
    db.add(activity)
    db.commit()
    return activity
