export interface FlightDetails {
  airline: string;
  flightNumber: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  departure: string;
  arrival: string;
  date: string;
  seat: string;
  class: string;
  duration: string;
  gate: string;
  terminal: string;
  passengerName: string;
  bookingRef: string;
  txHash?: string;
}

interface BoardingPassProps {
  flight: FlightDetails;
}

export default function BoardingPass({ flight }: BoardingPassProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto animate-in fade-in duration-500 select-none">
      {/* Main Ticket Body */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1030 0%, #0f0820 50%, #14103a 100%)',
          boxShadow: '0 0 50px rgba(131, 82, 255, 0.4), 0 0 120px rgba(131, 82, 255, 0.1)',
          border: '1px solid rgba(131, 82, 255, 0.4)',
        }}
      >
        {/* Top Header Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#8352ff] via-[#cebdff] to-[#8352ff] opacity-90" />

        {/* Ticket Main Content */}
        <div className="flex flex-col sm:flex-row">
          {/* Left / Main Section */}
          <div className="flex-1 p-6 sm:p-7 flex flex-col gap-5">
            {/* Airline & Booking Ref Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8352ff]/25 border border-[#8352ff]/40 flex items-center justify-center text-[#cebdff] font-black text-sm font-mono">
                  {flight.airline.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-base font-bold text-white tracking-wide">{flight.airline}</div>
                  <div className="text-[11px] font-mono text-white/50">Monad AI Agent Booking</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-white/40 uppercase">Booking Ref</div>
                <div className="text-lg font-black font-mono text-[#cebdff] tracking-widest">{flight.bookingRef}</div>
              </div>
            </div>

            {/* Route: FROM → TO */}
            <div className="flex items-center gap-3">
              {/* Origin */}
              <div className="flex flex-col items-start">
                <div className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-none">{flight.fromCode}</div>
                <div className="text-xs text-white/60 mt-1.5 font-sans">{flight.from}</div>
                <div className="text-sm font-bold font-mono text-[#cebdff] mt-1">{flight.departure}</div>
              </div>

              {/* Flight Arc Visual */}
              <div className="flex-1 flex flex-col items-center gap-1 px-2">
                <div className="text-[11px] text-white/40 font-mono">{flight.duration}</div>
                <div className="relative w-full flex items-center">
                  <div className="h-px flex-1 bg-gradient-to-r from-white/20 via-[#8352ff]/70 to-white/20"></div>
                  <span className="mx-1 text-[#8352ff] text-sm">✈</span>
                  <div className="h-px flex-1 bg-white/20"></div>
                </div>
                <div className="text-[10px] text-white/40 font-mono">NON-STOP</div>
              </div>

              {/* Destination */}
              <div className="flex flex-col items-end">
                <div className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-none">{flight.toCode}</div>
                <div className="text-xs text-white/60 mt-1.5 font-sans text-right">{flight.to}</div>
                <div className="text-sm font-bold font-mono text-[#cebdff] mt-1">{flight.arrival}</div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10">
              <div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Date</div>
                <div className="text-sm font-bold text-white mt-0.5">{flight.date}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Flight</div>
                <div className="text-sm font-bold text-white mt-0.5">{flight.flightNumber}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Class</div>
                <div className="text-sm font-bold text-white mt-0.5">{flight.class}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Gate</div>
                <div className="text-sm font-bold text-white mt-0.5">{flight.gate}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Terminal</div>
                <div className="text-sm font-bold text-white mt-0.5">{flight.terminal}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Seat</div>
                <div className="text-sm font-bold text-[#cebdff] mt-0.5">{flight.seat}</div>
              </div>
            </div>

            {/* Passenger */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Passenger</div>
                <div className="text-base font-bold text-white mt-0.5 uppercase tracking-wide">{flight.passengerName}</div>
              </div>
              {flight.txHash && (
                <div className="text-right">
                  <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Paid on Monad</div>
                  <div className="text-[11px] font-mono text-[#8352ff] mt-0.5">
                    {flight.txHash.slice(0, 8)}...{flight.txHash.slice(-6)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tear Line Divider */}
          <div className="hidden sm:flex flex-col items-center py-6 px-1">
            <div className="w-4 h-4 rounded-full bg-[#0A0A0F] -ml-2 -mt-2 border-r border-[#8352ff]/20" />
            <div
              className="flex-1 border-l-2 border-dashed border-white/15 my-1"
              style={{ borderSpacing: '6px', minHeight: '180px' }}
            />
            <div className="w-4 h-4 rounded-full bg-[#0A0A0F] -ml-2 -mb-2 border-r border-[#8352ff]/20" />
          </div>

          {/* Right Stub Section */}
          <div className="sm:w-36 p-5 flex flex-col items-center justify-between gap-4 border-t sm:border-t-0 border-white/10">
            <div className="text-center">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">Seat</div>
              <div className="text-3xl font-black font-mono text-[#cebdff]">{flight.seat}</div>
            </div>

            {/* Barcode Visual (purely decorative SVG) */}
            <svg
              width="72"
              height="72"
              viewBox="0 0 72 72"
              className="opacity-70"
              fill="white"
            >
              {/* Simple QR-like block pattern */}
              {[
                [0,0,6,6],[8,0,4,6],[14,0,6,6],[22,0,2,2],[26,0,4,2],[32,0,6,2],[40,0,2,4],[44,0,2,2],[48,0,6,6],
                [0,8,2,4],[6,8,2,4],[14,8,2,4],[20,8,2,2],[24,8,4,2],[30,8,2,4],[36,8,2,2],[40,8,4,2],[48,8,2,4],[54,8,2,2],
                [0,14,6,6],[8,14,4,2],[14,14,6,6],[22,14,2,4],[26,14,2,2],[30,14,4,4],[36,14,4,4],[42,14,6,2],[48,14,6,6],
                [0,22,2,2],[4,22,4,2],[10,22,2,2],[14,22,4,4],[20,22,2,4],[26,22,2,2],[30,22,4,2],[36,22,2,4],[42,22,2,4],[46,22,2,2],[50,22,2,2],[54,22,2,2],
                [0,30,4,4],[6,30,2,2],[10,30,4,2],[16,30,2,4],[20,30,4,2],[26,30,4,4],[32,30,2,2],[36,30,2,2],[40,30,4,4],[46,30,2,4],[50,30,2,2],[54,30,2,4],
                [0,38,2,2],[4,38,2,4],[8,38,2,2],[12,38,4,4],[18,38,2,2],[22,38,2,4],[26,38,2,2],[30,38,4,2],[36,38,6,4],[44,38,4,2],[50,38,2,4],[54,38,2,2],
                [0,44,6,6],[8,44,4,2],[14,44,2,6],[18,44,2,2],[22,44,4,4],[28,44,2,2],[32,44,4,4],[38,44,2,4],[42,44,2,2],[46,44,2,2],[50,44,4,6],
                [8,50,2,2],[12,50,2,4],[16,50,4,2],[22,50,2,4],[26,50,4,2],[32,50,2,4],[36,50,2,2],[40,50,4,2],[46,50,2,2],
                [0,54,2,6],[4,54,2,2],[8,54,4,6],[14,54,2,2],[18,54,4,2],[24,54,2,4],[28,54,4,2],[34,54,2,4],[38,54,4,2],[44,54,4,2],[50,54,2,6],[54,54,2,4],
              ].map(([x, y, w, h], i) => (
                <rect key={i} x={x} y={y} width={w} height={h} rx="0.5" />
              ))}
            </svg>

            <div className="text-center">
              <div className="text-[10px] font-mono text-white/40 text-center">Gate</div>
              <div className="text-xl font-black font-mono text-white">{flight.gate}</div>
            </div>
          </div>
        </div>

        {/* Bottom Status Strip */}
        <div className="px-7 py-3 bg-[#8352ff]/10 border-t border-[#8352ff]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              BOOKING CONFIRMED · Paid autonomously via Monad Testnet
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/30">AgentPay · Chain 10143</span>
        </div>
      </div>
    </div>
  );
}
