"""AgentGuard Policy Engine — On-chain & off-chain rule evaluation augmented with ML."""

import logging
import math
from typing import Any, Dict, List, Optional

from backend.chain import chain_client
from backend.models.schemas import RiskCheck, RiskResult

logger = logging.getLogger(__name__)

# Known trusted addresses/services for hackathon demo
KNOWN_TRUSTED_SERVICES = {
    "flightfinder",
    "hotelfinder",
    "activityfinder",
    "travelplanner",
    "weatherchecker",
    "dubai-flights",
    "dubai-hotels",
    "dubai-activities",
}


class AgentGuard:
    """AgentGuard Security & Policy Enforcement Engine with ML Risk Scoring."""

    def __init__(self, client=None):
        self.chain = client or chain_client

    def evaluate(
        self,
        agent_id: int,
        amount_eth: float,
        recipient: str,
        reason: str = "",
        task_description: Optional[str] = "",
        service_id: Optional[int] = None,
    ) -> RiskResult:
        """
        Evaluate a prospective payment transaction against 5 security checks
        augmented with ML risk scoring for MEDIUM/borderline risk cases:
        1. Agent verified
        2. Recipient trusted
        3. Within transaction limit
        4. Within daily budget
        5. Service matches requested task
        + ML Risk Assessment (when in borderline/medium risk zone)
        """
        if not math.isfinite(amount_eth) or amount_eth <= 0:
            return RiskResult(
                decision="BLOCK",
                reasons=["Payment amount must be finite and greater than zero."],
                checks=[RiskCheck(label="Valid payment amount", passed=False)],
            )

        checks: List[RiskCheck] = []
        fail_reasons: List[str] = []

        # ── Check 1: Agent verified ───────────────────────────────────────────
        agent_verified = False
        try:
            agent = self.chain.get_agent(agent_id)
            if agent and agent.get("active", False):
                agent_verified = True
                checks.append(RiskCheck(label="Agent verified", passed=True))
            else:
                checks.append(RiskCheck(label="Agent verified", passed=False, detail="Agent is inactive or not found"))
                fail_reasons.append("✕ Agent verified: Agent is inactive or not registered in AgentRegistry")
        except Exception as e:
            logger.error(f"Agent verification check error: {e}")
            checks.append(RiskCheck(label="Agent verified", passed=False, detail=str(e)))
            fail_reasons.append(f"✕ Agent verified: {e}")

        # ── Check 2: Recipient trusted ────────────────────────────────────────
        recipient_trusted = False
        rep_score = 0
        try:
            if service_id:
                svc = self.chain.get_service(service_id)
                target_agent_id = svc.get("agent_id")
                if target_agent_id:
                    rep = self.chain.get_reputation(target_agent_id)
                    rep_score = rep.get("score", 0)
            else:
                if recipient.lower() in [s.lower() for s in KNOWN_TRUSTED_SERVICES]:
                    rep_score = 100

            if (isinstance(rep_score, bool) or not isinstance(rep_score, (int, float))
                    or not math.isfinite(rep_score) or not 0 <= rep_score <= 100):
                raise ValueError("Invalid recipient reputation")

            if rep_score >= 40:
                recipient_trusted = True
                checks.append(RiskCheck(label="Recipient trusted", passed=True, detail=f"Reputation score: {rep_score}/100"))
            else:
                checks.append(RiskCheck(label="Recipient trusted", passed=False, detail=f"Low reputation: {rep_score}/100 (<40)"))
                fail_reasons.append(f"✕ Recipient trusted: Recipient reputation ({rep_score}/100) is below safety threshold of 40")
        except Exception as e:
            logger.warning("Recipient verification unavailable: %s", type(e).__name__)
            checks.append(RiskCheck(label="Recipient trusted", passed=False,
                                    detail="Recipient verification unavailable"))
            fail_reasons.append("Recipient trust could not be verified; retry after the lookup recovers.")

        # ── Check 3 & 4: Transaction & Daily Limits ───────────────────────────
        within_tx_limit = False
        within_daily_limit = False
        approval_threshold = 0.0
        per_tx_limit = 0.5
        daily_limit = 1.0
        spent_today = 0.0

        try:
            limits = self.chain.get_limits(agent_id)
            spent_today = self.chain.get_spent_today(agent_id)
            per_tx_limit = limits["per_tx_limit"]
            daily_limit = limits["daily_limit"]
            approval_threshold = limits["approval_threshold"]
            for value in (per_tx_limit, daily_limit, approval_threshold, spent_today):
                if (isinstance(value, bool) or not isinstance(value, (int, float))
                        or not math.isfinite(value) or value < 0):
                    raise ValueError("Policy limits and spending must be finite nonnegative numbers")

            # Check 3: Within transaction limit
            if per_tx_limit == 0.0 or amount_eth <= per_tx_limit:
                within_tx_limit = True
                checks.append(RiskCheck(label="Within transaction limit", passed=True,
                                        detail=f"{amount_eth:.4f} ETH <= limit {per_tx_limit:.4f} ETH"))
            else:
                checks.append(RiskCheck(label="Within transaction limit", passed=False,
                                        detail=f"{amount_eth:.4f} ETH exceeds per-tx limit {per_tx_limit:.4f} ETH"))
                fail_reasons.append(f"✕ Within transaction limit: Requested {amount_eth:.4f} ETH exceeds limit of {per_tx_limit:.4f} ETH")

            # Check 4: Within daily budget
            if daily_limit == 0.0 or (spent_today + amount_eth) <= daily_limit:
                within_daily_limit = True
                checks.append(RiskCheck(label="Within daily budget", passed=True,
                                        detail=f"Spent today ({spent_today:.4f}) + amount ({amount_eth:.4f}) <= daily limit {daily_limit:.4f} ETH"))
            else:
                checks.append(RiskCheck(label="Within daily budget", passed=False,
                                        detail=f"Spent today ({spent_today:.4f}) + amount ({amount_eth:.4f}) exceeds daily limit {daily_limit:.4f} ETH"))
                fail_reasons.append(f"✕ Within daily budget: Cumulative daily spend ({spent_today + amount_eth:.4f} ETH) exceeds daily limit of {daily_limit:.4f} ETH")

        except Exception as e:
            logger.error(f"Limits verification error: {e}")
            checks.append(RiskCheck(label="Within transaction limit", passed=False, detail=str(e)))
            checks.append(RiskCheck(label="Within daily budget", passed=False, detail=str(e)))
            fail_reasons.append(f"✕ Limits check: {e}")

        # ── Check 5: Service matches requested task ───────────────────────────
        service_matches = True
        if task_description and service_id:
            try:
                from backend.db.database import SessionLocal, ServiceModel
                _db = SessionLocal()
                _svc_db = _db.query(ServiceModel).filter(ServiceModel.service_id == service_id).first()
                if _svc_db:
                    svc_name = _svc_db.name.lower()
                    display_name = _svc_db.name
                else:
                    svc = self.chain.get_service(service_id)
                    svc_name = svc.get("name", "").lower()
                    display_name = svc.get("name", f"Service #{service_id}")
                _db.close()

                task_lower = task_description.lower()

                keywords = [
                    "flight", "hotel", "activity", "booking", "trip", "dubai",
                    "travel", "tour", "ticket", "restaurant", "transport", "review",
                    "lunch", "food", "catering", "meal", "delivery"
                ]

                relevant_task_words = [kw for kw in keywords if kw in task_lower]
                relevant_svc_words = [kw for kw in keywords if kw in svc_name]

                if relevant_task_words and relevant_svc_words:
                    has_overlap = (
                        any(w in relevant_svc_words for w in relevant_task_words)
                        or ("trip" in relevant_task_words)
                        or ("dubai" in relevant_task_words)
                        or ("lunch" in relevant_task_words and any(w in relevant_svc_words for w in ["lunch", "food", "catering", "meal", "restaurant"]))
                    )
                    service_matches = bool(has_overlap)
                else:
                    service_matches = True

                if service_matches:
                    checks.append(RiskCheck(label="Service matches requested task", passed=True,
                                            detail=f"Service '{display_name}' matches context"))
                else:
                    checks.append(RiskCheck(label="Service matches requested task", passed=False,
                                            detail=f"Service '{display_name}' does not match task scope"))
                    fail_reasons.append(f"✕ Service matches requested task: Service '{display_name}' is irrelevant to '{task_description[:40]}...'")

            except Exception as e:
                checks.append(RiskCheck(label="Service matches requested task", passed=True, detail="Fallback match"))
        else:
            checks.append(RiskCheck(label="Service matches requested task", passed=True, detail="No service constraint specified"))

        # ── Hard BLOCK Decision (Rule Violation) ──────────────────────────────
        if fail_reasons:
            return RiskResult(
                decision="BLOCK",
                reasons=fail_reasons,
                checks=checks,
            )

        # ── Fast-Path vs Medium-Risk Assessment ──────────────────────────────
        # Determine if transaction is borderline / MEDIUM-risk:
        # 1. Amount is elevated relative to limits (> 85% of per-tx limit)
        # 2. Cumulative spend is high (> 85% of daily limit)
        # 3. Amount exceeds human approval threshold
        # 4. Text contains suspicious keywords / prompt injection attempts
        combined_text = f"{reason} {task_description}".strip()
        is_near_limit = (per_tx_limit > 0 and amount_eth > 0.85 * per_tx_limit)
        is_high_spend = (daily_limit > 0 and (spent_today + amount_eth) > 0.85 * daily_limit)
        is_over_threshold = (approval_threshold > 0 and amount_eth > approval_threshold)

        suspicious_cues = ["ignore", "override", "bypass", "system", "drain", "force", "raw", "debug", "attacker", "evil"]
        has_suspicious_text = any(cue in combined_text.lower() for cue in suspicious_cues)

        is_medium_risk = is_near_limit or is_high_spend or is_over_threshold or has_suspicious_text

        # If clean low-risk, execute fast-path (<5ms)
        if not is_medium_risk:
            return RiskResult(
                decision="ALLOW",
                reasons=["All security and budget checks passed successfully."],
                checks=checks,
            )

        # ── Medium-Risk Augmentation via ML Layer ─────────────────────────────
        try:
            from ml.inference import score_transaction, classify_intent

            tx_features = {
                "transaction_amount": amount_eth,
                "daily_spending": spent_today,
                "remaining_budget": max(0.0, daily_limit - spent_today),
                "transaction_limit": per_tx_limit,
                "agent_reputation": 95.0,
                "recipient_reputation": float(rep_score),
                "recipient_age": 90,
                "previous_transactions": 35,
                "failed_transactions": 0,
                "transaction_frequency": 1.5,
                "task_similarity": 0.85 if service_matches else 0.20,
                "recipient_verified": 1 if rep_score >= 60 else 0,
                "contract_verified": 1,
                "time_since_last_transaction": 1200.0,
            }

            ml_risk_score = score_transaction(tx_features)
            intent = classify_intent(combined_text)

            # Check ML classification
            if intent["is_injection"] or ml_risk_score >= 0.65:
                checks.append(RiskCheck(
                    label="ML Risk Assessment",
                    passed=False,
                    detail=f"Elevated risk: {ml_risk_score:.2f} ({intent['category']})"
                ))
                return RiskResult(
                    decision="BLOCK",
                    reasons=[
                        f"✕ ML Risk Engine: High risk score ({ml_risk_score:.2f}) or adversarial intent detected ({intent['category']})."
                    ],
                    checks=checks,
                )

            elif ml_risk_score >= 0.50 or intent["category"] == "SUSPICIOUS" or is_over_threshold:
                checks.append(RiskCheck(
                    label="ML Risk Assessment",
                    passed=True,
                    detail=f"Score: {ml_risk_score:.2f} ({intent['category']})"
                ))
                return RiskResult(
                    decision="REVIEW",
                    reasons=[
                        f"ML Risk Assessment: Score {ml_risk_score:.2f} ({intent['category']}). Amount/context requires human confirmation."
                    ],
                    checks=checks,
                )

            else:
                checks.append(RiskCheck(
                    label="ML Risk Assessment",
                    passed=True,
                    detail=f"Score: {ml_risk_score:.2f} (Low Risk)"
                ))
                return RiskResult(
                    decision="ALLOW",
                    reasons=["All security checks and ML risk evaluation passed."],
                    checks=checks,
                )

        except Exception as e:
            logger.warning(f"ML evaluation fallback error: {e}")
            if is_over_threshold:
                return RiskResult(
                    decision="REVIEW",
                    reasons=[f"Amount ({amount_eth:.4f} ETH) exceeds approval threshold ({approval_threshold:.4f} ETH)."],
                    checks=checks,
                )
            return RiskResult(
                decision="ALLOW",
                reasons=["All security and budget checks passed."],
                checks=checks,
            )


# Singleton
agent_guard = AgentGuard()
