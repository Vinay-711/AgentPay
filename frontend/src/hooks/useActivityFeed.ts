import { useEffect, useState, useCallback, useRef } from 'react';
import { WS_BASE } from '../lib/api';
import type { ActivityEvent, RiskResult } from '../lib/api';

export interface ActivityCardItem {
  id: string;
  type: string;
  title: string;
  desc: string;
  time: string;
  amount?: string;
  txHash?: string;
  explorerUrl?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  rawEvent?: ActivityEvent;
}

export function useActivityFeed(agentId: number = 1) {
  const [activities, setActivities] = useState<ActivityCardItem[]>([]);
  const [latestAgentGuardResult, setLatestAgentGuardResult] = useState<RiskResult | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  const formatEventToCard = (event: ActivityEvent): ActivityCardItem => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const data = event.data || {};

    let title = 'Agent Activity';
    let desc = data.message || `Event: ${event.event_type}`;
    let icon = 'task_alt';
    let iconBg = 'bg-[#1f1f25] border-[#494455]/40';
    let iconColor = 'text-[#cbc3d8]';
    let txHash: string | undefined = undefined;
    let explorerUrl: string | undefined = data.explorer_url;

    if (data.tx_hash) {
      txHash = `${data.tx_hash.slice(0, 6)}...${data.tx_hash.slice(-4)}`;
    }

    switch (event.event_type) {
      case 'agentguard_result':
      case 'agentguard_check': {
        const decision = data.decision || (data.result && data.result.decision);
        if (decision === 'ALLOW') {
          title = 'AgentGuard Approved';
          desc = `Verified: ${data.reasons?.join(', ') || 'All 5 security checks passed on Monad'}`;
          icon = 'verified_user';
          iconBg = 'bg-emerald-500/10 border-emerald-500/20';
          iconColor = 'text-emerald-400';
        } else if (decision === 'REVIEW') {
          title = 'AgentGuard Review Flag';
          desc = `Approval needed: ${data.reasons?.join(', ') || 'Amount exceeds automated threshold'}`;
          icon = 'gpp_maybe';
          iconBg = 'bg-amber-500/10 border-amber-500/20';
          iconColor = 'text-amber-400';
        } else {
          title = 'AgentGuard Blocked';
          desc = `Violations: ${data.reasons?.join(', ') || 'Security policy triggered'}`;
          icon = 'gpp_bad';
          iconBg = 'bg-red-500/10 border-red-500/20';
          iconColor = 'text-red-400';
        }

        if (data.result) {
          setLatestAgentGuardResult(data.result);
        } else if (data.checks) {
          setLatestAgentGuardResult({
            decision: data.decision,
            reasons: data.reasons || [],
            checks: data.checks || [],
          });
        }
        break;
      }
      case 'payment_sent':
      case 'payment_confirmed': {
        title = 'Paid On-Chain Service';
        desc = `Hired ${data.service_name || 'Service'} for ${data.amount_eth || 0} ETH`;
        icon = 'payments';
        iconBg = 'bg-[#8352ff]/15 border-[#8352ff]/30';
        iconColor = 'text-[#cebdff]';
        break;
      }
      case 'agent_hired': {
        title = 'Specialist Hired';
        desc = `${data.service_name || 'Service'} accepted as job #${data.job_id || '—'}`;
        icon = 'handshake';
        iconBg = 'bg-[#8352ff]/15 border-[#8352ff]/30';
        iconColor = 'text-[#cebdff]';
        break;
      }
      case 'discovery':
      case 'service_discovered': {
        title = 'Discovered Service';
        desc = `Found ${data.service_name || 'Specialist Agent'} in Marketplace`;
        icon = 'search';
        iconBg = 'bg-[#1f1f25] border-[#494455]/40';
        iconColor = 'text-[#cbc3d8]';
        break;
      }
      case 'job_completed': {
        title = 'Job Completed';
        desc = `Result verified and recorded on Monad${data.reputation_score ? ` · reputation ${data.reputation_score}` : ''}`;
        icon = 'check_circle';
        iconBg = 'bg-emerald-500/10 border-emerald-500/20';
        iconColor = 'text-emerald-400';
        break;
      }
      case 'worker_result_received': {
        title = 'Worker Result Received';
        desc = data.result_summary || 'Specialist returned its deliverable';
        icon = 'assignment_turned_in';
        iconBg = 'bg-sky-500/10 border-sky-500/20';
        iconColor = 'text-sky-400';
        break;
      }
      case 'reputation_updated': {
        title = 'Reputation Updated';
        desc = `On-chain score: ${data.reputation_score ?? '—'} · completed jobs: ${data.jobs_completed ?? '—'}`;
        icon = 'military_tech';
        iconBg = 'bg-emerald-500/10 border-emerald-500/20';
        iconColor = 'text-emerald-400';
        break;
      }
      case 'limits_updated': {
        title = 'Limits Configured';
        desc = data.message || 'Updated on-chain daily and transaction caps';
        icon = 'tune';
        iconBg = 'bg-[#8352ff]/10 border-[#8352ff]/20';
        iconColor = 'text-[#cebdff]';
        break;
      }
      case 'emergency_freeze': {
        title = 'Agent Frozen';
        desc = 'Agent wallet locked via emergencyFreeze on Monad';
        icon = 'ac_unit';
        iconBg = 'bg-red-500/15 border-red-500/30';
        iconColor = 'text-red-400';
        break;
      }
      default: {
        title = data.service_name ? `Service: ${data.service_name}` : 'Orchestration Step';
        desc = data.message || `Processed ${event.event_type}`;
      }
    }

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: event.event_type,
      title,
      desc,
      time: timestamp,
      amount: data.amount_eth ? `${data.amount_eth} ETH` : undefined,
      txHash,
      explorerUrl,
      icon,
      iconBg,
      iconColor,
      rawEvent: event,
    };
  };

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const url = `${WS_BASE}/activity/${agentId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) setIsConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const event: ActivityEvent = JSON.parse(msg.data);
          const card = formatEventToCard(event);
          setActivities((prev) => [card, ...prev.slice(0, 30)]);
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setIsConnected(false);
          // Auto reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [agentId]);

  return {
    activities,
    latestAgentGuardResult,
    isConnected,
    clearActivities,
    setLatestAgentGuardResult,
  };
}
