import type { RiskResult } from '../lib/api';

interface AgentGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: RiskResult | null;
  agentName?: string;
  amountEth?: number;
  perTxLimitEth?: number;
  onApprove?: () => void;
  onFreeze?: () => void;
}

export default function AgentGuardModal({
  isOpen,
  onClose,
  result,
  agentName = 'ArbTrader Pro',
  amountEth = 1.2,
  perTxLimitEth = 1.0,
  onApprove,
  onFreeze,
}: AgentGuardModalProps) {
  if (!isOpen || !result) return null;

  const isAllowed = result.decision === 'ALLOW';
  const isReview = result.decision === 'REVIEW';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {isAllowed ? (
        /* ALLOW STATE MATCHING STITCH */
        <div className="glass-modal rounded-xl flex-1 flex flex-col overflow-hidden max-w-[500px] w-full">
          {/* Header */}
          <div className="p-lg border-b border-[#22c55e]/20 bg-[#22c55e]/5 relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#22c55e] to-transparent opacity-50"></div>
            <div className="flex items-center justify-between mb-xs">
              <div className="flex items-center gap-sm">
                <span
                  className="material-symbols-outlined text-[#22c55e]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified_user
                </span>
                <h2 className="font-h2 text-h2 text-on-surface">AgentGuard — DECISION: ALLOW</h2>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">Policy check 5/5 passed</p>
          </div>

          {/* Body */}
          <div className="p-lg flex-1">
            <ul className="space-y-sm">
              {result.checks && result.checks.length > 0 ? (
                result.checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-md">
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        c.passed ? 'text-[#22c55e]' : 'text-error'
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {c.passed ? 'check_circle' : 'cancel'}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">{c.label}</span>
                  </li>
                ))
              ) : (
                <>
                  <li className="flex items-start gap-md">
                    <span
                      className="material-symbols-outlined text-[#22c55e] text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">Agent reputation &gt; 90</span>
                  </li>
                  <li className="flex items-start gap-md">
                    <span
                      className="material-symbols-outlined text-[#22c55e] text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">Recipient trusted</span>
                  </li>
                  <li className="flex items-start gap-md">
                    <span
                      className="material-symbols-outlined text-[#22c55e] text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">Within transaction limit</span>
                  </li>
                  <li className="flex items-start gap-md">
                    <span
                      className="material-symbols-outlined text-[#22c55e] text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">Within daily budget</span>
                  </li>
                  <li className="flex items-start gap-md">
                    <span
                      className="material-symbols-outlined text-[#22c55e] text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">Service matches requested task</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Footer */}
          <div className="p-md bg-[#22c55e]/10 border-t border-[#22c55e]/20 flex items-center justify-center gap-sm">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] pulse-dot"></div>
            <span className="font-label-xs text-label-xs text-[#22c55e] tracking-widest uppercase">
              PAYMENT ALLOWED
            </span>
          </div>
        </div>
      ) : (
        /* BLOCKED / REVIEW STATE MATCHING STITCH */
        <div className="glass-modal rounded-xl flex-1 flex flex-col overflow-hidden max-w-[500px] w-full">
          {/* Header */}
          <div
            className={`p-lg border-b relative ${
              isReview ? 'border-amber-500/20 bg-amber-500/5' : 'border-error/20 bg-error/5'
            }`}
          >
            <div
              className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent ${
                isReview ? 'via-amber-400' : 'via-error'
              } to-transparent opacity-50`}
            ></div>
            <div className="flex items-center justify-between mb-xs">
              <div className="flex items-center gap-sm">
                <span
                  className={`material-symbols-outlined ${isReview ? 'text-amber-400' : 'text-error'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {isReview ? 'gpp_maybe' : 'gpp_bad'}
                </span>
                <h2 className={`font-h2 text-h2 ${isReview ? 'text-amber-400' : 'text-error'}`}>
                  AgentGuard — {isReview ? 'APPROVAL REQUIRED' : 'TRANSACTION BLOCKED'}
                </h2>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {isReview ? `${agentName} spending requires approval.` : `${agentName} execution halted.`}
            </p>

            <div className="mt-md bg-[#050505] border border-error/30 rounded-lg flex flex-col divide-y divide-[#1A1A1F]">
              <div className="p-md flex items-center justify-between">
                <span className="font-label-xs text-label-xs text-error uppercase">Requested Amount</span>
                <span className="font-data-mono text-data-mono text-error">
                  {amountEth ? `${amountEth.toFixed(4)} MON` : '$1,200.00'}
                </span>
              </div>
              <div className="p-md flex items-center justify-between bg-surface-container-lowest/50">
                <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">Transaction Limit</span>
                <span className="font-data-mono text-data-mono text-on-surface-variant">
                  {perTxLimitEth ? `${perTxLimitEth.toFixed(4)} MON` : '$1,000.00'}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-lg flex-1">
            <ul className="space-y-sm">
              {result.checks && result.checks.length > 0 ? (
                result.checks.map((c, i) => (
                  <li key={i} className={`flex items-start gap-md ${c.passed ? 'opacity-50' : ''}`}>
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        c.passed ? 'text-on-surface-variant' : 'text-error'
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {c.passed ? 'check_circle' : 'cancel'}
                    </span>
                    <span
                      className={`font-body-md text-body-md ${
                        c.passed ? 'text-on-surface-variant' : 'text-on-surface'
                      }`}
                    >
                      {c.label}
                    </span>
                  </li>
                ))
              ) : (
                <>
                  <li className="flex items-start gap-md">
                    <span
                      className="material-symbols-outlined text-error text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      cancel
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">Exceeds transaction limit</span>
                  </li>
                  <li className="flex items-start gap-md">
                    <span
                      className="material-symbols-outlined text-error text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      cancel
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">High slippage detected</span>
                  </li>
                  <li className="flex items-start gap-md opacity-50">
                    <span
                      className="material-symbols-outlined text-on-surface-variant text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-body-md text-body-md text-on-surface-variant">Agent verified</span>
                  </li>
                </>
              )}
            </ul>

            {/* Reasons if available */}
            {result.reasons && result.reasons.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-[#0e0e13] border border-outline-variant/30 text-xs text-on-surface-variant">
                <span className="font-label-xs uppercase text-error block mb-1">Defense Violations:</span>
                {result.reasons.map((r, i) => (
                  <p key={i} className="font-body-md text-xs text-on-surface">
                    • {r}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-lg border-t border-[#1A1A1F] flex items-center gap-md bg-surface-container-lowest">
            {isReview && onApprove ? (
              <button
                onClick={onApprove}
                className="flex-1 py-sm px-md rounded-lg font-label-xs text-label-xs text-black bg-amber-400 hover:bg-amber-300 transition-colors font-semibold cursor-pointer"
              >
                APPROVE DISPATCH
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-sm px-md rounded-lg font-label-xs text-label-xs text-on-surface hover:bg-surface-variant/50 transition-colors border border-transparent hover:border-[#1A1A1F] cursor-pointer"
              >
                VIEW DETAILS
              </button>
            )}

            <button
              onClick={() => {
                onFreeze?.();
                onClose();
              }}
              className="flex-1 py-sm px-md rounded-lg font-label-xs text-label-xs text-white bg-error hover:bg-error/90 transition-colors flex items-center justify-center gap-xs shadow-[0_0_15px_rgba(255,180,171,0.2)] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">ac_unit</span>
              FREEZE AGENT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
