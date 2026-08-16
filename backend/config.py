"""Pydantic Settings — reads from backend/.env and contracts/deployed-addresses.json."""

import json
import os
from pathlib import Path
from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"
DEPLOYED_JSON = ROOT_DIR / "contracts" / "deployed-addresses.json"


def _get_deployed_address(contract_name: str) -> str:
    """Helper to read deployed addresses from contracts/deployed-addresses.json if available."""
    if DEPLOYED_JSON.exists():
        try:
            with open(DEPLOYED_JSON, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("contracts", {}).get(contract_name, "")
        except Exception:
            pass
    return ""


class Settings(BaseSettings):
    """Application settings loaded from environment variables and config files."""

    # Monad
    monad_testnet_rpc: str = "https://testnet-rpc.monad.xyz"
    agent_wallet_private_key: str = ""

    # LLM
    llm_api_key: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Contract Addresses (deployed on Monad testnet)
    agent_registry_address: str = _get_deployed_address("AgentRegistry")
    agent_wallet_address: str = _get_deployed_address("AgentWallet")
    agent_marketplace_address: str = _get_deployed_address("AgentMarketplace")
    reputation_address: str = _get_deployed_address("Reputation")

    model_config = {
        "env_file": str(ENV_FILE) if ENV_FILE.exists() else ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
