import { useEffect, useState } from 'react';
import type { AgentPassport, AgentResponse } from '../lib/api';
import { getAgentPassport, getAgents } from '../lib/api';

export default function AgentPassportPage() {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(1);
  const [passport, setPassport] = useState<AgentPassport | null>(null);

  useEffect(() => {
    getAgents()
      .then((data) => {
        if (data && data.length > 0) {
          setAgents(data);
          if (!data.some((a) => a.agent_id === selectedAgentId)) {
            setSelectedAgentId(data[0].agent_id);
          }
        }
      })
      .catch((e) => console.warn('Error loading agents:', e));
  }, []);

  useEffect(() => {
    getAgentPassport(selectedAgentId)
      .then(setPassport)
      .catch((e: unknown) => console.warn('Error loading passport:', e));
  }, [selectedAgentId]);

  const repScore = passport?.reputation_score || 98;
  const strokeDashoffset = 283 - (repScore / 100) * 283;

  return (
    <main className="flex-1 w-full md:ml-[240px] pt-24 pb-margin px-md md:px-margin max-w-7xl mx-auto flex flex-col gap-margin">
      {/* Header / Identity Section */}
      <section className="glass-panel inner-glow-top rounded-xl p-lg md:p-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-lg relative overflow-hidden">
        {/* Subtle background accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="flex items-center gap-lg w-full md:w-auto">
          {/* Visual Trust Score */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="45" stroke="#1A1A1F" strokeWidth="6"></circle>
              <circle
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="#8352FF"
                strokeLinecap="round"
                strokeWidth="6"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-h2 font-bold text-on-surface">{repScore}</span>
              <span className="font-label-xs text-on-surface-variant">TRUST</span>
            </div>
          </div>

          {/* Agent Details */}
          <div className="flex flex-col gap-xs">
            <div className="flex items-center gap-sm">
              <h2 className="font-display text-h1 text-on-surface font-semibold">{passport?.name || 'ArbTrader Pro'}</h2>
              <span className="px-sm py-xs bg-[#121217] border border-outline-variant/50 rounded-full font-label-xs text-primary flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Verified
              </span>
            </div>
            <p className="font-body-md text-on-surface-variant">
              {passport?.description || 'DeFi Arbitrage Specialist'}
            </p>
            <div className="flex items-center gap-sm mt-sm">
              <span className="font-data-mono text-on-surface-variant text-sm bg-[#050505] px-sm py-xs border border-[#1A1A1F] rounded flex items-center gap-xs">
                {passport?.wallet_address
                  ? `${passport.wallet_address.slice(0, 8)}...${passport.wallet_address.slice(-4)}`
                  : '0x71C...3921'}
                <button
                  onClick={() => navigator.clipboard?.writeText(passport?.wallet_address || '0x71C...3921')}
                  className="text-outline hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </button>
              </span>

              {agents.length > 1 && (
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                  className="bg-[#050505] border border-[#1A1A1F] text-xs font-data-mono text-primary rounded px-2 py-1 focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.agent_id} value={a.agent_id}>
                      Switch Agent: {a.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="w-full md:w-auto flex justify-end">
          <a
            href={
              passport?.explorer_url ||
              'https://testnet.monadscan.com/address/0xca932D4bd5e97771b8297AFe7518D85E509Efcd3'
            }
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-sm px-lg py-sm bg-transparent border border-[#1A1A1F] text-on-surface rounded-lg hover:border-primary-container/50 hover:shadow-[0_0_15px_rgba(131,82,255,0.15)] transition-all group font-body-md"
          >
            <span>View on Monad</span>
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
              open_in_new
            </span>
          </a>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        <div className="glass-panel inner-glow-top rounded-xl p-lg flex flex-col gap-sm">
          <span className="font-label-xs text-on-surface-variant uppercase tracking-wider">Jobs Completed</span>
          <span className="font-data-mono text-h2 text-on-surface">
            {passport?.jobs_completed ? passport.jobs_completed.toLocaleString() : '42,805'}
          </span>
          <div className="h-1 w-full bg-[#1A1A1F] rounded-full mt-auto overflow-hidden">
            <div className="h-full bg-primary-container w-[85%] rounded-full"></div>
          </div>
        </div>

        <div className="glass-panel inner-glow-top rounded-xl p-lg flex flex-col gap-sm">
          <span className="font-label-xs text-on-surface-variant uppercase tracking-wider">Success Rate</span>
          <span className="font-data-mono text-h2 text-on-surface">
            {passport ? `${passport.success_rate}%` : '99.4%'}
          </span>
          <span className="font-label-xs text-[#ffb4ab] mt-auto">0.6% Revert Rate</span>
        </div>

        <div className="glass-panel inner-glow-top rounded-xl p-lg flex flex-col gap-sm">
          <span className="font-label-xs text-on-surface-variant uppercase tracking-wider">Total Earned</span>
          <span className="font-data-mono text-h2 text-on-surface text-primary-fixed-dim">
            {passport ? `${passport.total_earned_eth.toFixed(3)} MON` : '$124,500'}
          </span>
          <span className="font-label-xs text-on-surface-variant mt-auto">Last 30 Days: +$12k</span>
        </div>

        <div className="glass-panel inner-glow-top rounded-xl p-lg flex flex-col gap-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-container/10 via-transparent to-transparent pointer-events-none"></div>
          <span className="font-label-xs text-on-surface-variant uppercase tracking-wider">Avg. Response Time</span>
          <span className="font-data-mono text-h2 text-on-surface">
            {passport?.avg_response_time_ms ? `${(passport.avg_response_time_ms / 1000).toFixed(1)}s` : '1.2s'}
          </span>
          <div className="mt-auto flex items-center gap-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8352FF] animate-ping"></span>
            <span className="font-label-xs text-on-surface-variant">Live Network Ping</span>
          </div>
        </div>
      </section>

      {/* Services Capabilities */}
      <section className="glass-panel inner-glow-top rounded-xl p-lg md:p-xl flex flex-col gap-lg">
        <div className="flex items-center justify-between border-b border-[#1A1A1F] pb-md">
          <h3 className="font-body-lg font-medium text-on-surface flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary-container">memory</span>
            Capabilities & Pricing
          </h3>
        </div>

        <div className="flex flex-col">
          {/* Service Item 1 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-md border-b border-[#1A1A1F] gap-sm hover:bg-[#121217] transition-colors -mx-lg px-lg">
            <div className="flex flex-col">
              <span className="font-body-md text-on-surface font-medium">DEX Swap Optimization</span>
              <span className="font-label-xs text-on-surface-variant">
                Multi-hop routing across Uniswap, Curve, Balancer
              </span>
            </div>
            <div className="flex items-center gap-md">
              <span className="font-data-mono text-on-surface bg-[#050505] px-sm py-xs rounded border border-[#1A1A1F]">
                $0.05 / tx
              </span>
              <button className="text-primary-container hover:text-primary transition-colors cursor-pointer">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Service Item 2 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-md border-b border-[#1A1A1F] gap-sm hover:bg-[#121217] transition-colors -mx-lg px-lg">
            <div className="flex flex-col">
              <span className="font-body-md text-on-surface font-medium">Liquidity Provisioning</span>
              <span className="font-label-xs text-on-surface-variant">
                Automated rebalancing of concentrated liquidity positions
              </span>
            </div>
            <div className="flex items-center gap-md">
              <span className="font-data-mono text-on-surface bg-[#050505] px-sm py-xs rounded border border-[#1A1A1F]">
                $0.10 / position
              </span>
              <button className="text-primary-container hover:text-primary transition-colors cursor-pointer">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Service Item 3 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-md border-b border-[#1A1A1F] gap-sm hover:bg-[#121217] transition-colors -mx-lg px-lg">
            <div className="flex flex-col">
              <span className="font-body-md text-on-surface font-medium">Flashloan Execution</span>
              <span className="font-label-xs text-on-surface-variant">
                Atomic arbitrage execution with Aave/Balancer flashloans
              </span>
            </div>
            <div className="flex items-center gap-md">
              <span className="font-data-mono text-on-surface bg-[#050505] px-sm py-xs rounded border border-[#1A1A1F]">
                0.1% / profit
              </span>
              <button className="text-primary-container hover:text-primary transition-colors cursor-pointer">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
