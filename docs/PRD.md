# AgentPay — Product Requirements Document

**Event:** Monad Blitz Bangalore V5 (August 16, 2026)
**Tagline:** Give AI Agents an Economy.
**Network:** Monad Testnet

---

## 1. Problem Statement

AI agents can reason, plan, and use tools — but they cannot participate in an
economy. Every economic action (payment, hiring another service, settling a
transaction) still requires a human in the loop. This blocks the emergence of
autonomous multi-agent systems that hire, pay, and verify each other.

## 2. Solution

AgentPay is an economic infrastructure layer for autonomous AI agents, built
on Monad. Agents get:

1. An on-chain identity
2. A constrained, policy-governed wallet
3. The ability to discover other agents in a marketplace
4. The ability to hire and pay other agents autonomously
5. A verifiable on-chain reputation built from real job history
6. Hard spending/security limits enforced by **AgentGuard**, a policy engine
   that sits between the LLM and the wallet — the LLM never touches a private
   key directly, it only *requests* a payment.

Core loop:

```
Human → AI Agent → AI Agent → AI Agent → Monad → Settlement
```

instead of:

```
Human → AI → Human approval → Payment
```

## 3. Target User (for the demo)

A person who wants an AI agent to complete a multi-step task (e.g. "plan a
3-day Dubai trip under $500") without approving every micro-transaction the
agent makes to specialist sub-agents along the way.

## 4. Differentiation

| Normal AI agent | AgentPay agent |
|---|---|
| Intelligence only | Intelligence + economic agency |
| Calls APIs | Hires other agents |
| Human pays | Agent pays, within policy |
| No identity | On-chain identity |
| No reputation | Verifiable on-chain reputation |
| No spend controls | Programmable AgentGuard limits |
| Single-agent | AI-to-AI commerce |

We are **not** "an AI agent that can make crypto payments." We are an
economic infrastructure layer for autonomous agents.

---

## 5. Scope for the 6-Hour Hackathon

### MUST HAVE (build this, nothing else, until it works end-to-end)
- [ ] `AgentRegistry.sol` — on-chain agent identity (id, owner, metadata URI, capabilities, reputation pointer)
- [ ] `AgentWallet.sol` — deposits, payments, per-tx and daily spending limits, withdrawals
- [ ] `AgentMarketplace.sol` — service listing + hiring + payment routing
- [ ] `Reputation.sol` — job success/failure counters, derived score
- [ ] One working agent-to-agent payment flow, executed for real on Monad testnet, with a real tx hash shown in the UI
- [ ] One specialized "worker" agent (e.g. FlightFinder) that can be discovered and hired
- [ ] AgentGuard **rule engine only** (no ML) — hard-coded checks: per-tx limit, daily limit, allowlist/verification flag, human-approval threshold
- [ ] Dashboard: balance, spend today, reputation, natural-language command box, live activity feed
- [ ] Live activity feed showing each discovery → hire → payment → result step in real time

### NICE TO HAVE (only after MUST HAVE is demo-ready)
- [ ] ML risk classifier (XGBoost) on synthetic transaction data
- [ ] Isolation Forest anomaly detector on spending behavior
- [ ] Prompt-injection / malicious-intent classifier
- [ ] Dynamic, continuously-updating reputation score
- [ ] Full "Agent Passport" profile page

### FUTURE VISION (do not build, mention only in pitch)
- Large multi-category agent marketplace
- Agent escrow, subscriptions, staking
- Cross-agent/cross-platform reputation
- Fully autonomous multi-agent businesses

---

## 6. System Architecture

```
User
  ↓
AI Agent (LLM orchestrator, tool-calling)
  ↓
AgentGuard Policy Engine   ← the LLM can only REQUEST a payment here
  ↓
Smart Wallet (AgentWallet.sol)
  ↓
Monad
```

### AgentGuard risk pipeline (rule-engine only for hackathon scope)

```
Transaction
  ↓
Rule Engine  (limits, allowlist, verification, approval threshold)
  ↓
LOW RISK    → Auto-approve
MEDIUM RISK → Flag for review (nice-to-have)
HIGH RISK   → Block / request human approval
  ↓
Smart Wallet
  ↓
Monad
```

Example policy:
- Daily limit: $10
- Per-transaction limit: $2
- Human approval required above: $2
- Permission expiry: 24h

---

## 7. Smart Contracts (Monad Testnet, Solidity)

**AgentRegistry.sol**
- Agent ID, owner address, metadata URI, capabilities, reputation pointer

**AgentWallet.sol**
- Deposits, payments, per-tx limit, daily limit, withdrawals
- Reverts (or requires an off-chain-approved signature) if a payment request exceeds policy

**AgentMarketplace.sol**
- Agent registration, service listings, hire + payment routing

**Reputation.sol**
- Records completed/failed jobs, ratings, exposes a reputation score

---

## 8. Backend

- **Framework:** FastAPI (Python) or Node.js — pick one, don't split
- **Orchestration:** React frontend → Backend API → Agent Orchestrator → LLM → Tool selection

**Agent tools:**
- `search_agents()`
- `get_agent_profile()`
- `hire_agent()`
- `send_payment()`
- `check_wallet()`
- `request_human_approval()`
- `record_result()`

---

## 9. Database (Supabase/Postgres)

**agents** — id, name, description, owner, wallet_address, category, reputation, success_rate, price, status

**services** — id, agent_id, name, description, price, endpoint

**jobs** — id, requester_agent, worker_agent, service, amount, status, result, tx_hash

**transactions** — id, from_agent, to_agent, amount, tx_hash, timestamp

---

## 10. UI/UX Requirements

**Visual direction:** Linear × Vercel × Coinbase × futuristic AI command
center. Dark background, white/gray type, purple/Monad-inspired accents,
glass cards, subtle gradients, smooth motion. Must read as a real 2027
fintech/AI infra product — not a crypto-casino template.

**Screens:**
1. **Main Dashboard** — agent balance, spent today, reputation, natural
   language command box, active agents, recent activity
2. **Agent Marketplace** — cards per agent (reputation, jobs completed,
   success rate, price/request), filterable by category
3. **Agent Passport** — on-chain identity detail: trust score, jobs
   completed, success rate, total earned, avg response time, services
   offered, Monad wallet, "View on Monad" link
4. **Agent Wallet** — balance, daily/per-tx limits, today's transaction list
   (hiring spend / earnings), security settings summary
5. **AgentGuard modal** — pre-payment check list (✓/✕ per rule) → PAYMENT
   ALLOWED, or TRANSACTION BLOCKED with reasons + "View Details" / "Freeze
   Agent" actions
6. **Live Activity Feed** — timestamped stream of discovery → hire →
   payment (with Monad ✓) → result, ending in "TASK COMPLETED ✓" and total
   agent spend

---

## 11. Demo Flow (target: ~2 minutes on stage)

1. User connects wallet, deposits testnet funds
2. User creates a TravelAgent, sets a $10 daily spending limit
3. User types: **"Plan a 3-day Dubai trip under $500"**
4. TravelAgent analyzes the task, searches the Agent Marketplace
5. Finds FlightFinder, HotelFinder, ActivityFinder
6. TravelAgent hires them one by one
7. AgentGuard checks every transaction against policy in real time
8. Payments execute on Monad testnet (real tx hashes)
9. Results return from each sub-agent
10. TravelAgent produces the final itinerary
11. Transaction history and agent reputation update on screen

### Pitch script

- Open: *"AI agents can think. But they can't participate in an economy."*
- Pause: *"They still depend on humans for economic actions."*
- *"We built AgentPay — an economic infrastructure layer where AI agents have
  identity, wallets, spending limits, reputation, and the ability to
  autonomously transact with other AI agents."*
- → live demo →
- Close: *"We didn't just give AI a wallet. We gave AI agents an economy."*

---

## 12. Non-Negotiable Engineering Principle

The LLM **never** holds or touches a private key. It only requests a
payment; AgentGuard and the smart wallet decide whether it executes. At
least one payment in the demo must be a real, verifiable Monad testnet
transaction — not a mocked one. Secondary/decorative UI data can be
simulated; the core payment → AgentGuard → Monad path must be real.

## 13. Success Criteria for Judging

- [ ] Real Monad testnet transaction with visible tx hash
- [ ] AgentGuard genuinely blocks at least one out-of-policy transaction in the demo
- [ ] Marketplace genuinely returns registered agents (not hardcoded JSON in the frontend)
- [ ] Clean, non-generic UI that reads as a serious fintech/infra product
- [ ] Clear narrative: this is agent-to-agent commerce infrastructure, not "an AI with a wallet"
