import { useMemo } from 'react';
import type { SpecialistAgent } from '../config';
import type { PlannedHire } from '../orchestrator';

interface AgentNodeGraphProps {
  agentName?: string;
  plannedHires: PlannedHire[];
  approvedAgents: SpecialistAgent[];
  deniedAgents: SpecialistAgent[];
  currentHireIndex: number;
  riskyBlocked?: boolean;
}

export default function AgentNodeGraph({
  agentName = 'TravelAgent',
  plannedHires,
  approvedAgents,
  deniedAgents,
  currentHireIndex,
  riskyBlocked = false,
}: AgentNodeGraphProps) {
  const width = 640;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 115;

  // Calculate static node positions arranged around the center
  const nodes = useMemo(() => {
    if (riskyBlocked) {
      return [
        {
          id: 'risky-target',
          name: 'Unknown Recipient',
          priceUsd: '$8.50',
          x: centerX + radius,
          y: centerY,
          status: 'denied' as const,
          reason: 'Blocked by AgentGuard',
        },
      ];
    }

    if (plannedHires.length === 0) {
      return [];
    }

    const total = plannedHires.length;
    return plannedHires.map((hire, i) => {
      // Symmetrically distribute around the center
      const angle = total === 1 ? -Math.PI / 2 : (i * (2 * Math.PI)) / total - Math.PI / 2;
      const x = Math.round(centerX + radius * Math.cos(angle));
      const y = Math.round(centerY + (radius - 15) * Math.sin(angle));

      let status: 'pending' | 'active' | 'paid' | 'denied' = 'pending';
      if (approvedAgents.some((a) => a.name === hire.agent.name)) {
        status = 'paid';
      } else if (deniedAgents.some((a) => a.name === hire.agent.name)) {
        status = 'denied';
      } else if (i === currentHireIndex) {
        status = 'active';
      }

      return {
        id: hire.agent.name,
        name: hire.agent.name,
        priceUsd: hire.agent.priceUsd,
        x,
        y,
        status,
        reason: hire.reason,
      };
    });
  }, [plannedHires, approvedAgents, deniedAgents, currentHireIndex, riskyBlocked, centerX, centerY, radius]);

  return (
    <div className="w-full bg-[#0E0E14] border border-white/10 rounded-2xl p-4 relative overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#8352ff] text-[18px]">hub</span>
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Live Agent Economic Topology
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-white/50">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#8352ff]"></span> Paid
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400"></span> Denied
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white/20"></span> Pending
          </span>
        </div>
      </div>

      <div className="relative w-full aspect-[640/300] max-h-[300px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          <defs>
            <filter id="purple-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="center-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8352ff" />
              <stop offset="100%" stopColor="#cebdff" />
            </linearGradient>
          </defs>

          {/* Edges from Center to Specialists */}
          {nodes.map((node) => {
            const isPaid = node.status === 'paid';
            const isDenied = node.status === 'denied';
            const isActive = node.status === 'active';

            const midX = (centerX + node.x) / 2;
            const midY = (centerY + node.y) / 2;

            return (
              <g key={`edge-${node.id}`}>
                {/* Connecting Line */}
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={node.x}
                  y2={node.y}
                  stroke={isPaid ? '#8352ff' : isDenied ? '#ef4444' : isActive ? '#cebdff' : '#ffffff20'}
                  strokeWidth={isPaid || isActive ? 2.5 : 1.5}
                  strokeDasharray={isPaid ? undefined : isDenied ? '4,4' : '3,3'}
                  filter={isPaid ? 'url(#purple-glow)' : undefined}
                />

                {/* Animated travelling pulse dot for paid transactions */}
                {isPaid && (
                  <circle r="4" fill="#cebdff" filter="url(#purple-glow)">
                    <animateMotion
                      path={`M ${centerX} ${centerY} L ${node.x} ${node.y}`}
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Status Badge at midpoint of edge */}
                {isPaid && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-24"
                      y="-10"
                      width="48"
                      height="20"
                      rx="6"
                      fill="#8352ff"
                      className="shadow-sm"
                    />
                    <text
                      x="0"
                      y="4"
                      fill="#ffffff"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      +{node.priceUsd}
                    </text>
                  </g>
                )}

                {isDenied && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-38"
                      y="-10"
                      width="76"
                      height="20"
                      rx="6"
                      fill="#261014"
                      stroke="#ef4444"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      fill="#ef4444"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ✕ {node.priceUsd} denied
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Center Orchestrator Node (TravelAgent) */}
          <g transform={`translate(${centerX}, ${centerY})`}>
            {/* Ambient Halo */}
            <circle r="40" fill="#8352ff" opacity="0.15" className="animate-pulse" />
            <circle
              r="30"
              fill="url(#center-grad)"
              stroke="#ffffff"
              strokeWidth="2"
              filter="url(#purple-glow)"
            />
            {/* Center Icon */}
            <text
              x="0"
              y="5"
              fill="#000000"
              fontSize="12"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              AGENT
            </text>
            <text
              x="0"
              y="46"
              fill="#ffffff"
              fontSize="11"
              fontFamily="sans-serif"
              fontWeight="bold"
              textAnchor="middle"
            >
              {agentName}
            </text>
            <text
              x="0"
              y="58"
              fill="#cebdff"
              fontSize="9"
              fontFamily="monospace"
              textAnchor="middle"
            >
              Orchestrator
            </text>
          </g>

          {/* Specialist Nodes */}
          {nodes.map((node) => {
            const isPaid = node.status === 'paid';
            const isDenied = node.status === 'denied';
            const isActive = node.status === 'active';

            return (
              <g key={`node-${node.id}`} transform={`translate(${node.x}, ${node.y})`}>
                <circle
                  r="20"
                  fill={isPaid ? '#1f1338' : isDenied ? '#2a1115' : isActive ? '#2d1b54' : '#14141e'}
                  stroke={isPaid ? '#8352ff' : isDenied ? '#ef4444' : isActive ? '#cebdff' : '#ffffff30'}
                  strokeWidth={isPaid || isActive ? 2 : 1.5}
                  filter={isPaid ? 'url(#purple-glow)' : undefined}
                />

                <text
                  x="0"
                  y="4"
                  fill={isPaid ? '#cebdff' : isDenied ? '#ef4444' : '#ffffff'}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {isPaid ? 'PAID' : isDenied ? '✕' : node.priceUsd}
                </text>

                {/* Node Label Below */}
                <text
                  x="0"
                  y="32"
                  fill={isPaid ? '#ffffff' : isDenied ? '#ef4444' : '#ffffff90'}
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {node.name}
                </text>
              </g>
            );
          })}

          {/* Empty state hint */}
          {nodes.length === 0 && (
            <text
              x={centerX}
              y={centerY + 60}
              fill="#ffffff50"
              fontSize="11"
              fontFamily="monospace"
              textAnchor="middle"
            >
              Type a task &amp; run agent to generate topology
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
