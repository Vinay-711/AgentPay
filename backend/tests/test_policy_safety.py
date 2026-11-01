"""Offline policy regressions: never signs or sends transactions."""
from unittest.mock import Mock

import pytest

from backend.agentguard.policy_engine import AgentGuard


@pytest.fixture
def client():
    chain = Mock()
    chain.get_agent.return_value = {"active": True}
    chain.get_service.return_value = {"agent_id": 2, "name": "Independent service"}
    chain.get_reputation.return_value = {"score": 80}
    chain.get_limits.return_value = {
        "per_tx_limit": 0.5, "daily_limit": 1.0, "approval_threshold": 0.2,
    }
    chain.get_spent_today.return_value = 0.0
    return chain


@pytest.mark.parametrize("amount", [0.0, -0.1, float("nan"), float("inf"), -float("inf")])
def test_invalid_amount_blocks_before_chain_access(client, amount):
    result = AgentGuard(client).evaluate(1, amount, "recipient")
    assert result.decision == "BLOCK"
    assert not client.mock_calls


@pytest.mark.parametrize("method", ["get_service", "get_reputation"])
def test_recipient_lookup_failure_blocks(client, method):
    getattr(client, method).side_effect = RuntimeError("lookup unavailable")
    result = AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3)
    assert result.decision == "BLOCK"
    assert any(c.label == "Recipient trusted" and not c.passed for c in result.checks)


def test_valid_low_risk_payment_is_allowed(client):
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "ALLOW"


@pytest.mark.parametrize("method", ["get_agent", "get_limits", "get_spent_today"])
def test_required_chain_lookup_failure_blocks(client, method):
    getattr(client, method).side_effect = RuntimeError("lookup unavailable")
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


def test_low_reputation_blocks(client):
    client.get_reputation.return_value = {"score": 10}
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


def test_exceeded_transaction_limit_blocks(client):
    assert AgentGuard(client).evaluate(1, 0.6, "recipient", service_id=3).decision == "BLOCK"


def test_exceeded_daily_budget_blocks(client):
    client.get_spent_today.return_value = 0.95
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"
