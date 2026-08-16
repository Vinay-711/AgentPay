"""AgentPay Backend — FastAPI Application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db.database import init_db
from backend.routes import api_router, ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database
    init_db()
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="AgentPay API",
    description="Autonomous AI agent payment infrastructure on Monad with AgentGuard security enforcement.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "agentpay-backend",
        "network": "monad-testnet",
        "chain_id": 10143,
        "contracts": {
            "registry": settings.agent_registry_address,
            "wallet": settings.agent_wallet_address,
            "marketplace": settings.agent_marketplace_address,
            "reputation": settings.reputation_address,
        },
    }
