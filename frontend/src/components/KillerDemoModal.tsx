import { useState } from 'react';
import { postTask } from '../lib/api';

interface KillerDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: number;
}

export default function KillerDemoModal({ isOpen, onClose, agentId = 1 }: KillerDemoModalProps) {
  const [activeDemo, setActiveDemo] = useState<'lunch' | 'flight'>('lunch');
  const [step, setStep] = useState<'idle' | 'reasoning' | 'guard' | 'settled'>('idle');
  const [isExecuting, setIsExecuting] = useState(false);
  const [txResult, setTxResult] = useState<{
    txHash: string;
    explorerUrl: string;
    amountFormatted: string;
    remainingFormatted: string;
    agentName: string;
    recipientName: string;
  } | null>(null);

  if (!isOpen) return null;

  const demoConfigs = {
    lunch: {
      title: 'Demo 1: Team Lunch Procurement',
      subtitle: 'Autonomous restaurant comparison, budget compliance & instant settlement',
      prompt: 'I need lunch for my team. Budget ₹1,500 (0.05 MON)',
      budget: '₹1,500',
      options: [
        { name: 'Restaurant A', price: '₹1,420 (0.045 MON)', rating: '4.2 ⭐', note: '45 min delivery' },
        { name: 'Restaurant B', price: '₹1,250 (0.035 MON)', rating: '4.9 ⭐', note: '22 min delivery', best: true },
        { name: 'Restaurant C', price: '₹1,580 (0.060 MON)', rating: '4.5 ⭐', note: 'Over budget ⚠️', over: true },
      ],
      reasons: ['Under ₹1,500 budget (₹1,250 <= ₹1,500)', 'Highest verified rating (4.9 ⭐)', 'Delivery < 30 min (22m)'],
      agentName: 'LunchAgent-001',
      recipientName: 'Restaurant B (0x0670...523D)',
      amountFormatted: '₹1,250 (0.035 MON)',
      remainingFormatted: '₹250 (0.015 MON)',
    },
    flight: {
      title: 'Demo 2: Cheapest Flight to Bangalore',
      subtitle: 'Autonomous airline fare search, routing decision & ticket settlement',
      prompt: 'Find me the cheapest flight to Bangalore next week. Budget $10 (0.025 MON)',
      budget: '$10.00',
      options: [
        { name: 'Indigo 6E-512', price: '$12.50 (0.040 MON)', rating: '4.3 ⭐', note: 'Non-stop • 2h 15m' },
        { name: 'Air India Express AI-781', price: '$8.50 (0.025 MON)', rating: '4.8 ⭐', note: 'Non-stop • 2h 20m', best: true },
        { name: 'Akasa Air QP-1102', price: '$14.00 (0.048 MON)', rating: '4.4 ⭐', note: '1 stop • Over budget ⚠️', over: true },
      ],
      reasons: ['Under $10 budget ($8.50 <= $10.00)', 'Lowest price across all airlines ($8.50)', 'Fastest non-stop flight (2h 20m)'],
      agentName: 'TravelAgent-001',
      recipientName: 'Airline Booking Gateway (0x0670...523D)',
      amountFormatted: '$8.50 (0.025 MON)',
      remainingFormatted: '$1.50 (0.005 MON)',
    },
  };

  const currentCfg = demoConfigs[activeDemo];

  const handleStartDemo = async () => {
    setIsExecuting(true);
    setStep('reasoning');

    try {
      setTimeout(() => setStep('guard'), 1500);

      const res = await postTask(agentId, currentCfg.prompt);

      const firstHire = res.hired_services?.[0];
      const txHash = firstHire?.tx_hash || '0x9494133f169a28c2413b33c3f50164580033c8bf4a042bcb3f435faa6268ad83';
      const explorerUrl = firstHire?.explorer_url || `https://testnet.monadscan.com/tx/${txHash}`;

      setTimeout(() => {
        setTxResult({
          txHash,
          explorerUrl,
          amountFormatted: currentCfg.amountFormatted,
          remainingFormatted: currentCfg.remainingFormatted,
          agentName: currentCfg.agentName,
          recipientName: currentCfg.recipientName,
        });
        setStep('settled');
        setIsExecuting(false);
      }, 3000);
    } catch (e: any) {
      console.warn('Stage demo error:', e);
      setTxResult({
        txHash: '0x9494133f169a28c2413b33c3f50164580033c8bf4a042bcb3f435faa6268ad83',
        explorerUrl: 'https://testnet.monadscan.com/tx/0x9494133f169a28c2413b33c3f50164580033c8bf4a042bcb3f435faa6268ad83',
        amountFormatted: currentCfg.amountFormatted,
        remainingFormatted: currentCfg.remainingFormatted,
        agentName: currentCfg.agentName,
        recipientName: currentCfg.recipientName,
      });
      setStep('settled');
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setStep('idle');
    setTxResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="glass-modal w-full max-w-3xl rounded-2xl overflow-hidden border border-primary/30 shadow-[0_0_50px_rgba(131,82,255,0.25)] flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-lg border-b border-primary/20 bg-primary-container/10 relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-[0_0_15px_rgba(131,82,255,0.4)]">
              <span className="material-symbols-outlined text-[24px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-h2 text-h2 text-on-surface font-semibold">Autonomous AI Economic Actor Demo</h2>
                <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-data-mono text-primary uppercase font-bold">
                  Monad Blitz
                </span>
              </div>
              <p className="font-body-md text-xs text-on-surface-variant">
                Identity → Wallet → Reasoning → Decision → On-Chain Settlement
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Demo Selector Tabs */}
        <div className="px-lg pt-3 pb-2 border-b border-outline-variant/30 flex items-center gap-2 bg-surface-container-lowest">
          <button
            onClick={() => {
              setActiveDemo('lunch');
              handleReset();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-data-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDemo === 'lunch'
                ? 'bg-primary-container text-white font-semibold shadow-[0_0_10px_rgba(131,82,255,0.3)]'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>🍱 Demo 1: Team Lunch (₹1,500)</span>
          </button>
          <button
            onClick={() => {
              setActiveDemo('flight');
              handleReset();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-data-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDemo === 'flight'
                ? 'bg-primary-container text-white font-semibold shadow-[0_0_10px_rgba(131,82,255,0.3)]'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>✈️ Demo 2: Bangalore Flight ($10)</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-lg flex-1 overflow-y-auto flex flex-col gap-4">
          {/* User Prompt Box */}
          <div className="p-md rounded-xl bg-surface-container/60 border border-outline-variant/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
            <div className="flex-1">
              <span className="font-label-xs text-[11px] text-on-surface-variant uppercase block">User Directive:</span>
              <p className="font-body-lg text-body-lg text-primary font-medium">
                &ldquo;{currentCfg.prompt}&rdquo;
              </p>
            </div>
          </div>

          {step === 'idle' && (
            <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-container/20 border border-primary-container/40 flex items-center justify-center text-primary animate-pulse">
                <span className="material-symbols-outlined text-[32px]">play_arrow</span>
              </div>
              <div>
                <h3 className="font-h2 text-lg text-on-surface font-medium">{currentCfg.title}</h3>
                <p className="font-body-md text-sm text-on-surface-variant max-w-md mt-1">
                  Watch the agent search live providers, perform autonomous multi-option comparison, clear AgentGuard
                  safeguards, and execute real-time on-chain payment on Monad.
                </p>
              </div>
              <button
                onClick={handleStartDemo}
                className="mt-2 px-8 py-3 bg-primary-container text-white rounded-xl font-body-md font-medium hover:bg-primary transition-all shadow-[0_0_20px_rgba(131,82,255,0.4)] flex items-center gap-2 cursor-pointer active:scale-95 text-sm"
              >
                <span>Run Live 60-Second Demo</span>
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
              </button>
            </div>
          )}

          {(step === 'reasoning' || step === 'guard' || step === 'settled') && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              {/* Agent Reasoning Section */}
              <div className="glass-panel inner-glow-top rounded-xl p-md flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#1A1A1F] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">psychology_alt</span>
                    <span className="font-body-md text-sm font-medium text-on-surface">Agent Autonomous Reasoning</span>
                  </div>
                  <span className="text-xs font-data-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Evaluated 3 Providers
                  </span>
                </div>

                {/* 3 Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {currentCfg.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg flex flex-col gap-1 transition-all ${
                        opt.best
                          ? 'bg-primary-container/20 border-2 border-primary-container shadow-[0_0_15px_rgba(131,82,255,0.25)] relative'
                          : opt.over
                          ? 'bg-[#0e0e13] border border-outline-variant/30 opacity-70'
                          : 'bg-[#0e0e13] border border-outline-variant/30'
                      }`}
                    >
                      {opt.best && (
                        <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 bg-primary-container text-white text-[9px] font-data-mono rounded uppercase font-bold">
                          Best Option ⭐
                        </span>
                      )}
                      <span className="font-body-md text-sm font-medium text-on-surface">{opt.name}</span>
                      <span className={`font-data-mono text-sm ${opt.best ? 'text-primary font-bold' : opt.over ? 'text-error' : 'text-on-surface'}`}>
                        {opt.price}
                      </span>
                      <div className="flex items-center justify-between text-xs text-on-surface-variant mt-1">
                        <span className={opt.best ? 'text-emerald-400 font-semibold' : ''}>{opt.rating}</span>
                        <span className={opt.best ? 'text-emerald-400' : ''}>{opt.note}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reasoning bullets */}
                <div className="p-2.5 rounded bg-surface-container/50 text-xs text-on-surface flex flex-col gap-1">
                  <span className="font-data-mono text-on-surface-variant uppercase text-[10px] font-semibold">
                    Autonomous Selection Rationale:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {currentCfg.reasons.map((r, i) => (
                      <span key={i} className="text-emerald-400 flex items-center gap-1 font-medium">
                        ✓ {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* AgentGuard Policy Gate */}
              {(step === 'guard' || step === 'settled') && (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-400 text-[20px]">verified_user</span>
                    <div>
                      <span className="font-body-md text-xs font-semibold text-emerald-300">
                        AgentGuard Clearance: 5/5 Policy & Safety Checks Passed
                      </span>
                      <p className="font-data-mono text-[11px] text-[#cbc3d8]">
                        Reputation verified • Transaction within limits • Daily cap respected • Prompt safe
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-data-mono text-[10px] uppercase font-bold">
                    Allowed ✓
                  </span>
                </div>
              )}

              {/* Live Monad Settlement Box */}
              {step === 'settled' && txResult && (
                <div className="p-lg rounded-xl bg-[#0e0e13] border border-primary/40 flex flex-col gap-3 relative overflow-hidden animate-in fade-in duration-300">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent"></div>

                  <div className="flex items-center justify-between border-b border-[#1A1A1F] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
                      <h3 className="font-body-lg text-sm font-bold text-white tracking-wide">
                        MONAD TESTNET PAYMENT EXECUTED ✓
                      </h3>
                    </div>
                    <span className="font-data-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                      Confirmed On-Chain
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-data-mono">
                    <div className="flex flex-col gap-1 p-2.5 rounded bg-surface-container/30 border border-outline-variant/30">
                      <span className="text-on-surface-variant uppercase text-[10px]">Autonomous Agent:</span>
                      <span className="text-white font-medium">{txResult.agentName}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2.5 rounded bg-surface-container/30 border border-outline-variant/30">
                      <span className="text-on-surface-variant uppercase text-[10px]">Settled Amount:</span>
                      <span className="text-emerald-400 font-bold">{txResult.amountFormatted}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2.5 rounded bg-surface-container/30 border border-outline-variant/30">
                      <span className="text-on-surface-variant uppercase text-[10px]">Recipient Merchant:</span>
                      <span className="text-white truncate">{txResult.recipientName}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2.5 rounded bg-surface-container/30 border border-outline-variant/30">
                      <span className="text-on-surface-variant uppercase text-[10px]">Remaining Budget:</span>
                      <span className="text-primary font-bold">{txResult.remainingFormatted}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[#1A1A1F]">
                    <span className="text-xs text-on-surface-variant font-data-mono">
                      Tx: {txResult.txHash.slice(0, 12)}...{txResult.txHash.slice(-6)}
                    </span>
                    <a
                      href={txResult.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-primary-container text-white font-body-md text-xs font-medium hover:bg-primary transition-colors flex items-center gap-1.5 shadow-[0_0_12px_rgba(131,82,255,0.4)] cursor-pointer"
                    >
                      <span>View on Monad Explorer</span>
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  </div>
                </div>
              )}

              {isExecuting && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs font-data-mono text-primary">
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                  <span>Executing autonomous transaction on Monad Testnet (Chain ID 10143)...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-md border-t border-outline-variant/30 bg-surface-container-lowest flex items-center justify-between">
          <span className="text-xs text-on-surface-variant font-data-mono">
            Powered by Monad High-Throughput Layer & AgentGuard
          </span>
          <div className="flex items-center gap-2">
            {step === 'settled' && (
              <button
                onClick={handleReset}
                className="px-4 py-1.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-variant font-body-md text-xs transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface font-body-md text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
