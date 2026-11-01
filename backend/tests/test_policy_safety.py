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


def test_unknown_recipient_without_service_is_not_trusted(client):
    result = AgentGuard(client).evaluate(1, 0.1, "unverified-recipient")
    assert result.decision == "BLOCK"
    assert any(c.label == "Recipient trusted" and not c.passed for c in result.checks)


@pytest.mark.parametrize("reputation", [{}, {"score": None}, {"score": float("nan")},
    {"score": float("inf")}, {"score": 101}, {"score": -1}, {"score": True}])
def test_missing_or_invalid_reputation_is_not_trusted(client, reputation):
    client.get_reputation.return_value = reputation
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


def test_trusted_demo_name_cannot_override_low_reputation(client):
    client.get_service.return_value = {"agent_id": 2, "name": "FlightFinder"}
    client.get_reputation.return_value = {"score": 10}
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


def test_service_without_registered_agent_is_not_trusted(client):
    client.get_service.return_value = {"name": "FlightFinder"}
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


@pytest.mark.parametrize("field", ["per_tx_limit", "daily_limit", "approval_threshold"])
def test_missing_policy_field_blocks(client, field):
    del client.get_limits.return_value[field]
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


@pytest.mark.parametrize("field", ["per_tx_limit", "daily_limit", "approval_threshold"])
@pytest.mark.parametrize("value", [float("inf"), -1.0, True])
def test_invalid_policy_values_block(client, field, value):
    client.get_limits.return_value[field] = value
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


@pytest.mark.parametrize("spent", [-1.0, float("nan"), float("inf"), True])
def test_invalid_spending_total_blocks(client, spent):
    client.get_spent_today.return_value = spent
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "BLOCK"


def test_explicit_zero_budget_limits_remain_unlimited(client):
    client.get_limits.return_value.update(per_tx_limit=0, daily_limit=0)
    assert AgentGuard(client).evaluate(1, 0.1, "recipient", service_id=3).decision == "ALLOW"
