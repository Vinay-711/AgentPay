// AgentPay Typed API Client

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws';

export interface CreateAgentRequest {
  name: string;
  description: string;
  capabilities: string[];
  metadata_uri?: string;
  daily_limit_eth?: number;
  per_tx_limit_eth?: number;
  approval_threshold_eth?: number;
}

export interface AgentResponse {
  agent_id: number;
  owner: string;
  name: string;
  description: string;
  capabilities: string[];
  metadata_uri: string;
  reputation_score: number;
  active: boolean;
  wallet_address?: string;
  tx_hash?: string;
  explorer_url?: string;
}

export interface LimitsPayload {
  daily_limit_eth: number;
  per_tx_limit_eth: number;
  approval_threshold_eth: number;
}

export interface Service {
  service_id: number;
  agent_id: number;
  agent_name?: string;
  agent_reputation?: number;
  name: string;
  category: string;
  price_eth: number;
  endpoint_uri: string;
  active: boolean;
  jobs_completed?: number;
  success_rate?: string;
}

export type MarketplaceService = Service;

export interface RiskCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface RiskResult {
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  reasons: string[];
  checks: RiskCheck[];
  timestamp?: string;
  details?: Record<string, any>;
}

export interface HiredService {
  service_id: number;
  service_name: string;
  agent_id: number;
  amount_eth: number;
  tx_hash: string;
  explorer_url: string;
  job_id: number;
}

export interface TaskResponse {
  task_id: string;
  task: string;
  agent_id: number;
  status: string;
  result?: string;
  plan?: string[];
  total_spent_eth: number;
  hired_services?: HiredService[];
  events: Record<string, unknown>[];
}

export interface Transaction {
  to: string;
  amount_eth: number;
  reason?: string;
  tx_hash: string;
  status: string;
  explorer_url?: string;
  created_at: string;
}

export interface PendingApproval {
  id: number;
  agent_id: number;
  service_id: number;
  amount_eth: number;
  recipient: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface WalletInfo {
  agent_id: number;
  balance_eth: number;
  daily_limit_eth: number;
  per_tx_limit_eth: number;
  approval_threshold_eth: number;
  spent_today_eth: number;
  is_frozen: boolean;
  transactions: Transaction[];
}

export interface AgentPassport {
  agent_id: number;
  name: string;
  description: string;
  owner: string;
  wallet_address: string;
  metadata_uri: string;
  capabilities: string[];
  reputation_score: number;
  jobs_completed: number;
  jobs_failed: number;
  success_rate: number;
  total_earned_eth: number;
  avg_response_time_ms: number;
  services: {
    service_id: number;
    name: string;
    category: string;
    price_eth: number;
    endpoint_uri: string;
  }[];
  explorer_url: string;
}

export interface ActivityEvent {
  event_type: string;
  agent_id: number;
  data: Record<string, any>;
  timestamp?: string;
}

// REST API Functions

export async function createAgent(payload: CreateAgentRequest): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create agent');
  }
  return res.json();
}

export async function getAgents(): Promise<AgentResponse[]> {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function setLimits(agentId: number, limits: LimitsPayload): Promise<any> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/limits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(limits),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update limits');
  }
  return res.json();
}

export async function getMarketplace(): Promise<Service[]> {
  const res = await fetch(`${API_BASE}/marketplace`);
  if (!res.ok) throw new Error('Failed to fetch marketplace');
  return res.json();
}

export async function postTask(agentId: number, task: string): Promise<TaskResponse> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId, task }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to execute task');
  }
  return res.json();
}

export async function getWallet(agentId: number): Promise<WalletInfo> {
  const res = await fetch(`${API_BASE}/wallet/${agentId}`);
  if (!res.ok) throw new Error('Failed to fetch wallet');
  return res.json();
}

export async function getPassport(agentId: number): Promise<AgentPassport> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/passport`);
  if (!res.ok) throw new Error('Failed to fetch passport');
  return res.json();
}

export const getAgentPassport = getPassport;

export async function deposit(agentId: number, amountEth: number): Promise<any> {
  const res = await fetch(`${API_BASE}/wallet/${agentId}/deposit?amount_eth=${amountEth}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to deposit funds');
  }
  return res.json();
}

export async function freezeAgent(agentId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/freeze`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to freeze agent');
  }
  return res.json();
}

export async function unfreezeAgent(agentId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/unfreeze`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to unfreeze agent');
  }
  return res.json();
}

export async function approvePending(approvalId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/approvals/${approvalId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: approvalId, action: 'approve' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to approve');
  }
  return res.json();
}

export async function rejectPending(approvalId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/approvals/${approvalId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: approvalId, action: 'reject' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to reject');
  }
  return res.json();
}
