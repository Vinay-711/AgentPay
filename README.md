# AgentPay

**Give AI Agents an Economy.**

Built at Monad Blitz Bangalore V5 (August 16, 2026).

AgentPay is an economic infrastructure layer for autonomous AI agents on
Monad. Agents get an on-chain identity, a policy-constrained wallet, and the
ability to discover, hire, and pay other agents autonomously — settled on
Monad, guarded by **AgentGuard**.

```
Human → AI Agent → AI Agent → AI Agent → Monad → Settlement
```

instead of the usual:

```
Human → AI → Human approval → Payment
```

> See [`PRD.md`](./PRD.md) for full product scope, architecture, and demo script.

---

## Why

AI agents can reason and plan, but every economic action still needs a human
in the loop. AgentPay removes that bottleneck for agent-to-agent commerce:
agents can hire specialist agents and pay them, autonomously, within hard
spending limits that a human sets once — not per transaction.

## What's in this repo (hackathon MVP scope)

- **Smart contracts (Monad testnet)**
  - `AgentRegistry.sol` — on-chain agent identity
  - `AgentWallet.sol` — constrained wallet: deposits, payments, per-tx / daily limits, withdrawals
  - `AgentMarketplace.sol` — agent registration, service listings, hiring, payment routing
  - `Reputation.sol` — job history → reputation score
- **AgentGuard** — a rule-based policy engine that sits between the LLM and
  the wallet. The LLM never holds a private key; it can only *request* a
  payment, which AgentGuard evaluates against spending limits, allowlists,
  and an approval threshold before it's allowed to reach the wallet.
- **Backend** — FastAPI (or Node.js) agent orchestrator: LLM + tool calling
  (`search_agents`, `get_agent_profile`, `hire_agent`, `send_payment`,
  `check_wallet`, `request_human_approval`, `record_result`)
- **Frontend** — React dashboard: balance/spend/reputation overview, natural
  language command box, agent marketplace, agent passport, wallet view,
  AgentGuard approval/block modal, live transaction activity feed
- **Database** — Supabase/Postgres (`agents`, `services`, `jobs`, `transactions`)

## Architecture

```
User
  ↓
AI Agent (LLM orchestrator)
  ↓
AgentGuard Policy Engine   ← LLM can only REQUEST a payment
  ↓
Smart Wallet (AgentWallet.sol)
  ↓
Monad
```

## Demo

1. Connect wallet, deposit testnet funds
2. Create a TravelAgent with a $10 daily spending limit
3. Ask it to "Plan a 3-day Dubai trip under $500"
4. Watch it discover, hire, and pay specialist agents (FlightFinder,
   HotelFinder, ActivityFinder) on Monad — with AgentGuard checking every
   transaction and real tx hashes shown live
5. Get the final itinerary, with reputation and transaction history updated
   on-chain

## Tech Stack

| Layer | Choice |
|---|---|
| Blockchain | Monad Testnet |
| Contracts | Solidity |
| Backend | FastAPI / Node.js |
| AI orchestration | LLM with tool/function calling |
| Frontend | React |
| Database | Supabase (Postgres) |
| Cache | Redis (agent reputation, avoids re-querying chain per request) |

## Getting Started

### 1. Prerequisites
- Python 3.11+
- Node.js v18+ & npm
- Foundry (`forge`)
- Monad Testnet Wallet with testnet funds

### 2. Deployment & Startup Sequence

```bash
# 1. Deploy Smart Contracts to Monad Testnet
cd contracts
./deploy-monad.sh
cd ..

# 2. Start Backend Server
cd backend
source venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=.. uvicorn backend.main:app --host 0.0.0.0 --port 8000

# 3. Start Frontend UI (in another terminal)
cd frontend
npm install
npm run dev

# 4. Seed Demo Agents & Marketplace (in another terminal)
source backend/venv/bin/activate
PYTHONPATH=. python backend/seed.py

# 5. Run Live End-to-End Demo
PYTHONPATH=. python scripts/run_clean_demo_flow.py
```

## Offline policy verification

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-policy-test.txt
python -m pytest backend/tests/test_policy_safety.py -q
```

These tests inject a mock chain client and cover invalid amounts, failed chain lookups,
recipient reputation, transaction limits and daily budgets. No private key, RPC calls,
LLM credentials or transaction submission is required. GitHub Actions runs this suite
on pull requests and pushes to `main`. A recipient verification outage blocks a request;
invalid or non-positive amounts are rejected before chain access.

This is a hackathon prototype, not an audited payment system. The offline suite does
not validate smart-contract safety, live settlement or the ML layer. Other trust and
fallback paths need further review before handling real funds. Use testnet funds only.

## License

MIT

## Component guides

| Component | Start here |
| --- | --- |
| Dashboard | [Frontend development](frontend/README.md) |
| Solidity contracts | [Contract build and test](contracts/README.md) |
| End-to-end design and setup | [Documentation](docs/README.md) |
| Payment-policy regression coverage | [Policy safety tests](backend/tests/test_policy_safety.py) |

Treat ML latency claims in design material as evaluation targets unless accompanied by a reproducible benchmark. Live provider calls, testnet transactions and model training are separate from local deterministic policy checks.

### Recipient-trust regression checks

`python -m pip install -r requirements-policy-test.txt` followed by
`python -m pytest backend/tests/test_policy_safety.py -q` runs the isolated policy suite.
Unknown recipients and absent, malformed, or out-of-range reputation scores fail closed.
A service display name cannot override its registered reputation. Explicit demo aliases
remain prototype conveniences, not production identity verification. Tests mock the chain
and never send payments.

### Required spending-policy data

AgentGuard requires all three chain policy fields (`per_tx_limit`, `daily_limit`,
`approval_threshold`) and a finite nonnegative spending total. Missing fields,
negative values, nonfinite numbers, and booleans block payment rather than using
local defaults. Explicit zero transaction/daily limits retain their existing
unlimited meaning. Run the policy suite documented above to verify this behavior.
