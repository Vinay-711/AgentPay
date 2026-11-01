# AgentPay — Documentation & Getting Started

**Give AI Agents an Economy.**  
*Economic Infrastructure for Autonomous Multi-Agent Commerce on Monad.*

---

## 1. Architecture Overview

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Smart Contracts** | Solidity ^0.8.24, Foundry, Monad Testnet | On-chain identity (`AgentRegistry`), policy-constrained wallets (`AgentWallet`), service catalog (`AgentMarketplace`), and reputation tracking (`Reputation`). |
| **Backend Orchestrator** | Python 3.11, FastAPI, Web3.py, LiteLLM/Claude | Autonomous LLM agent orchestrator with live WebSocket event streaming. |
| **Security Layer** | **AgentGuard** Policy Engine | Deterministic 5-rule safety engine + experimental ML risk scoring (latency requires benchmarking) that intercepts all LLM payment requests. |
| **ML Risk Pipeline** | XGBoost, Isolation Forest, TF-IDF + LogisticRegression | Tabular risk classifier, spending sequence anomaly detector, and prompt injection defense. |
| **Frontend Application** | React 18, TypeScript, Vite, Vanilla CSS + Glassmorphism | Live real-time dashboard, interactive agent marketplace, wallet management, agent passport, and AgentGuard intervention modals. |

---

## 2. Development Setup Sequence

Follow these steps to boot the entire AgentPay ecosystem cleanly from scratch:

### Step 1: Environment & Prerequisites
- **Python:** 3.11+ (with `venv`)
- **Node.js:** v18+ & npm
- **Foundry:** `forge` (for EVM contract compilation & deployment)
- **Monad Testnet Wallet:** funded with testnet MON

---

### Step 2: Smart Contract Deployment (Monad Testnet)

```bash
cd contracts

# 1. Copy environment template and configure deployer private key
cp .env.example .env
# Edit .env: MONAD_TESTNET_RPC=https://testnet-rpc.monad.xyz, DEPLOYER_PRIVATE_KEY=0x...

# 2. Deploy to Monad Testnet (Chain ID 10143)
./deploy-monad.sh
cd ..
```
*`deploy-monad.sh` automatically compiles, deploys, generates `contracts/deployed-addresses.json`, and updates `backend/.env` with deployed contract addresses.*

---

### Step 3: Backend Setup & Server Start

```bash
cd backend

# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure backend environment
# Ensure backend/.env contains MONAD_TESTNET_RPC, AGENT_WALLET_PRIVATE_KEY, and contract addresses.

# 4. Start FastAPI server
PYTHONPATH=.. uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
*The backend API will be live at `http://localhost:8000` (Health check: `http://localhost:8000/health`).*

---

### Step 4: Frontend Setup & Dev Server Start

In a separate terminal:

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite dev server
npm run dev
```
*The web UI will be accessible at `http://localhost:5173`.*

---

### Step 5: Seed Demo Specialist Agents & Services

In a separate terminal (with backend running):

```bash
source backend/venv/bin/activate
PYTHONPATH=. python backend/seed.py
```
*This registers specialist worker agents (`FlightFinder`, `HotelFinder`, `ActivityFinder`) on Monad Testnet and lists their services in the marketplace.*

---

### Step 6: Train / Validate ML Models (Optional)

All models come pre-trained, but to regenerate datasets and re-train from scratch:

```bash
source backend/venv/bin/activate
PYTHONPATH=. python ml/training/train_transaction_risk.py
PYTHONPATH=. python ml/training/train_behavior_anomaly.py
PYTHONPATH=. python ml/training/train_prompt_injection.py
```

---

### Step 7: Run Automated End-to-End Demo & Test Suite

```bash
# Run complete test suite (7/7 tests on Monad Testnet)
source backend/venv/bin/activate
PYTHONPATH=. pytest backend/tests/test_integration.py -v

# Run full live demo flow with on-chain tx logging:
PYTHONPATH=. python scripts/run_clean_demo_flow.py
```
*Results and live on-chain Monad testnet tx hashes will be saved into `docs/DEMO_LOG.md`.*

## Validation scope

Use the [contract guide](../contracts/README.md) for actual Foundry commands and the [frontend guide](../frontend/README.md) for the dashboard. The deterministic policy suite is [test_policy_safety.py](../backend/tests/test_policy_safety.py); it is distinct from provider-backed integration tests and testnet settlement. Model latency, accuracy and transaction success need their own recorded evaluation.
