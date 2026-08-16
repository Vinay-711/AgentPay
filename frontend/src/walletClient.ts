import { ethers } from 'ethers';
import {
  AGENT_WALLET_ABI,
  CHAIN_ID,
  CONTRACT_ADDRESS,
  DEMO_PRIVATE_KEY,
  EXPLORER_URL,
  MONAD_RPC_URL,
  type SpecialistAgent,
} from './config';

export interface AgentData {
  balance: number; // in USD dollars (e.g. 10.00)
  spent: number; // in USD dollars (e.g. 0.00)
  reputation: number; // e.g. 94
  exists: boolean;
  address: string;
}

export interface ActivityStep {
  id: string;
  type: 'plan' | 'discovery' | 'payment_pending' | 'payment_paid' | 'payment_denied' | 'result' | 'reputation';
  text: string;
  agent?: SpecialistAgent;
  reason?: string;
  txHash?: string;
  explorerUrl?: string;
  amount?: string;
  timestamp: string;
  settleTimeMs?: number;
}

export interface MultiPaymentResult {
  results: Array<{
    agent: SpecialistAgent;
    txHash: string;
    explorerUrl: string;
  }>;
  totalDurationMs: number;
  impliedTps: number;
  totalAmountDollars: number;
}

// ── SINGLETON STATIC PROVIDER & SIGNER (PREVENTS RPC SPAM) ─────────────────────
const staticNetwork = ethers.Network.from({
  chainId: CHAIN_ID,
  name: 'monad-testnet',
});

const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL, staticNetwork, { staticNetwork });
const signer = new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, AGENT_WALLET_ABI, signer);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Robust retry wrapper with exponential backoff for Monad RPC / QuickNode rate limits
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 4, baseDelayMs = 800): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errMsg = err?.message || JSON.stringify(err);
    const isRateLimit =
      errMsg.includes('50/second') ||
      errMsg.includes('rate limit') ||
      errMsg.includes('429') ||
      err?.code === -32007 ||
      err?.error?.code === -32007;

    if (retries > 0 && isRateLimit) {
      console.warn(`[Monad RPC] Rate limit encountered, retrying in ${baseDelayMs}ms... (retries left: ${retries})`);
      await delay(baseDelayMs);
      return withRetry(fn, retries - 1, baseDelayMs * 1.8);
    }
    throw err;
  }
}

/**
 * Register TravelAgent on Monad testnet.
 */
export async function createTravelAgentOnChain(): Promise<{ txHash: string; agent: AgentData }> {
  return withRetry(async () => {
    const tx = await contract.createAgent({ gasLimit: 200000 });
    await tx.wait();

    const agentData: AgentData = {
      balance: 10.0,
      spent: 0.0,
      reputation: 94,
      exists: true,
      address: signer.address,
    };

    return {
      txHash: tx.hash,
      agent: agentData,
    };
  });
}

/**
 * Fetch live on-chain Agent data.
 */
export async function fetchAgentFromChain(): Promise<AgentData | null> {
  try {
    return await withRetry(async () => {
      const data = await contract.getAgent(signer.address);

      const exists = data[3];
      if (!exists) return null;

      return {
        balance: Number(data[0]) / 100,
        spent: Number(data[1]) / 100,
        reputation: Number(data[2]),
        exists: true,
        address: signer.address,
      };
    }, 2, 500);
  } catch (e) {
    console.warn('Error fetching agent from chain:', e);
    return null;
  }
}

/**
 * Execute on-chain payment to a single specialist agent on Monad testnet.
 */
export async function paySpecialistOnChain(
  specialist: SpecialistAgent,
  taskDescription: string
): Promise<{ txHash: string; explorerUrl: string; durationMs: number }> {
  return withRetry(async () => {
    const label = `${specialist.name} hiring: ${taskDescription.slice(0, 32)}`;
    const startTime = performance.now();

    const tx = await contract.pay(specialist.recipient, specialist.priceCents, label, { gasLimit: 200000 });
    await tx.wait();

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    return {
      txHash: tx.hash,
      explorerUrl: `${EXPLORER_URL}/tx/${tx.hash}`,
      durationMs,
    };
  });
}

/**
 * Execute multiple specialist payments concurrently on Monad Testnet using Promise.all
 * Staggers submissions slightly to respect QuickNode burst limits while settling in the same block.
 */
export async function payMultipleSpecialistsConcurrently(
  specialists: SpecialistAgent[],
  taskDescription: string
): Promise<MultiPaymentResult> {
  return withRetry(async () => {
    const baseNonce = await provider.getTransactionCount(signer.address, 'latest');
    const startTime = performance.now();

    // Fire all transactions concurrently with sequential nonces and slight micro-stagger
    const txPromises = specialists.map(async (specialist, index) => {
      // 100ms micro-stagger to avoid hitting 50/sec burst limit on QuickNode RPC gateway
      if (index > 0) {
        await delay(index * 120);
      }

      const label = `${specialist.name} hiring: ${taskDescription.slice(0, 32)}`;
      const nonce = baseNonce + index;

      const tx = await contract.pay(specialist.recipient, specialist.priceCents, label, {
        gasLimit: 200000,
        nonce,
      });

      const receipt = await tx.wait();
      return {
        agent: specialist,
        txHash: tx.hash,
        explorerUrl: `${EXPLORER_URL}/tx/${tx.hash}`,
        blockNumber: receipt?.blockNumber,
      };
    });

    const results = await Promise.all(txPromises);
    const endTime = performance.now();

    const totalDurationMs = Math.round(endTime - startTime);
    const totalAmountDollars = specialists.reduce((sum, s) => sum + s.priceCents, 0) / 100;
    const impliedTps = Number((specialists.length / (totalDurationMs / 1000)).toFixed(2));

    return {
      results,
      totalDurationMs,
      impliedTps,
      totalAmountDollars,
    };
  });
}

/**
 * Bump reputation score on Monad testnet.
 */
export async function bumpReputationOnChain(newScore: number): Promise<{ txHash: string }> {
  return withRetry(async () => {
    const tx = await contract.bumpReputation(signer.address, newScore, { gasLimit: 200000 });
    await tx.wait();
    return { txHash: tx.hash };
  }, 2, 500);
}
