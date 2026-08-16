import { useEffect } from 'react';
import { CONTRACT_ADDRESS, EXPLORER_URL } from '../config';
import type { AgentData } from '../walletClient';

interface AgentPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentData | null;
  sessionTxCount: number;
  sessionTotalSettled: number;
  completedTasks: string[];
}

export default function AgentPassportModal({
  isOpen,
  onClose,
  agent,
  sessionTxCount,
  sessionTotalSettled,
  completedTasks,
}: AgentPassportModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const agentId = `MONAD-AGT-10143-${String(agent?.reputation || 94).padStart(4, '0')}`;
  const address = agent?.address || '0xe56F41956b9A255edF1FDeB11c8867638C92c86d';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      {/* Holographic Passport Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          background: 'linear-gradient(145deg, #130e26 0%, #090714 50%, #160b2e 100%)',
          boxShadow: '0 0 80px rgba(131, 82, 255, 0.5), 0 0 120px rgba(131, 82, 255, 0.2)',
          border: '2px solid rgba(131, 82, 255, 0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Holographic Top Banner Strip */}
        <div
          style={{
            padding: '20px 24px',
            background: 'linear-gradient(90deg, rgba(131, 82, 255, 0.3) 0%, rgba(206, 189, 255, 0.15) 50%, rgba(131, 82, 255, 0.3) 100%)',
            borderBottom: '1px solid rgba(131, 82, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: '#8352ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 0 20px rgba(131, 82, 255, 0.6)',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>badge</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Agent Passport
                </h2>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  ERC-8004 Verified
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'monospace' }}>
                Monad Trustless Agent Identity Registry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Passport Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Info Grid with Holographic Avatar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Avatar Hologram */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #8352ff 0%, #cebdff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                boxShadow: '0 0 25px rgba(131, 82, 255, 0.5)',
                flexShrink: 0,
                border: '2px solid #ffffff',
                position: 'relative',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>smart_toy</span>
              <span
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  right: '-4px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '9999px',
                  backgroundColor: '#34d399',
                  border: '2px solid #000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  color: '#000000',
                  fontWeight: 'bold',
                }}
              >
                ✓
              </span>
            </div>

            {/* Details */}
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '10px',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              <div>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Agent Name</span>
                <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}>TravelAgent</span>
              </div>
              <div>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Passport ID</span>
                <span style={{ color: '#cebdff', fontWeight: 'bold' }}>{agentId}</span>
              </div>
              <div>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Chain ID</span>
                <span style={{ color: '#34d399', fontWeight: 'bold' }}>10143 (Monad Testnet)</span>
              </div>
              <div>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Trust Score</span>
                <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '13px' }}>
                  {agent?.reputation || 94} / 100 <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>(Tier 1)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ padding: '12px 8px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', display: 'block' }}>Total Settled</span>
              <span style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'monospace', color: '#ffffff', marginTop: '2px', display: 'block' }}>
                ${((agent?.spent || 0) + sessionTotalSettled).toFixed(2)}
              </span>
            </div>
            <div style={{ padding: '12px 8px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', display: 'block' }}>Settled Txns</span>
              <span style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'monospace', color: '#cebdff', marginTop: '2px', display: 'block' }}>
                {sessionTxCount + 1} Txns
              </span>
            </div>
            <div style={{ padding: '12px 8px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', display: 'block' }}>Dispute Rate</span>
              <span style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'monospace', color: '#34d399', marginTop: '2px', display: 'block' }}>0.00%</span>
            </div>
          </div>

          {/* On-Chain Passport Task Stamps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#cebdff' }}>approval_delegation</span>
              On-Chain Visa &amp; Task Stamps
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {/* Stamp 1: Monad Genesis */}
              <div
                style={{
                  padding: '10px 6px',
                  borderRadius: '12px',
                  border: '1px solid rgba(131, 82, 255, 0.5)',
                  backgroundColor: 'rgba(131, 82, 255, 0.12)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  transform: 'rotate(-1deg)',
                  boxShadow: '0 0 10px rgba(131, 82, 255, 0.2)',
                }}
              >
                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#34d399', fontWeight: 'bold', textTransform: 'uppercase' }}>MONAD GENESIS</span>
                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.8)' }}>REGISTERED</span>
                <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#cebdff' }}>BLOCK #54198000</span>
              </div>

              {/* Stamp 2: Goa Stamp */}
              <div
                style={{
                  padding: '10px 6px',
                  borderRadius: '12px',
                  border: completedTasks.some((t) => t.toLowerCase().includes('goa'))
                    ? '1px solid rgba(16, 185, 129, 0.6)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: completedTasks.some((t) => t.toLowerCase().includes('goa'))
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(255, 255, 255, 0.02)',
                  color: completedTasks.some((t) => t.toLowerCase().includes('goa'))
                    ? '#6ee7b7'
                    : 'rgba(255, 255, 255, 0.3)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  transform: 'rotate(2deg)',
                  boxShadow: completedTasks.some((t) => t.toLowerCase().includes('goa'))
                    ? '0 0 15px rgba(16, 185, 129, 0.25)'
                    : 'none',
                }}
              >
                <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase' }}>🏖️ GOA RETREAT</span>
                <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>
                  {completedTasks.some((t) => t.toLowerCase().includes('goa')) ? 'HOTEL CONFIRMED ✓' : 'READY TO BOOK'}
                </span>
                <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.4)' }}>CHAIN 10143</span>
              </div>

              {/* Stamp 3: Dubai Stamp */}
              <div
                style={{
                  padding: '10px 6px',
                  borderRadius: '12px',
                  border: completedTasks.some((t) => t.toLowerCase().includes('dubai'))
                    ? '1px solid rgba(131, 82, 255, 0.6)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: completedTasks.some((t) => t.toLowerCase().includes('dubai'))
                    ? 'rgba(131, 82, 255, 0.18)'
                    : 'rgba(255, 255, 255, 0.02)',
                  color: completedTasks.some((t) => t.toLowerCase().includes('dubai'))
                    ? '#cebdff'
                    : 'rgba(255, 255, 255, 0.3)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  transform: 'rotate(-2deg)',
                  boxShadow: completedTasks.some((t) => t.toLowerCase().includes('dubai'))
                    ? '0 0 15px rgba(131, 82, 255, 0.3)'
                    : 'none',
                }}
              >
                <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase' }}>✈️ DUBAI 3-DAY</span>
                <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>
                  {completedTasks.some((t) => t.toLowerCase().includes('dubai')) ? 'PARALLEL SETTLED ✓' : 'SPEED READY'}
                </span>
                <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.4)' }}>10,000 TPS</span>
              </div>
            </div>
          </div>

          {/* Cryptographic Attestation Footer */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#34d399', display: 'inline-block' }}></span>
              <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Wallet: {address.slice(0, 6)}...{address.slice(-4)}</span>
            </div>
            <a
              href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#cebdff', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Verify On-Chain</span>
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
