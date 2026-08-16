import { useEffect, useState } from 'react';
import type { AgentResponse, WalletInfo } from '../lib/api';
import { getAgents, getWallet, setLimits } from '../lib/api';

export default function Wallet() {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(1);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit limits state
  const [isEditing, setIsEditing] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('2.0');
  const [perTxLimit, setPerTxLimit] = useState('0.5');
  const [approvalThreshold, setApprovalThreshold] = useState('0.2');
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    setLoading(true);
    getWallet(selectedAgentId)
      .then((w) => {
        setWallet(w);
        setDailyLimit(w.daily_limit_eth.toString());
        setPerTxLimit(w.per_tx_limit_eth.toString());
        setApprovalThreshold(w.approval_threshold_eth.toString());
      })
      .catch((e) => console.warn('Error fetching wallet:', e))
      .finally(() => setLoading(false));
  }, [selectedAgentId]);

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setLimits(selectedAgentId, {
        daily_limit_eth: parseFloat(dailyLimit) || 0,
        per_tx_limit_eth: parseFloat(perTxLimit) || 0,
        approval_threshold_eth: parseFloat(approvalThreshold) || 0,
      });
      setSaveSuccess(true);
      setIsEditing(false);
      getWallet(selectedAgentId).then(setWallet);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to update limits: ${err.message}`);
    }
  };

  const spentToday = wallet?.spent_today_eth || 0;
  const dLimit = wallet?.daily_limit_eth || 2.0;
  const spentPercent = dLimit > 0 ? Math.min(100, Math.round((spentToday / dLimit) * 100)) : 0;

  return (
    <>
      {/* Background Ambient Glows */}
      <div className="glow-violet top-0 left-[240px]"></div>
      <div
        className="glow-violet bottom-0 right-0"
        style={{
          background: 'radial-gradient(circle, rgba(206, 189, 255, 0.1) 0%, rgba(19, 19, 24, 0) 70%)',
        }}
      ></div>

      <main className="pt-[80px] md:pl-[264px] pr-lg pb-xl max-w-[1600px] mx-auto w-full min-h-screen relative z-10">
        {/* Top Header */}
        <header className="mb-xl flex justify-between items-end">
          <div>
            <h2 className="font-h2 text-h2 text-on-surface mb-xs font-semibold">Agent Wallet</h2>
            <p className="text-on-surface-variant font-body-md text-body-md">
              Real-time asset management and operational spending limits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Agent Selector */}
            {agents.length > 1 && (
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                className="bg-surface-container border border-outline-variant rounded py-sm px-md text-on-surface font-body-md text-sm focus:outline-none focus:border-primary-container"
              >
                {agents.map((a) => (
                  <option key={a.agent_id} value={a.agent_id}>
                    {a.name} (ID #{a.agent_id})
                  </option>
                ))}
              </select>
            )}

            <a
              href="https://testnet.monadscan.com/address/0xe56F41956b9A255edF1FDeB11c8867638C92c86d"
              target="_blank"
              rel="noreferrer"
              className="bg-primary-container hover:bg-inverse-primary text-on-primary-container font-body-md text-body-md py-sm px-md rounded transition-colors duration-200 flex items-center gap-sm cursor-pointer text-sm font-medium shadow-[0_0_15px_rgba(131,82,255,0.25)]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Deposit Funds
            </a>
          </div>
        </header>

        {saveSuccess && (
          <div className="mb-lg p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-sm font-data-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            On-chain spending limits updated successfully.
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
          {/* Left Column: Balance & Limits */}
          <div className="lg:col-span-4 flex flex-col gap-lg">
            {/* Main Balance Card */}
            <div className="infra-card rounded-lg p-lg">
              <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider mb-sm block">
                Total Available Balance
              </span>
              <div className="font-display text-display text-on-surface font-bold tracking-tighter mb-md">
                {loading ? '$12,450.00' : `${wallet?.balance_eth.toFixed(3)} MON`}
              </div>
              <div className="flex gap-sm">
                <span className="inline-flex items-center gap-xs px-xs py-[2px] rounded-full bg-surface-variant border border-outline-variant font-data-mono text-label-xs text-on-surface">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Live
                </span>
                <span className="inline-flex items-center gap-xs px-xs py-[2px] rounded-full bg-surface-variant border border-outline-variant font-data-mono text-label-xs text-on-surface">
                  MONAD TESTNET
                </span>
              </div>
            </div>

            {/* Limits Panel */}
            <div className="glass-panel rounded-lg p-lg">
              <div className="flex items-center justify-between mb-md pb-sm border-b border-outline-variant">
                <h3 className="font-h2 text-h2 text-on-surface">Operational Limits</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-data-mono text-primary hover:underline cursor-pointer"
                >
                  {isEditing ? 'Cancel' : 'Edit Limits'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveLimits} className="flex flex-col gap-4">
                  <div>
                    <label className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider block mb-1">
                      Daily Spending Limit (MON)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(e.target.value)}
                      className="w-full font-data-mono text-sm text-on-surface bg-surface border border-outline-variant rounded p-2 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider block mb-1">
                      Max Per-Transaction Limit (MON)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={perTxLimit}
                      onChange={(e) => setPerTxLimit(e.target.value)}
                      className="w-full font-data-mono text-sm text-on-surface bg-surface border border-outline-variant rounded p-2 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider block mb-1">
                      Human Approval Threshold (MON)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={approvalThreshold}
                      onChange={(e) => setApprovalThreshold(e.target.value)}
                      className="w-full font-data-mono text-sm text-on-surface bg-surface border border-outline-variant rounded p-2 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-primary-container text-white rounded font-body-md text-sm font-medium hover:bg-primary transition-colors cursor-pointer"
                  >
                    Save On-Chain Limits
                  </button>
                </form>
              ) : (
                <>
                  {/* Daily Spend */}
                  <div className="mb-lg">
                    <div className="flex justify-between items-end mb-xs">
                      <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider block">
                        Daily Spend Limit
                      </span>
                      <span className="font-data-mono text-data-mono text-on-surface block">
                        <span className="text-primary">{spentToday.toFixed(3)} MON</span> / {dLimit.toFixed(3)} MON
                      </span>
                    </div>
                    <div className="w-full bg-surface-variant rounded-full h-1.5 mb-xs overflow-hidden">
                      <div
                        className="bg-primary-container h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${spentPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between font-label-xs text-label-xs text-on-surface-variant">
                      <span>{spentPercent}% Used</span>
                      <span>Resets 24h</span>
                    </div>
                  </div>

                  {/* Per Tx Limit */}
                  <div className="mb-md">
                    <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider mb-xs block">
                      Max Per-Transaction
                    </span>
                    <div className="font-data-mono text-data-mono text-on-surface bg-surface border border-outline-variant rounded p-sm flex items-center justify-between">
                      <span>{(wallet?.per_tx_limit_eth || 0.5).toFixed(3)} MON</span>
                      <button onClick={() => setIsEditing(true)} className="text-on-surface-variant hover:text-primary cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                    </div>
                  </div>

                  {/* Approval Threshold */}
                  <div>
                    <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider mb-xs block">
                      Human Approval Threshold
                    </span>
                    <div className="font-data-mono text-data-mono text-on-surface bg-surface border border-outline-variant rounded p-sm flex items-center justify-between">
                      <span>{(wallet?.approval_threshold_eth || 0.2).toFixed(3)} MON</span>
                      <span className="text-xs text-amber-400 font-data-mono">Review Flag</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Transactions */}
          <div className="lg:col-span-8">
            <div className="glass-panel rounded-lg p-lg h-full">
              <div className="flex justify-between items-center mb-lg pb-sm border-b border-outline-variant">
                <h3 className="font-h2 text-h2 text-on-surface">Recent Activity</h3>
                <a
                  href="https://testnet.monadscan.com/address/0xe56F41956b9A255edF1FDeB11c8867638C92c86d"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:text-inverse-primary font-body-md text-body-md transition-colors flex items-center gap-xs text-sm"
                >
                  View All on Monad
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </a>
              </div>

              <div className="flex flex-col gap-xs">
                {wallet && wallet.transactions && wallet.transactions.length > 0 ? (
                  wallet.transactions.map((tx, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-md px-sm hover:bg-surface-variant/30 transition-colors rounded border-b border-outline-variant/50 last:border-0 group cursor-pointer"
                    >
                      <div className="flex items-center gap-md">
                        <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-primary">arrow_outward</span>
                        </div>
                        <div>
                          <div className="font-body-md text-body-md text-on-surface font-medium">
                            {tx.reason || 'Specialist Agent Payment'}
                          </div>
                          <div className="font-data-mono text-label-xs text-on-surface-variant">
                            To: {tx.to ? `${tx.to.slice(0, 8)}...${tx.to.slice(-6)}` : 'Specialist Agent'} •{' '}
                            {tx.created_at || 'Recently'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-data-mono text-data-mono text-on-surface font-bold">
                          -{tx.amount_eth.toFixed(4)} MON
                        </div>
                        <div className="font-label-xs text-label-xs text-[#4ade80] flex items-center justify-end gap-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
                          Confirmed
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {/* Default Activity Rows matching Stitch */}
                    <div className="flex items-center justify-between py-md px-sm hover:bg-surface-variant/30 transition-colors rounded border-b border-outline-variant/50 last:border-0 group cursor-pointer">
                      <div className="flex items-center gap-md">
                        <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-primary">arrow_outward</span>
                        </div>
                        <div>
                          <div className="font-body-md text-body-md text-on-surface font-medium">
                            Payment to FlightFinder
                          </div>
                          <div className="font-data-mono text-label-xs text-on-surface-variant">
                            To: 0x71C...3921 • Today, 14:22
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-data-mono text-data-mono text-on-surface font-bold">-0.0500 MON</div>
                        <div className="font-label-xs text-label-xs text-[#4ade80] flex items-center justify-end gap-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
                          Confirmed
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-md px-sm hover:bg-surface-variant/30 transition-colors rounded border-b border-outline-variant/50 last:border-0 group cursor-pointer">
                      <div className="flex items-center gap-md">
                        <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-primary">arrow_outward</span>
                        </div>
                        <div>
                          <div className="font-body-md text-body-md text-on-surface font-medium">
                            Payment to HotelFinder
                          </div>
                          <div className="font-data-mono text-label-xs text-on-surface-variant">
                            To: 0x82A...1104 • Today, 14:23
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-data-mono text-data-mono text-on-surface font-bold">-0.0800 MON</div>
                        <div className="font-label-xs text-label-xs text-[#4ade80] flex items-center justify-end gap-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
                          Confirmed
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-md px-sm hover:bg-surface-variant/30 transition-colors rounded border-b border-outline-variant/50 last:border-0 group cursor-pointer">
                      <div className="flex items-center gap-md">
                        <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-primary">arrow_outward</span>
                        </div>
                        <div>
                          <div className="font-body-md text-body-md text-on-surface font-medium">
                            Payment to ActivityFinder
                          </div>
                          <div className="font-data-mono text-label-xs text-on-surface-variant">
                            To: 0x93F...8820 • Today, 14:24
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-data-mono text-data-mono text-on-surface font-bold">-0.0400 MON</div>
                        <div className="font-label-xs text-label-xs text-[#4ade80] flex items-center justify-end gap-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
                          Confirmed
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
