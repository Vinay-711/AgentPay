"""Web3 wrapper client for AgentPay smart contracts on Monad testnet."""

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from eth_account import Account
from web3 import Web3
from web3.exceptions import ContractLogicError

from backend.config import settings

logger = logging.getLogger(__name__)

# Monad testnet explorer URL format
EXPLORER_BASE_URL = "https://testnet.monadscan.com"


def get_explorer_tx_url(tx_hash: str) -> str:
    """Generate block explorer link for a transaction hash."""
    return f"{EXPLORER_BASE_URL}/tx/{tx_hash}"


def get_explorer_address_url(address: str) -> str:
    """Generate block explorer link for an address."""
    return f"{EXPLORER_BASE_URL}/address/{address}"


def _load_abi(contract_name: str) -> List[Dict[str, Any]]:
    """Load contract ABI from Foundry compilation output or contracts/out."""
    search_paths = [
        Path(__file__).resolve().parent.parent.parent / "contracts" / "out" / f"{contract_name}.sol" / f"{contract_name}.json",
        Path(__file__).resolve().parent.parent / "contracts" / "out" / f"{contract_name}.sol" / f"{contract_name}.json",
        Path(f"contracts/out/{contract_name}.sol/{contract_name}.json"),
    ]

    for p in search_paths:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("abi", [])
            except Exception as e:
                logger.warning(f"Error loading ABI from {p}: {e}")

    logger.error(f"ABI file for {contract_name} not found in search paths")
    return []


class ChainClient:
    """Wrapper around Web3.py for AgentPay smart contracts."""

    def __init__(self, rpc_url: Optional[str] = None, private_key: Optional[str] = None):
        self.rpc_url = rpc_url or settings.monad_testnet_rpc or "https://testnet-rpc.monad.xyz"
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.private_key = private_key or settings.agent_wallet_private_key or os.getenv("DEPLOYER_PRIVATE_KEY", "")

        if self.private_key and not self.private_key.startswith("0x"):
            self.private_key = f"0x{self.private_key}"

        if self.private_key:
            self.account = Account.from_key(self.private_key)
            self.sender_address = self.account.address
        else:
            self.account = None
            self.sender_address = "0x0000000000000000000000000000000000000000"

        # Load ABIs
        self.registry_abi = _load_abi("AgentRegistry")
        self.wallet_abi = _load_abi("AgentWallet")
        self.reputation_abi = _load_abi("Reputation")
        self.marketplace_abi = _load_abi("AgentMarketplace")

        # Contract addresses
        self.registry_address = Web3.to_checksum_address(settings.agent_registry_address) if settings.agent_registry_address else None
        self.wallet_address = Web3.to_checksum_address(settings.agent_wallet_address) if settings.agent_wallet_address else None
        self.reputation_address = Web3.to_checksum_address(settings.reputation_address) if settings.reputation_address else None
        self.marketplace_address = Web3.to_checksum_address(settings.agent_marketplace_address) if settings.agent_marketplace_address else None

        # Contract instances
        self.registry = self.w3.eth.contract(address=self.registry_address, abi=self.registry_abi) if self.registry_address else None
        self.wallet = self.w3.eth.contract(address=self.wallet_address, abi=self.wallet_abi) if self.wallet_address else None
        self.reputation = self.w3.eth.contract(address=self.reputation_address, abi=self.reputation_abi) if self.reputation_address else None
        self.marketplace = self.w3.eth.contract(address=self.marketplace_address, abi=self.marketplace_abi) if self.marketplace_address else None

    def _send_transaction(self, contract_func, value_wei: int = 0, private_key: Optional[str] = None) -> Tuple[str, Any]:
        """Build, sign, send a transaction and wait for receipt."""
        key = private_key or self.private_key
        if not key:
            raise ValueError("No private key configured for signing transactions")
        if not key.startswith("0x"):
            key = f"0x{key}"

        signer = Account.from_key(key)

        for attempt in range(3):
            try:
                nonce = self.w3.eth.get_transaction_count(signer.address, "pending")
                gas_price = int(self.w3.eth.gas_price * (1.1 ** attempt))

                # Build transaction
                tx_params = {
                    "from": signer.address,
                    "nonce": nonce,
                    "gasPrice": gas_price,
                    "value": value_wei,
                    "chainId": 10143,  # Monad testnet
                }

                try:
                    estimated_gas = contract_func.estimate_gas({"from": signer.address, "value": value_wei})
                    tx_params["gas"] = int(estimated_gas * 1.3)
                except Exception:
                    tx_params["gas"] = 1_000_000

                built_tx = contract_func.build_transaction(tx_params)
                signed_tx = self.w3.eth.account.sign_transaction(built_tx, key)
                tx_hash_bytes = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                tx_hash = tx_hash_bytes.hex()
                if not tx_hash.startswith("0x"):
                    tx_hash = f"0x{tx_hash}"

                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=60)
                return tx_hash, receipt
            except Exception as e:
                if attempt == 2:
                    raise e
                time.sleep(1.5)

    # ── AgentRegistry Functions ───────────────────────────────────────────────

    def register_agent(self, metadata_uri: str, capabilities: List[str], private_key: Optional[str] = None) -> Dict[str, Any]:
        """Register an agent on-chain."""
        if not self.registry:
            raise RuntimeError("AgentRegistry contract address not set")

        func = self.registry.functions.registerAgent(metadata_uri, capabilities)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)

        # Parse agentId from AgentRegistered event
        agent_id = None
        for log in receipt.logs:
            try:
                event = self.registry.events.AgentRegistered().process_log(log)
                agent_id = event["args"]["agentId"]
                break
            except Exception:
                continue

        return {
            "agent_id": agent_id,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
        }

    def get_agent(self, agent_id: int) -> Dict[str, Any]:
        """Get agent details from registry."""
        if not self.registry:
            raise RuntimeError("AgentRegistry contract address not set")

        owner, metadata_uri, capabilities, reputation_score, active = self.registry.functions.getAgent(agent_id).call()
        return {
            "agent_id": agent_id,
            "owner": owner,
            "metadata_uri": metadata_uri,
            "capabilities": capabilities,
            "reputation_score": reputation_score,
            "active": active,
            "wallet_address": self.wallet_address,
        }

    def get_agent_owner(self, agent_id: int) -> str:
        """Get agent owner address."""
        if not self.registry:
            raise RuntimeError("AgentRegistry contract address not set")
        return self.registry.functions.getAgentOwner(agent_id).call()

    # ── AgentWallet Functions ────────────────────────────────────────────────

    def deposit(self, agent_id: int, amount_eth: float, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Deposit funds into an agent's wallet balance."""
        if not self.wallet:
            raise RuntimeError("AgentWallet contract address not set")

        value_wei = Web3.to_wei(amount_eth, "ether")
        func = self.wallet.functions.deposit(agent_id)
        tx_hash, receipt = self._send_transaction(func, value_wei=value_wei, private_key=private_key)
        return {
            "agent_id": agent_id,
            "amount_eth": amount_eth,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
        }

    def set_limits(self, agent_id: int, daily_limit_eth: float, per_tx_limit_eth: float,
                   approval_threshold_eth: float, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Set spending limits for an agent."""
        if not self.wallet:
            raise RuntimeError("AgentWallet contract address not set")

        daily_wei = Web3.to_wei(daily_limit_eth, "ether")
        per_tx_wei = Web3.to_wei(per_tx_limit_eth, "ether")
        thresh_wei = Web3.to_wei(approval_threshold_eth, "ether")

        func = self.wallet.functions.setLimits(agent_id, daily_wei, per_tx_wei, thresh_wei)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)
        return {
            "agent_id": agent_id,
            "daily_limit_eth": daily_limit_eth,
            "per_tx_limit_eth": per_tx_limit_eth,
            "approval_threshold_eth": approval_threshold_eth,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
        }

    def get_wallet_balance(self, agent_id: int) -> float:
        """Get agent balance in ETH."""
        if not self.wallet:
            return 0.0
        bal_wei = self.wallet.functions.getBalance(agent_id).call()
        return float(Web3.from_wei(bal_wei, "ether"))

    def get_limits(self, agent_id: int) -> Dict[str, float]:
        """Get agent spending limits."""
        if not self.wallet:
            return {"daily_limit": 0.0, "per_tx_limit": 0.0, "approval_threshold": 0.0}
        daily_wei, per_tx_wei, thresh_wei = self.wallet.functions.limits(agent_id).call()
        return {
            "daily_limit": float(Web3.from_wei(daily_wei, "ether")),
            "per_tx_limit": float(Web3.from_wei(per_tx_wei, "ether")),
            "approval_threshold": float(Web3.from_wei(thresh_wei, "ether")),
        }

    def get_spent_today(self, agent_id: int) -> float:
        """Get amount spent by agent today in ETH."""
        if not self.wallet:
            return 0.0
        spent_wei = self.wallet.functions.spentToday(agent_id).call()
        return float(Web3.from_wei(spent_wei, "ether"))

    def is_frozen(self, agent_id: int) -> bool:
        """Check if agent is frozen."""
        if not self.wallet:
            return False
        return self.wallet.functions.frozen(agent_id).call()

    def request_payment(self, agent_id: int, to_address: str, amount_eth: float,
                        reason: str, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Request a payment from an agent's wallet."""
        if not self.wallet:
            raise RuntimeError("AgentWallet contract address not set")

        to_chk = Web3.to_checksum_address(to_address)
        amount_wei = Web3.to_wei(amount_eth, "ether")

        func = self.wallet.functions.requestPayment(agent_id, to_chk, amount_wei, reason)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)

        # Check if ApprovalRequired or PaymentSent was emitted
        approval_required = False
        request_id = None

        for log in receipt.logs:
            try:
                event = self.wallet.events.ApprovalRequired().process_log(log)
                approval_required = True
                request_id = event["args"]["requestId"]
                break
            except Exception:
                continue

        return {
            "agent_id": agent_id,
            "to": to_address,
            "amount_eth": amount_eth,
            "reason": reason,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
            "approval_required": approval_required,
            "request_id": request_id,
        }

    def approve_and_send(self, request_id: int, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Approve and execute a pending payment request."""
        if not self.wallet:
            raise RuntimeError("AgentWallet contract address not set")

        func = self.wallet.functions.approveAndSend(request_id)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)
        return {
            "request_id": request_id,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
        }

    def emergency_freeze(self, agent_id: int, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Freeze agent wallet."""
        if not self.wallet:
            raise RuntimeError("AgentWallet contract address not set")
        func = self.wallet.functions.emergencyFreeze(agent_id)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)
        return {"agent_id": agent_id, "tx_hash": tx_hash, "explorer_url": get_explorer_tx_url(tx_hash)}

    def unfreeze(self, agent_id: int, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Unfreeze agent wallet."""
        if not self.wallet:
            raise RuntimeError("AgentWallet contract address not set")
        func = self.wallet.functions.unfreeze(agent_id)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)
        return {"agent_id": agent_id, "tx_hash": tx_hash, "explorer_url": get_explorer_tx_url(tx_hash)}

    # ── AgentMarketplace Functions ───────────────────────────────────────────

    def list_service(self, agent_id: int, name: str, price_eth: float, endpoint_uri: str,
                     private_key: Optional[str] = None) -> Dict[str, Any]:
        """List a service on AgentMarketplace."""
        if not self.marketplace:
            raise RuntimeError("AgentMarketplace contract address not set")

        price_wei = Web3.to_wei(price_eth, "ether")
        func = self.marketplace.functions.listService(agent_id, name, price_wei, endpoint_uri)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)

        service_id = None
        for log in receipt.logs:
            try:
                event = self.marketplace.events.ServiceListed().process_log(log)
                service_id = event["args"]["serviceId"]
                break
            except Exception:
                continue

        return {
            "service_id": service_id,
            "agent_id": agent_id,
            "name": name,
            "price_eth": price_eth,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
        }

    def get_service(self, service_id: int) -> Dict[str, Any]:
        """Get service details."""
        if not self.marketplace:
            raise RuntimeError("AgentMarketplace contract address not set")

        agent_id, name, price_wei, endpoint_uri, active = self.marketplace.functions.getService(service_id).call()
        return {
            "service_id": service_id,
            "agent_id": agent_id,
            "name": name,
            "price_eth": float(Web3.from_wei(price_wei, "ether")),
            "endpoint_uri": endpoint_uri,
            "active": active,
        }

    def get_services(self) -> List[Dict[str, Any]]:
        """Get all active services with agent reputation."""
        if not self.marketplace:
            return []

        service_ids = self.marketplace.functions.getAllServices().call()
        services = []
        for sid in service_ids:
            try:
                svc = self.get_service(sid)
                # Attach agent reputation
                if self.registry:
                    try:
                        agent_info = self.get_agent(svc["agent_id"])
                        svc["agent_reputation"] = agent_info["reputation_score"]
                        svc["agent_owner"] = agent_info["owner"]
                    except Exception:
                        svc["agent_reputation"] = 50
                services.append(svc)
            except Exception as e:
                logger.warning(f"Failed to fetch service #{sid}: {e}")

        return services

    def hire_agent(self, requester_id: int, service_id: int, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Hire a service on the marketplace."""
        if not self.marketplace:
            raise RuntimeError("AgentMarketplace contract address not set")

        func = self.marketplace.functions.hireAgent(requester_id, service_id)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)

        job_id = None
        approval_required = False
        request_id = None
        for log in receipt.logs:
            try:
                event = self.marketplace.events.JobCreated().process_log(log)
                job_id = event["args"]["jobId"]
            except Exception:
                pass
            try:
                event = self.wallet.events.ApprovalRequired().process_log(log)
                approval_required = True
                request_id = event["args"]["requestId"]
            except Exception:
                pass

        return {
            "job_id": job_id,
            "requester_id": requester_id,
            "service_id": service_id,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
            "approval_required": approval_required,
            "request_id": request_id,
        }

    def complete_job(self, job_id: int, success: bool, private_key: Optional[str] = None) -> Dict[str, Any]:
        """Complete a marketplace job and update reputation."""
        if not self.marketplace:
            raise RuntimeError("AgentMarketplace contract address not set")

        func = self.marketplace.functions.completeJob(job_id, success)
        tx_hash, receipt = self._send_transaction(func, private_key=private_key)
        return {
            "job_id": job_id,
            "success": success,
            "tx_hash": tx_hash,
            "explorer_url": get_explorer_tx_url(tx_hash),
        }

    # ── Reputation Functions ─────────────────────────────────────────────────

    def get_reputation(self, agent_id: int) -> Dict[str, Any]:
        """Get reputation statistics for an agent."""
        if not self.reputation:
            return {"score": 50, "jobs_completed": 0, "jobs_failed": 0}

        score = self.reputation.functions.computeScore(agent_id).call()
        completed = self.reputation.functions.jobsCompleted(agent_id).call()
        failed = self.reputation.functions.jobsFailed(agent_id).call()

        return {
            "score": score,
            "jobs_completed": completed,
            "jobs_failed": failed,
        }


# Singleton instance
chain_client = ChainClient()
